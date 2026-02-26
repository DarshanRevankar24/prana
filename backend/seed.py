from sqlalchemy.orm import Session
import models, auth

def seed_database(db: Session):
    # Check if already seeded
    if db.query(models.Hospital).first():
        return

    # Create Hospitals
    hospitals_data = [
        {"name": "City Central Hospital", "lat": 12.9716, "lng": 77.5946, "icu_beds": 10, "general_beds": 50, "affordability_tier": 2, "rating": 4.5, "has_cardiology": True, "has_trauma": True, "has_neurology": False, "has_pulmonology": True},
        {"name": "Apollo Care", "lat": 12.9650, "lng": 77.6000, "icu_beds": 20, "general_beds": 100, "affordability_tier": 3, "rating": 4.8, "has_cardiology": True, "has_trauma": True, "has_neurology": True, "has_pulmonology": True},
        {"name": "St. John's Med", "lat": 12.9244, "lng": 77.6186, "icu_beds": 15, "general_beds": 150, "affordability_tier": 1, "rating": 4.2, "has_cardiology": False, "has_trauma": True, "has_neurology": False, "has_pulmonology": True},
        {"name": "Manipal Whitefield", "lat": 12.9840, "lng": 77.7523, "icu_beds": 25, "general_beds": 80, "affordability_tier": 3, "rating": 4.7, "has_cardiology": True, "has_trauma": True, "has_neurology": True, "has_pulmonology": False},
        {"name": "Fortis Bannerghatta", "lat": 12.8943, "lng": 77.5980, "icu_beds": 30, "general_beds": 120, "affordability_tier": 3, "rating": 4.6, "has_cardiology": True, "has_trauma": True, "has_neurology": True, "has_pulmonology": True},
        {"name": "Sagar Clinic", "lat": 12.9300, "lng": 77.5800, "icu_beds": 2, "general_beds": 20, "affordability_tier": 1, "rating": 3.8, "has_cardiology": False, "has_trauma": False, "has_neurology": False, "has_pulmonology": False},
    ]

    hospitals = []
    for h in hospitals_data:
        db_hospital = models.Hospital(**h)
        db.add(db_hospital)
        hospitals.append(db_hospital)
    db.commit()

    for h in hospitals:
        db.refresh(h)

    # Create Users
    users_data = [
        {"email": "driver1@prana.demo", "password": "prana123", "role": "AMBULANCE_DRIVER", "hospital_id": None},
        {"email": "hospital1@prana.demo", "password": "prana123", "role": "HOSPITAL_STAFF", "hospital_id": hospitals[0].id},
        {"email": "hospital2@prana.demo", "password": "prana123", "role": "HOSPITAL_STAFF", "hospital_id": hospitals[1].id},
    ]

    users = []
    for u in users_data:
        pwd = u.pop("password")
        encoded_pwd = auth.get_password_hash(pwd)
        db_user = models.User(**u, password_hash=encoded_pwd)
        db.add(db_user)
        users.append(db_user)
    db.commit()

    for u in users:
        db.refresh(u)

    # Create Ambulance
    amb1 = models.Ambulance(driver_user_id=users[0].id, current_lat=12.95, current_lng=77.58)
    db.add(amb1)
    db.commit()

    print("Database seeded successfully with demo data.")
