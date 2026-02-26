# PRANA — Predictive Response & Ambulance Hospital Network for Actions

PRANA is a full-stack MVP designed to solve emergency response coordination. It connects ambulance drivers with hospitals through intelligent hospital matching, explainable recommendations, real-time ETA tracking via WebSockets, and simulated traffic priority (Green Corridors).

## Features
- **Ambulance Driver Portal**: Create emergencies, automatically get hospital recommendations based on an explainable matching algorithm (ETA, beds, specialists, affordability), and navigate with real-time ETA broadcast to hospitals.
- **Hospital Command Portal**: Receive live incoming case alerts, manage pre-arrival readiness (acknowledge, assign doctors), and view hospital resource availability.
- **Real-Time Synergy**: Uses WebSockets to synchronize ambulance movement (simulated countdown) and hospital readiness states instantly.

## Architecture Stack
- **Backend**: FastAPI (Python), SQLite, SQLAlchemy, WebSockets, JWT Auth.
- **Frontend**: React (Vite), React Router, Context API, Vanilla CSS (Glassmorphism UI).

## Quick Start Guide

### 1. Start the Backend API
```bash
cd backend
python -m venv venv
venv\Scripts\activate   # Windows
# source venv/bin/activate # Mac/Linux
pip install "fastapi[all]" sqlalchemy passlib pyjwt websockets httpx bcrypt
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```
*Note: The database is automatically seeded upon the first startup with demo hospitals and users.*

### 2. Start the Frontend Web App
```bash
cd frontend
npm install
npm run dev
```

### 3. Demo Test Flow
1. Open the application in your browser (usually `http://localhost:5173`).
2. **Open two distinct browser windows or tabs** (Incognito is best for the second one, due to localStorage token sharing if in the same session).
3. **Window 1 (Driver)**: Click "Ambulance Driver", login with:
   - Email: `driver1@prana.demo`
   - Password: `prana123`
4. **Window 2 (Hospital)**: Click "Hospital Staff", login with:
   - Email: `hospital1@prana.demo`
   - Password: `prana123`
5. **Flow Execution**:
   - In the Driver portal, create a "Cardiac" emergency with Lat/Lng and hit "Analyze".
   - Select the topmost hospital match and click "Dispatch Here".
   - Watch the active trip dashboard appear in the Driver portal, and immediately see the new incoming case pop up in the Hospital portal via WebSockets.
   - Click "Request Green Corridor" in the Driver portal to simulate ETA reduction.
   - Click "Acknowledge" in the Hospital portal to notify the driver that the hospital is preparing.
   - Finally, click "Mark Arrived" to complete the trip on both portals.

## Demo Video
*(Attach demo recordings in the final walkthrough artifact)*
