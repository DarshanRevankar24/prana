import React, { useState, useEffect, useContext } from 'react';
import { AuthContext } from '../context/AuthContext';
import api from '../api';
import { ShieldPlus, Activity, CheckCircle, AlertTriangle, Clock } from 'lucide-react';

const HospitalPortal = () => {
    const { user, logout } = useContext(AuthContext);
    const [incomingCases, setIncomingCases] = useState([]);
    const [hospitalInfo, setHospitalInfo] = useState(null);
    const [ws, setWs] = useState(null);

    // Edit Form State
    const [isEditing, setIsEditing] = useState(false);
    const [editForm, setEditForm] = useState(null);

    useEffect(() => {
        fetchInitialData();
    }, []);

    useEffect(() => {
        if (user?.hospital_id && !ws) {
            const newWs = new WebSocket(`ws://localhost:8000/ws/hospital/${user.hospital_id}`);
            setWs(newWs);

            newWs.onmessage = (event) => {
                try {
                    const data = JSON.parse(event.data);
                    if (data.type === 'eta_update') {
                        // Refresh cases to get new ETA
                        fetchCases();
                    }
                } catch (e) {
                    console.error("WS parse error", e);
                }
            };

            return () => {
                newWs.close();
                setWs(null);
            };
        }
    }, [user, ws]);

    const fetchInitialData = async () => {
        try {
            const hRes = await api.get('/hospitals');
            const hInfo = hRes.data.find(h => h.id === user.hospital_id);
            setHospitalInfo(hInfo);
            setEditForm(hInfo);
            await fetchCases();
        } catch (err) {
            console.error(err);
        }
    };

    const fetchCases = async () => {
        if (!user?.hospital_id) return;
        try {
            const cRes = await api.get(`/trips/hospital/${user.hospital_id}`);
            // Fetch incident details for each trip
            const tripsWithIncidents = await Promise.all(cRes.data.map(async (trip) => {
                // In a real app we'd have a joined endpoint, but for demo we can mock incident details 
                // or assume we have the ID to display
                return trip;
            }));

            // Show only active/dispatched cases
            setIncomingCases(tripsWithIncidents.filter(c => c.status !== 'ARRIVED'));
        } catch (err) {
            console.error(err);
        }
    };

    const handleAction = async (tripId, actionType) => {
        try {
            await api.post(`/trips/${tripId}/action?action=${actionType}&message=Hospital%20Staff%20acknowledged`);
            fetchCases();
        } catch (err) {
            console.error(err);
        }
    };

    const handleSaveResources = async () => {
        try {
            const res = await api.put(`/hospitals/${user.hospital_id}`, editForm);
            setHospitalInfo(res.data);
            setIsEditing(false);
        } catch (err) {
            console.error("Failed to update resources", err);
        }
    };

    return (
        <div>
            <header className="app-header">
                <div className="brand">
                    <ShieldPlus size={24} color="#00b4d8" />
                    PRANA | Hospital Command
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                    <span className="badge badge-success" style={{ marginRight: '1rem' }}>{hospitalInfo?.name}</span>
                    <span style={{ fontSize: '0.9rem' }}>{user?.email}</span>
                    <button onClick={logout} className="btn btn-outline" style={{ padding: '0.4rem 1rem' }}>Logout</button>
                </div>
            </header>

            <div className="container" style={{ padding: '2rem 0' }}>
                <div className="grid-2" style={{ gridTemplateColumns: '1fr 3fr' }}>
                    {/* Sidebar / Admin Panel */}
                    <div className="card glass-panel" style={{ alignSelf: 'start' }}>
                        <div className="card-header">Resource Availability</div>
                        {hospitalInfo && (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '0.5rem', borderBottom: '1px solid var(--border-color)', alignItems: 'center' }}>
                                    <span>ICU Beds</span>
                                    {isEditing ? (
                                        <input type="number" className="form-input" style={{ width: '80px', padding: '0.2rem' }} value={editForm.icu_beds} onChange={e => setEditForm({ ...editForm, icu_beds: parseInt(e.target.value) || 0 })} />
                                    ) : (
                                        <span style={{ fontWeight: 'bold' }}>{hospitalInfo.icu_beds} Available</span>
                                    )}
                                </div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '0.5rem', borderBottom: '1px solid var(--border-color)', alignItems: 'center' }}>
                                    <span>General Beds</span>
                                    {isEditing ? (
                                        <input type="number" className="form-input" style={{ width: '80px', padding: '0.2rem' }} value={editForm.general_beds} onChange={e => setEditForm({ ...editForm, general_beds: parseInt(e.target.value) || 0 })} />
                                    ) : (
                                        <span style={{ fontWeight: 'bold' }}>{hospitalInfo.general_beds} Available</span>
                                    )}
                                </div>

                                <h4 style={{ marginTop: '1rem', color: 'var(--text-muted)' }}>Specialists on Call</h4>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                                    <label style={{ display: 'flex', justifyContent: 'space-between' }}>
                                        <span>Cardiology</span> <input type="checkbox" checked={isEditing ? editForm.has_cardiology : hospitalInfo.has_cardiology} onChange={e => isEditing && setEditForm({ ...editForm, has_cardiology: e.target.checked })} readOnly={!isEditing} />
                                    </label>
                                    <label style={{ display: 'flex', justifyContent: 'space-between' }}>
                                        <span>Trauma</span> <input type="checkbox" checked={isEditing ? editForm.has_trauma : hospitalInfo.has_trauma} onChange={e => isEditing && setEditForm({ ...editForm, has_trauma: e.target.checked })} readOnly={!isEditing} />
                                    </label>
                                    <label style={{ display: 'flex', justifyContent: 'space-between' }}>
                                        <span>Neurology</span> <input type="checkbox" checked={isEditing ? editForm.has_neurology : hospitalInfo.has_neurology} onChange={e => isEditing && setEditForm({ ...editForm, has_neurology: e.target.checked })} readOnly={!isEditing} />
                                    </label>
                                    <label style={{ display: 'flex', justifyContent: 'space-between' }}>
                                        <span>Pulmonology</span> <input type="checkbox" checked={isEditing ? editForm.has_pulmonology : hospitalInfo.has_pulmonology} onChange={e => isEditing && setEditForm({ ...editForm, has_pulmonology: e.target.checked })} readOnly={!isEditing} />
                                    </label>
                                </div>

                                {isEditing ? (
                                    <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1rem' }}>
                                        <button className="btn btn-primary" style={{ flex: 1 }} onClick={handleSaveResources}>Save</button>
                                        <button className="btn btn-outline" style={{ flex: 1 }} onClick={() => { setIsEditing(false); setEditForm(hospitalInfo); }}>Cancel</button>
                                    </div>
                                ) : (
                                    <button className="btn btn-outline" style={{ marginTop: '1rem' }} onClick={() => setIsEditing(true)}>Update Resources</button>
                                )}
                            </div>
                        )}
                    </div>

                    {/* Main Content: Incoming Cases */}
                    <div>
                        <h2 style={{ marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <Activity color="var(--primary-light)" /> Live Incoming Emergencies
                        </h2>

                        {incomingCases.length === 0 ? (
                            <div className="card glass-panel" style={{ textAlign: 'center', padding: '4rem 2rem' }}>
                                <CheckCircle size={48} color="var(--success)" style={{ marginBottom: '1rem' }} />
                                <h3>No Active Incoming Cases</h3>
                                <p style={{ color: 'var(--text-muted)', marginTop: '0.5rem' }}>All quiet. Resources are on standby.</p>
                            </div>
                        ) : (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                                {incomingCases.map(trip => {
                                    const isCritical = trip.eta_minutes < 5;
                                    const isPrep = trip.eta_minutes < 15 && !isCritical;

                                    return (
                                        <div key={trip.id} className="card glass-panel" style={{ borderLeft: `4px solid ${isCritical ? 'var(--danger)' : isPrep ? 'var(--accent)' : 'var(--primary-light)'}` }}>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                                <div>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '0.5rem' }}>
                                                        <span style={{ fontSize: '1.2rem', fontWeight: 600 }}>Ambulance #{trip.ambulance_id}</span>
                                                        <span className={`badge ${trip.status === 'ACKNOWLEDGED' ? 'badge-success' : 'badge-warning'}`}>
                                                            {trip.status}
                                                        </span>
                                                        {trip.signal_priority_active &&
                                                            <span className="badge badge-critical" style={{ display: 'flex', alignItems: 'center', gap: '0.2rem' }}>
                                                                <AlertTriangle size={12} /> Green Corridor Route
                                                            </span>
                                                        }
                                                    </div>
                                                    <div style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>
                                                        Incident #{trip.incident_id} • Dispatched
                                                    </div>
                                                </div>

                                                <div style={{ textAlign: 'right' }}>
                                                    <div style={{ fontSize: '2rem', fontWeight: 700, color: isCritical ? '#ff4d6d' : 'white', lineHeight: 1, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                                        <Clock size={24} /> {Math.max(0, trip.eta_minutes).toFixed(1)} <span style={{ fontSize: '1rem', fontWeight: 400 }}>min</span>
                                                    </div>
                                                    <div style={{ fontSize: '0.9rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>Estimated Arrival</div>
                                                </div>
                                            </div>

                                            <div style={{ marginTop: '1.5rem', display: 'flex', gap: '1rem', borderTop: '1px solid var(--border-color)', paddingTop: '1.5rem' }}>
                                                {trip.status !== 'ACKNOWLEDGED' && (
                                                    <button onClick={() => handleAction(trip.id, 'ACKNOWLEDGE')} className="btn btn-primary" style={{ flex: 1 }}>
                                                        Acknowledge & Prepare
                                                    </button>
                                                )}
                                                {trip.status === 'ACKNOWLEDGED' && (
                                                    <>
                                                        <button onClick={() => handleAction(trip.id, 'ASSIGN_DOC')} className="btn btn-outline" style={{ flex: 1 }}>
                                                            Assign Doctor
                                                        </button>
                                                        <button onClick={() => handleAction(trip.id, 'RESERVE_BED')} className="btn btn-outline" style={{ flex: 1 }}>
                                                            Reserve ICU Bed
                                                        </button>
                                                    </>
                                                )}
                                            </div>
                                        </div>
                                    )
                                })}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default HospitalPortal;
