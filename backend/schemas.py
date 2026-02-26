from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime

class UserBase(BaseModel):
    email: str
    role: str
    hospital_id: Optional[int] = None

class UserCreate(UserBase):
    password: str

class UserResponse(UserBase):
    id: int
    class Config:
        from_attributes = True
        
class HospitalBase(BaseModel):
    name: str
    lat: float
    lng: float
    icu_beds: int
    general_beds: int
    affordability_tier: int
    rating: float
    has_cardiology: bool
    has_trauma: bool
    has_neurology: bool
    has_pulmonology: bool

class HospitalCreate(HospitalBase):
    pass

class HospitalResponse(HospitalBase):
    id: int
    class Config:
        from_attributes = True

class AmbulanceBase(BaseModel):
    driver_user_id: int
    current_lat: float
    current_lng: float

class AmbulanceResponse(AmbulanceBase):
    id: int
    class Config:
        from_attributes = True

class IncidentCreate(BaseModel):
    emergency_type: str
    incident_lat: float
    incident_lng: float
    heart_rate: Optional[int] = None
    spo2: Optional[int] = None
    bp_sys: Optional[int] = None
    bp_dia: Optional[int] = None
    affordability_pref: Optional[int] = None
    
class IncidentResponse(IncidentCreate):
    id: int
    created_at: datetime
    status: str
    class Config:
        from_attributes = True

class TripCreate(BaseModel):
    incident_id: int
    ambulance_id: int
    selected_hospital_id: int
    eta_minutes: float
    distance_km: float

class TripResponse(BaseModel):
    id: int
    incident_id: int
    ambulance_id: int
    selected_hospital_id: int
    eta_minutes: float
    distance_km: float
    signal_priority_active: bool
    status: str
    class Config:
        from_attributes = True

class AuthResponse(BaseModel):
    access_token: str
    token_type: str
    user: UserResponse
