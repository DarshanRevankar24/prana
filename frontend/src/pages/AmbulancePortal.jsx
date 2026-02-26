import React, { useState, useEffect, useContext } from 'react';
import { AuthContext } from '../context/AuthContext';
import api from '../api';
import { Activity, Clock, Navigation, Zap, CheckCircle, ArrowRight } from 'lucide-react';
import { MapContainer, TileLayer, Marker, Popup, useMapEvents, Polyline } from 'react-leaflet';
import L from 'leaflet';

delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
    iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
    iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
    shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

const LocationPicker = ({ lat, lng, setLat, setLng }) => {
    const map = useMapEvents({
        click(e) {
            setLat(e.latlng.lat.toFixed(5));
            setLng(e.latlng.lng.toFixed(5));
        },
    });

    useEffect(() => {
        if (lat && lng) {
            map.flyTo([parseFloat(lat), parseFloat(lng)], 13, {
                animate: true,
                duration: 1.5
            });
        }
    }, [lat, lng, map]);

    return lat && lng ? (
        <Marker position={[lat, lng]}>
            <Popup>Incident Location</Popup>
        </Marker>
    ) : null;
};

const AmbulancePortal = () => {
    const { user, logout } = useContext(AuthContext);
    const [activeTrip, setActiveTrip] = useState(null);
    const [hospitals, setHospitals] = useState([]);
    const [matchedHospitals, setMatchedHospitals] = useState([]);
    const [loading, setLoading] = useState(false);
    const [ws, setWs] = useState(null);

    // Form State
    const [emergencyType, setEmergencyType] = useState('General');
    const [lat, setLat] = useState('12.95');
    const [lng, setLng] = useState('77.58');
    const [affordability, setAffordability] = useState('Any');
    const [vitals, setVitals] = useState({ hr: '', spo2: '', sys: '', dia: '' });

    useEffect(() => {
        // Check if there is an active trip on mount
        fetchActiveTrip();
    }, []);

    useEffect(() => {
        if (activeTrip && !ws) {
            const newWs = new WebSocket(`ws://localhost:8000/ws/trip/${activeTrip.id}`);
            setWs(newWs);

            // Setup mock eta countdown interval
            const interval = setInterval(() => {
                setActiveTrip(prev => {
                    if (!prev || prev.status === 'ARRIVED') return prev;
                    const newEta = Math.max(0, prev.eta_minutes - 0.5); // countdown by 30s

                    // Send update to backend via WS
                    if (newWs.readyState === WebSocket.OPEN) {
                        newWs.send(JSON.stringify({ type: 'eta_update', eta: newEta }));
                    }

                    return { ...prev, eta_minutes: newEta };
                });
            }, 30000); // every 30s

            return () => {
                clearInterval(interval);
                newWs.close();
                setWs(null);
            };
        }
    }, [activeTrip, ws]);

    const fetchActiveTrip = async () => {
        try {
            const res = await api.get('/trips/driver');
            const active = res.data.find(t => t.status !== 'ARRIVED');
            if (active) setActiveTrip(active);
        } catch (err) {
            console.error(err);
        }
    };

    const handleCreateIncident = async (e) => {
        e.preventDefault();
        setLoading(true);
        try {
            // 1. Create Incident
            const res = await api.post('/incidents', {
                emergency_type: emergencyType,
                incident_lat: parseFloat(lat),
                incident_lng: parseFloat(lng),
                heart_rate: vitals.hr ? parseInt(vitals.hr) : null,
                spo2: vitals.spo2 ? parseInt(vitals.spo2) : null,
                bp_sys: vitals.sys ? parseInt(vitals.sys) : null,
                bp_dia: vitals.dia ? parseInt(vitals.dia) : null,
                affordability_pref: affordability === 'Any' ? null : parseInt(affordability)
            });
            const incident = res.data;

            // 2. Automatically get matches
            const matchRes = await api.get(`/incidents/${incident.id}/match`);
            setMatchedHospitals(matchRes.data.map(m => ({ ...m, incident_id: incident.id })));
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    const selectHospital = async (match) => {
        setLoading(true);
        try {
            // fetch ambulance driver's ambulance id to create trip
            const driverRes = await api.get('/users/me'); // Just to get user
            // We need an endpoint or payload modification to attach ambulance_id, 
            // but for demo, let's assume ambulance_id = 1 for driver1. (Seeded Data)

            const tripRes = await api.post('/trips', {
                incident_id: match.incident_id,
                ambulance_id: 1, // hardcoded for demo driver 1
                selected_hospital_id: match.hospital.id,
                eta_minutes: match.eta_min,
                distance_km: match.dist_km
            });
            setActiveTrip(tripRes.data);
            setMatchedHospitals([]);
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    const requestPriority = async () => {
        if (!activeTrip) return;
        try {
            const res = await api.post(`/trips/${activeTrip.id}/priority`);
            setActiveTrip({ ...activeTrip, signal_priority_active: true, eta_minutes: res.data.new_eta });
        } catch (err) {
            console.error(err);
        }
    };

    const handleLocateMe = () => {
        if ("geolocation" in navigator) {
            navigator.geolocation.getCurrentPosition(
                (position) => {
                    setLat(position.coords.latitude.toFixed(5));
                    setLng(position.coords.longitude.toFixed(5));
                },
                (error) => {
                    console.error("Error getting location:", error);
                    alert("Could not get your location. Please ensure location services are enabled.");
                },
                { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
            );
        } else {
            alert("Geolocation is not supported by your browser.");
        }
    };

    const markArrived = async () => {
        if (!activeTrip) return;
        try {
            await api.post(`/trips/${activeTrip.id}/arrive`);
            setActiveTrip(null);
            if (ws) {
                ws.close();
                setWs(null);
            }
        } catch (err) {
            console.error(err);
        }
    };

    return (
        <div>
            <header className="app-header">
                <div className="brand">
                    <Activity size={24} color="#ffb703" />
                    PRANA | Driver Portal
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                    <span className="badge badge-info" style={{ marginRight: '1rem' }}>Unit Alpha</span>
                    <span style={{ fontSize: '0.9rem' }}>{user?.email}</span>
                    <button onClick={logout} className="btn btn-outline" style={{ padding: '0.4rem 1rem' }}>Logout</button>
                </div>
            </header>

            <div className="container" style={{ padding: '2rem 0' }}>
                {!activeTrip && matchedHospitals.length === 0 && (
                    <div className="grid-2">
                        <div className="card glass-panel" style={{ gridColumn: '1 / -1', maxWidth: '800px', margin: '0 auto' }}>
                            <div className="card-header">
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                    <Zap size={20} /> Create Emergency Incident
                                </div>
                            </div>
                            <form onSubmit={handleCreateIncident}>
                                <div className="grid-2" style={{ gap: '1rem' }}>
                                    <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                                            <label className="form-label" style={{ margin: 0 }}>Location (Click map or use GPS)</label>
                                            <button type="button" onClick={handleLocateMe} className="btn btn-outline" style={{ padding: '0.25rem 0.5rem', fontSize: '0.8rem' }}>
                                                📍 Locate Me
                                            </button>
                                        </div>
                                        <MapContainer center={[12.9716, 77.5946]} zoom={11} scrollWheelZoom={true} style={{ height: '300px', width: '100%', borderRadius: '8px', zIndex: 1 }}>
                                            <TileLayer
                                                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                                                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                                            />
                                            <LocationPicker lat={lat} lng={lng} setLat={setLat} setLng={setLng} />
                                            {matchedHospitals.map(m => (
                                                <React.Fragment key={m.hospital.id}>
                                                    <Marker position={[m.hospital.lat, m.hospital.lng]}>
                                                        <Popup>
                                                            <strong>{m.hospital.name}</strong><br />
                                                            Score: {m.score.toFixed(1)}<br />
                                                            ETA: {m.eta_min.toFixed(1)} min
                                                        </Popup>
                                                    </Marker>
                                                    <Polyline
                                                        positions={[
                                                            [parseFloat(lat), parseFloat(lng)],
                                                            [m.hospital.lat, m.hospital.lng]
                                                        ]}
                                                        color={m.score > 80 ? "var(--success)" : "var(--primary-light)"}
                                                        weight={3}
                                                        opacity={0.6}
                                                        dashArray="5, 10"
                                                    />
                                                </React.Fragment>
                                            ))}
                                        </MapContainer>
                                        <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem' }}>
                                            <input type="text" className="form-input" value={lat} readOnly placeholder="Lat" />
                                            <input type="text" className="form-input" value={lng} readOnly placeholder="Lng" />
                                        </div>
                                    </div>
                                    <div className="form-group">
                                        <label className="form-label">Emergency Type</label>
                                        <select className="form-select" value={emergencyType} onChange={e => setEmergencyType(e.target.value)}>
                                            <option value="Cardiac">Cardiac</option>
                                            <option value="Trauma">Trauma</option>
                                            <option value="Stroke">Stroke</option>
                                            <option value="Respiratory">Respiratory</option>
                                            <option value="General">General</option>
                                        </select>
                                    </div>
                                </div>

                                <div className="form-group" style={{ marginTop: '1rem' }}>
                                    <label className="form-label">Affordability Preference</label>
                                    <div style={{ display: 'flex', gap: '1rem' }}>
                                        {['Any', '1', '2', '3'].map(tier => (
                                            <label key={tier} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
                                                <input type="radio" name="affordability" checked={affordability === tier} onChange={() => setAffordability(tier)} />
                                                {tier === 'Any' ? 'Any' : `Tier ${tier}`}
                                            </label>
                                        ))}
                                    </div>
                                </div>

                                <div style={{ marginTop: '2rem' }}>
                                    <label className="form-label">Patient Vitals (Optional)</label>
                                    <div className="grid-2" style={{ gap: '1rem', marginTop: '0.5rem' }}>
                                        <input type="number" className="form-input" placeholder="Heart Rate" value={vitals.hr} onChange={e => setVitals({ ...vitals, hr: e.target.value })} />
                                        <input type="number" className="form-input" placeholder="SpO2 %" value={vitals.spo2} onChange={e => setVitals({ ...vitals, spo2: e.target.value })} />
                                    </div>
                                </div>

                                <div style={{ marginTop: '2rem', textAlign: 'right' }}>
                                    <button type="submit" className="btn btn-primary" disabled={loading} style={{ width: '100%', padding: '1rem', fontSize: '1.1rem' }}>
                                        {loading ? 'Finding Hospitals...' : 'Analyze & Find Hospitals'}
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                )}

                {!activeTrip && matchedHospitals.length > 0 && (
                    <div>
                        <h2 style={{ marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <CheckCircle color="var(--success)" /> Intelligent Hospital Matches
                        </h2>
                        <p style={{ color: 'var(--text-muted)', marginBottom: '2rem' }}>
                            Ranked based on emergency type, ETA, bed availability, and affordability criteria.
                        </p>
                        <div className="grid-3" style={{ gap: '2rem' }}>
                            {matchedHospitals.map((match, idx) => (
                                <div key={match.hospital.id} className="card glass-panel" style={{ position: 'relative', overflow: 'hidden' }}>
                                    {idx === 0 && (
                                        <div style={{ position: 'absolute', top: 0, right: 0, background: 'var(--success)', color: 'white', padding: '0.2rem 1rem', fontSize: '0.8rem', fontWeight: 'bold', borderBottomLeftRadius: '8px' }}>
                                            BEST MATCH
                                        </div>
                                    )}
                                    <h3 style={{ fontSize: '1.2rem', marginBottom: '1rem', marginTop: idx === 0 ? '1rem' : '0' }}>{match.hospital.name}</h3>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem' }}>
                                        <div>
                                            <div style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>ETA / Distance</div>
                                            <div style={{ fontWeight: 600, fontSize: '1.1rem', color: 'var(--accent)' }}>{match.eta_min.toFixed(1)} mins ({match.dist_km.toFixed(1)} km)</div>
                                        </div>
                                        <div style={{ textAlign: 'right' }}>
                                            <div style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>Map Route</div>
                                            <div style={{ fontWeight: 600 }}>{match.route_type.toUpperCase()}</div>
                                        </div>
                                    </div>

                                    <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
                                        <span className="badge badge-info">Tier {match.hospital.affordability_tier}</span>
                                        <span className="badge" style={{ background: 'rgba(255,255,255,0.1)' }}>{match.hospital.icu_beds} ICU Beds</span>
                                        {match.hospital.has_cardiology && <span className="badge" style={{ background: 'rgba(255,255,255,0.1)' }}>Cardio</span>}
                                        {match.hospital.has_trauma && <span className="badge" style={{ background: 'rgba(255,255,255,0.1)' }}>Trauma</span>}
                                    </div>

                                    <div style={{ background: 'rgba(0,0,0,0.2)', padding: '1rem', borderRadius: '8px', marginBottom: '1.5rem', fontSize: '0.9rem', borderLeft: '3px solid var(--primary-light)' }}>
                                        <strong>Why selected: </strong> {match.explanation}
                                        <div style={{ marginTop: '0.5rem', color: 'var(--text-muted)', fontSize: '0.8rem' }}>Match Score: {match.score.toFixed(1)}/100</div>
                                    </div>

                                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                                        <button onClick={() => selectHospital(match)} className="btn btn-primary" style={{ flex: 1 }} disabled={loading}>
                                            Dispatch <ArrowRight size={18} />
                                        </button>
                                        <a
                                            href={`https://www.google.com/maps/dir/?api=1&origin=${lat},${lng}&destination=${match.hospital.lat},${match.hospital.lng}`}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="btn btn-outline"
                                            style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 1rem' }}
                                            title="Open in Google Maps"
                                        >
                                            📍 Maps
                                        </a>
                                    </div>
                                </div>
                            ))}
                        </div>
                        <div style={{ marginTop: '2rem', textAlign: 'center' }}>
                            <button onClick={() => setMatchedHospitals([])} className="btn btn-outline">Cancel & Restart</button>
                        </div>
                    </div>
                )}

                {activeTrip && (
                    <div className="grid-2">
                        {/* Navigation View */}
                        <div className="card glass-panel" style={{ display: 'flex', flexDirection: 'column' }}>
                            <div className="card-header">
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                    <Navigation size={20} /> Active Route Navigation
                                </div>
                                <span className={`badge ${activeTrip.status === 'ACKNOWLEDGED' ? 'badge-success' : 'badge-warning'}`}>
                                    {activeTrip.status}
                                </span>
                            </div>

                            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '2rem 0' }}>
                                <Clock size={48} color={activeTrip.eta_minutes < 5 ? '#ff4d6d' : 'var(--primary-light)'} style={{ marginBottom: '1rem' }} />
                                <div style={{ fontSize: '4rem', fontWeight: 700, lineHeight: 1, color: activeTrip.eta_minutes < 5 ? '#ff4d6d' : 'white' }}>
                                    {Math.max(0, activeTrip.eta_minutes).toFixed(1)}
                                </div>
                                <div style={{ fontSize: '1.2rem', color: 'var(--text-muted)' }}>Minutes to Arrival</div>

                                <div style={{ marginTop: '2rem', display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-muted)' }}>
                                    <Activity size={16} /> Hospital ID: {activeTrip.selected_hospital_id}
                                </div>
                            </div>

                            <div style={{ display: 'flex', gap: '1rem', marginTop: '1rem' }}>
                                <button
                                    onClick={requestPriority}
                                    disabled={activeTrip.signal_priority_active}
                                    className={`btn ${activeTrip.signal_priority_active ? 'btn-success' : 'btn-accent'}`}
                                    style={{ flex: 1 }}
                                >
                                    {activeTrip.signal_priority_active ? 'Green Corridor Active' : 'Request Green Corridor'}
                                </button>
                                <button onClick={markArrived} className="btn btn-danger" style={{ flex: 1 }}>
                                    Mark Arrived
                                </button>
                            </div>
                        </div>

                        {/* Trip Details & Timeline */}
                        <div className="card glass-panel" style={{ display: 'flex', flexDirection: 'column' }}>
                            <div className="card-header">Trip Timeline</div>
                            <div style={{ flex: 1, padding: '1rem 0' }}>
                                <div style={{ position: 'relative', paddingLeft: '20px', borderLeft: '2px solid var(--border-color)', marginBottom: '1.5rem' }}>
                                    <div style={{ position: 'absolute', left: '-6px', top: '0', width: '10px', height: '10px', borderRadius: '50%', background: 'var(--primary-light)' }}></div>
                                    <div style={{ fontSize: '0.9rem', color: 'var(--text-muted)', marginBottom: '0.2rem' }}>Just Now</div>
                                    <div style={{ fontWeight: 600 }}>Emergency Dispatched</div>
                                    <div style={{ fontSize: '0.9rem' }}>En route to incident/hospital.</div>
                                </div>

                                {activeTrip.status === 'ACKNOWLEDGED' && (
                                    <div style={{ position: 'relative', paddingLeft: '20px', borderLeft: '2px solid var(--border-color)', marginBottom: '1.5rem' }}>
                                        <div style={{ position: 'absolute', left: '-6px', top: '0', width: '10px', height: '10px', borderRadius: '50%', background: 'var(--success)' }}></div>
                                        <div style={{ fontSize: '0.9rem', color: 'var(--text-muted)', marginBottom: '0.2rem' }}>Recent</div>
                                        <div style={{ fontWeight: 600 }}>Hospital Acknowledged</div>
                                        <div style={{ fontSize: '0.9rem' }}>Hospital staff has seen the alert and is preparing.</div>
                                    </div>
                                )}

                                {activeTrip.signal_priority_active && (
                                    <div style={{ position: 'relative', paddingLeft: '20px', borderLeft: '2px solid var(--border-color)', marginBottom: '1.5rem' }}>
                                        <div style={{ position: 'absolute', left: '-6px', top: '0', width: '10px', height: '10px', borderRadius: '50%', background: 'var(--accent)' }}></div>
                                        <div style={{ fontSize: '0.9rem', color: 'var(--text-muted)', marginBottom: '0.2rem' }}>System</div>
                                        <div style={{ fontWeight: 600 }}>Traffic Priority Enabled</div>
                                        <div style={{ fontSize: '0.9rem' }}>Signals along route forced to green.</div>
                                    </div>
                                )}

                                <div style={{ position: 'relative', paddingLeft: '20px', borderLeft: '2px dashed var(--border-color)' }}>
                                    <div style={{ position: 'absolute', left: '-6px', top: '0', width: '10px', height: '10px', borderRadius: '50%', background: 'var(--border-color)', border: '2px solid var(--bg-panel)' }}></div>
                                    <div style={{ fontSize: '0.9rem', color: 'var(--text-muted)', marginBottom: '0.2rem' }}>Upcoming</div>
                                    <div style={{ fontWeight: 600, color: 'var(--text-muted)' }}>Arrival at Hospital</div>
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default AmbulancePortal;
