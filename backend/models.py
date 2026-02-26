from sqlalchemy import Column, Integer, String, Float, Boolean, ForeignKey, DateTime
from sqlalchemy.orm import relationship
import datetime
from database import Base

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String, unique=True, index=True)
    password_hash = Column(String)
    role = Column(String)  # AMBULANCE_DRIVER, HOSPITAL_STAFF
    hospital_id = Column(Integer, ForeignKey("hospitals.id"), nullable=True)

class Hospital(Base):
    __tablename__ = "hospitals"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, index=True)
    lat = Column(Float)
    lng = Column(Float)
    icu_beds = Column(Integer, default=0)
    general_beds = Column(Integer, default=0)
    affordability_tier = Column(Integer, default=2) # 1, 2, 3
    rating = Column(Float, default=3.0) # 1.0 - 5.0
    has_cardiology = Column(Boolean, default=False)
    has_trauma = Column(Boolean, default=False)
    has_neurology = Column(Boolean, default=False)
    has_pulmonology = Column(Boolean, default=False)

class Ambulance(Base):
    __tablename__ = "ambulances"

    id = Column(Integer, primary_key=True, index=True)
    driver_user_id = Column(Integer, ForeignKey("users.id"))
    current_lat = Column(Float)
    current_lng = Column(Float)

class Incident(Base):
    __tablename__ = "incidents"

    id = Column(Integer, primary_key=True, index=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    emergency_type = Column(String) # Cardiac, Trauma, Stroke, Respiratory, General
    incident_lat = Column(Float)
    incident_lng = Column(Float)
    heart_rate = Column(Integer, nullable=True)
    spo2 = Column(Integer, nullable=True)
    bp_sys = Column(Integer, nullable=True)
    bp_dia = Column(Integer, nullable=True)
    affordability_pref = Column(Integer, nullable=True) # 1, 2, 3, or None for Any
    status = Column(String, default="NEW") # NEW, ACTIVE, ARRIVED, CANCELLED

class Trip(Base):
    __tablename__ = "trips"

    id = Column(Integer, primary_key=True, index=True)
    incident_id = Column(Integer, ForeignKey("incidents.id"))
    ambulance_id = Column(Integer, ForeignKey("ambulances.id"))
    selected_hospital_id = Column(Integer, ForeignKey("hospitals.id"))
    eta_minutes = Column(Float)
    distance_km = Column(Float)
    signal_priority_active = Column(Boolean, default=False)
    status = Column(String, default="DISPATCHED") # DISPATCHED, ACKNOWLEDGED, ARRIVED

class TripEvent(Base):
    __tablename__ = "trip_events"

    id = Column(Integer, primary_key=True, index=True)
    trip_id = Column(Integer, ForeignKey("trips.id"))
    ts = Column(DateTime, default=datetime.datetime.utcnow)
    event_type = Column(String)
    message = Column(String)

class HospitalAction(Base):
    __tablename__ = "hospital_actions"

    id = Column(Integer, primary_key=True, index=True)
    trip_id = Column(Integer, ForeignKey("trips.id"))
    ts = Column(DateTime, default=datetime.datetime.utcnow)
    action_type = Column(String)
    message = Column(String)
    by_user_id = Column(Integer, ForeignKey("users.id"))
