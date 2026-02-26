from fastapi import FastAPI, Depends, HTTPException, status, WebSocket, WebSocketDisconnect
from fastapi.security import OAuth2PasswordRequestForm
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from typing import List

import models, schemas, auth, database, seed
from database import engine, get_db

models.Base.metadata.create_all(bind=engine)

app = FastAPI(title="PRANA API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("startup")
def on_startup():
    db = database.SessionLocal()
    seed.seed_database(db)
    db.close()

@app.post("/token", response_model=schemas.AuthResponse)
def login_for_access_token(form_data: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    user = db.query(models.User).filter(models.User.email == form_data.username).first()
    if not user or not auth.verify_password(form_data.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    access_token_expires = auth.timedelta(minutes=auth.ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = auth.create_access_token(
        data={"sub": user.email}, expires_delta=access_token_expires
    )
    return {"access_token": access_token, "token_type": "bearer", "user": user}

@app.get("/users/me", response_model=schemas.UserResponse)
def read_users_me(current_user: models.User = Depends(auth.get_current_active_user)):
    return current_user

@app.get("/hospitals", response_model=List[schemas.HospitalResponse])
def get_hospitals(db: Session = Depends(get_db)):
    return db.query(models.Hospital).all()

@app.put("/hospitals/{hospital_id}", response_model=schemas.HospitalResponse)
def update_hospital(
    hospital_id: int, 
    hospital_update: schemas.HospitalBase, 
    current_user: models.User = Depends(auth.get_current_hospital_staff), 
    db: Session = Depends(get_db)
):
    if current_user.hospital_id != hospital_id:
        raise HTTPException(status_code=403, detail="Not authorized to update this hospital")
        
    db_hospital = db.query(models.Hospital).filter(models.Hospital.id == hospital_id).first()
    if not db_hospital:
        raise HTTPException(status_code=404, detail="Hospital not found")
        
    for key, value in hospital_update.model_dump().items():
        setattr(db_hospital, key, value)
        
    db.commit()
    db.refresh(db_hospital)
    return db_hospital

@app.post("/incidents", response_model=schemas.IncidentResponse)
async def create_incident(
    incident: schemas.IncidentCreate,
    current_user: models.User = Depends(auth.get_current_ambulance_driver),
    db: Session = Depends(get_db)
):
    db_incident = models.Incident(**incident.model_dump())
    db.add(db_incident)
    db.commit()
    db.refresh(db_incident)
    return db_incident

@app.get("/incidents/{incident_id}/match")
async def match_hospitals_for_incident(
    incident_id: int,
    current_user: models.User = Depends(auth.get_current_ambulance_driver),
    db: Session = Depends(get_db)
):
    incident = db.query(models.Incident).filter(models.Incident.id == incident_id).first()
    if not incident:
        raise HTTPException(status_code=404, detail="Incident not found")
        
    hospitals = db.query(models.Hospital).all()
    from engine import match_hospitals
    results = await match_hospitals(
        incident.incident_lat, 
        incident.incident_lng,
        incident.emergency_type,
        incident.affordability_pref,
        hospitals
    )
    return results

@app.post("/trips", response_model=schemas.TripResponse)
async def create_trip(
    trip: schemas.TripCreate,
    current_user: models.User = Depends(auth.get_current_ambulance_driver),
    db: Session = Depends(get_db)
):
    db_trip = models.Trip(**trip.model_dump())
    db.add(db_trip)
    db.commit()
    db.refresh(db_trip)
    
    # Also update incident status
    incident = db.query(models.Incident).filter(models.Incident.id == trip.incident_id).first()
    if incident:
        incident.status = "ACTIVE"
        db.commit()
        
    # Log event
    event = models.TripEvent(trip_id=db_trip.id, event_type="DISPATCHED", message="Ambulance dispatched to incident.")
    db.add(event)
    db.commit()
    
    return db_trip

@app.get("/trips/driver", response_model=List[schemas.TripResponse])
def get_driver_trips(current_user: models.User = Depends(auth.get_current_ambulance_driver), db: Session = Depends(get_db)):
    ambulance = db.query(models.Ambulance).filter(models.Ambulance.driver_user_id == current_user.id).first()
    if not ambulance:
        return []
    return db.query(models.Trip).filter(models.Trip.ambulance_id == ambulance.id).all()

@app.get("/trips/hospital/{hospital_id}", response_model=List[schemas.TripResponse])
def get_hospital_cases(hospital_id: int, current_user: models.User = Depends(auth.get_current_hospital_staff), db: Session = Depends(get_db)):
    if current_user.hospital_id != hospital_id:
        raise HTTPException(status_code=403, detail="Can only view cases for your assigned hospital")
    return db.query(models.Trip).filter(models.Trip.selected_hospital_id == hospital_id).all()

@app.post("/trips/{trip_id}/action")
def hospital_action(trip_id: int, action: str, message: str, current_user: models.User = Depends(auth.get_current_hospital_staff), db: Session = Depends(get_db)):
    trip = db.query(models.Trip).filter(models.Trip.id == trip_id).first()
    if not trip:
        raise HTTPException(status_code=404, detail="Trip not found")
    if current_user.hospital_id != trip.selected_hospital_id:
         raise HTTPException(status_code=403, detail="Not authorized for this trip")
         
    db_action = models.HospitalAction(trip_id=trip_id, action_type=action, message=message, by_user_id=current_user.id)
    db.add(db_action)
    
    if action == "ACKNOWLEDGE":
        trip.status = "ACKNOWLEDGED"
        event = models.TripEvent(trip_id=trip_id, event_type="HOSPITAL_ACK", message=message)
        db.add(event)
        
    db.commit()
    return {"status": "Action recorded"}

@app.post("/trips/{trip_id}/priority")
def request_green_corridor(trip_id: int, current_user: models.User = Depends(auth.get_current_ambulance_driver), db: Session = Depends(get_db)):
    trip = db.query(models.Trip).filter(models.Trip.id == trip_id).first()
    if not trip:
        raise HTTPException(status_code=404, detail="Trip not found")
        
    trip.signal_priority_active = True
    # Simulate ETA reduction
    trip.eta_minutes = trip.eta_minutes * 0.8 
    
    event = models.TripEvent(trip_id=trip_id, event_type="PRIORITY_ACTIVE", message="Green corridor activated. ETA updated.")
    db.add(event)
    db.commit()
    db.refresh(trip)
    return {"status": "Green corridor requested", "new_eta": trip.eta_minutes}

@app.post("/trips/{trip_id}/arrive")
def mark_arrived(trip_id: int, current_user: models.User = Depends(auth.get_current_ambulance_driver), db: Session = Depends(get_db)):
    trip = db.query(models.Trip).filter(models.Trip.id == trip_id).first()
    if not trip:
        raise HTTPException(status_code=404, detail="Trip not found")
    
    trip.status = "ARRIVED"
    incident = db.query(models.Incident).filter(models.Incident.id == trip.incident_id).first()
    if incident:
        incident.status = "ARRIVED"
        
    event = models.TripEvent(trip_id=trip_id, event_type="ARRIVED", message="Ambulance arrived at hospital.")
    db.add(event)
    db.commit()
    return {"status": "Arrived"}

@app.get("/trips/{trip_id}/events")
def get_trip_events(trip_id: int, current_user: models.User = Depends(auth.get_current_user), db: Session = Depends(get_db)):
    return db.query(models.TripEvent).filter(models.TripEvent.trip_id == trip_id).order_by(models.TripEvent.ts).all()

# WebSocket Manager
class ConnectionManager:
    def __init__(self):
        # group_id -> list of websockets (group_id can be "hospital_1" or "trip_1")
        self.active_connections: dict[str, List[WebSocket]] = {}

    async def connect(self, websocket: WebSocket, group_id: str):
        await websocket.accept()
        if group_id not in self.active_connections:
            self.active_connections[group_id] = []
        self.active_connections[group_id].append(websocket)

    def disconnect(self, websocket: WebSocket, group_id: str):
        if group_id in self.active_connections:
            self.active_connections[group_id].remove(websocket)
            if not self.active_connections[group_id]:
                del self.active_connections[group_id]

    async def broadcast_to_group(self, message: str, group_id: str):
        if group_id in self.active_connections:
            for connection in self.active_connections[group_id]:
                try:
                    await connection.send_text(message)
                except Exception:
                    # Handle disconnected cliens silently
                    pass

manager = ConnectionManager()

@app.websocket("/ws/hospital/{hospital_id}")
async def websocket_hospital_endpoint(websocket: WebSocket, hospital_id: int):
    group_id = f"hospital_{hospital_id}"
    await manager.connect(websocket, group_id)
    try:
        while True:
            data = await websocket.receive_text()
            # In a real app, hospitals might send ping/pong. Here we just keep connection open.
    except WebSocketDisconnect:
        manager.disconnect(websocket, group_id)

@app.websocket("/ws/trip/{trip_id}")
async def websocket_trip_endpoint(websocket: WebSocket, trip_id: int):
    group_id = f"trip_{trip_id}"
    await manager.connect(websocket, group_id)
    try:
        while True:
            data = await websocket.receive_text()
            # Could receive real-time location updates from driver here
            import json
            try:
                msg = json.loads(data)
                if msg.get("type") == "eta_update":
                    # Broadcast to hospital channel too
                    db = database.SessionLocal()
                    trip = db.query(models.Trip).filter(models.Trip.id == trip_id).first()
                    if trip:
                        trip.eta_minutes = msg.get("eta")
                        db.commit()
                        await manager.broadcast_to_group(data, f"hospital_{trip.selected_hospital_id}")
                    db.close()
            except Exception as e:
                pass
    except WebSocketDisconnect:
        manager.disconnect(websocket, group_id)

