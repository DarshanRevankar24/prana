import math
import httpx
from typing import List, Dict, Any
import models

# Constants for scoring weights
W_ETA = 0.4
W_BEDS = 0.2
W_SPECIALIST = 0.2
W_AFFORD = 0.1
W_RATING = 0.1

def haversine(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    # Radius of earth in km
    R = 6371.0
    dlat = math.radians(lat2 - lat1)
    dlon = math.radians(lon2 - lon1)
    a = math.sin(dlat / 2)**2 + math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) * math.sin(dlon / 2)**2
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
    distance = R * c
    return distance

async def get_route(lat1: float, lng1: float, lat2: float, lng2: float) -> tuple[float, float, str]:
    """
    Returns (distance_km, duration_min, status)
    status: 'osrm' or 'haversine'
    """
    try:
        # OSRM expects: longitude,latitude
        url = f"http://router.project-osrm.org/route/v1/driving/{lng1},{lat1};{lng2},{lat2}?overview=false"
        async with httpx.AsyncClient() as client:
            response = await client.get(url, timeout=5.0)
            if response.status_code == 200:
                data = response.json()
                if data.get("routes") and len(data["routes"]) > 0:
                    route = data["routes"][0]
                    distance_km = route["distance"] / 1000.0
                    duration_min = route["duration"] / 60.0
                    return distance_km, duration_min, "osrm"
    except Exception as e:
        print(f"OSRM routing failed: {str(e)}")
    
    # Fallback to Haversine
    dist = haversine(lat1, lng1, lat2, lng2)
    # Assume 40 km/h average ambulance speed in city traffic -> 0.66 km/min
    duration = dist / 0.66 
    return dist, duration, "haversine"

async def match_hospitals(
    incident_lat: float, 
    incident_lng: float, 
    emergency_type: str, 
    affordability_pref: int, 
    hospitals: List[models.Hospital]
) -> List[Dict[str, Any]]:
    
    results = []
    
    for hospital in hospitals:
        dist_km, eta_min, route_type = await get_route(incident_lat, incident_lng, hospital.lat, hospital.lng)
        
        # Calculate Eta Score (Inverse of ETA, max 100 for 0 min, min 0 for >60min)
        eta_score = max(0, 100 - (eta_min * 100 / 60.0))
        
        # Calculate Bed Score
        total_beds = hospital.icu_beds + hospital.general_beds
        if total_beds == 0:
            bed_score = 0
        elif emergency_type in ["Cardiac", "Stroke", "Respiratory"]:
            if hospital.icu_beds > 0:
                bed_score = 100
            else:
                bed_score = 20 # Penalty for no ICU
        elif emergency_type == "Trauma":
            if hospital.has_trauma and hospital.icu_beds > 0:
                bed_score = 100
            elif hospital.icu_beds > 0:
                bed_score = 80
            else:
                bed_score = 20
        else: # General
            bed_score = 100 if hospital.general_beds > 0 else 50
            
        # Calculate Specialist Score
        specialist_score = 0
        if emergency_type == "Cardiac" and hospital.has_cardiology: specialist_score = 100
        elif emergency_type == "Trauma" and hospital.has_trauma: specialist_score = 100
        elif emergency_type == "Stroke" and hospital.has_neurology: specialist_score = 100
        elif emergency_type == "Respiratory" and hospital.has_pulmonology: specialist_score = 100
        elif emergency_type == "General": specialist_score = 100
        
        # Calculate Affordability Score
        if affordability_pref is None:
            afford_score = 100
        else:
            diff = abs(hospital.affordability_tier - affordability_pref)
            if diff == 0:
                afford_score = 100
            elif diff == 1:
                afford_score = 50
            else:
                afford_score = 0
                
        # Calculate Rating Score (0-100)
        rating_score = (hospital.rating / 5.0) * 100
        
        # Calculate Final Score
        final_score = (W_ETA * eta_score) + (W_BEDS * bed_score) + (W_SPECIALIST * specialist_score) + (W_AFFORD * afford_score) + (W_RATING * rating_score)
        
        # Explanation logic
        explanation = f"ETA: {eta_min:.1f}m ({dist_km:.1f}km)."
        if max(bed_score, specialist_score) > 80:
            explanation += f" High readiness for {emergency_type}."
        if affordability_pref and hospital.affordability_tier == affordability_pref:
            explanation += " Meets affordability preference."
            
        results.append({
            "hospital": hospital,
            "eta_min": eta_min,
            "dist_km": dist_km,
            "route_type": route_type,
            "score": final_score,
            "explanation": explanation
        })
        
    # Sort by final score descending
    results.sort(key=lambda x: x["score"], reverse=True)
    return results[:3] # Return top 3
