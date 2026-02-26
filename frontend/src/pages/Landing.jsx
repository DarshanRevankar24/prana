import React, { useState, useContext } from 'react';
import { AuthContext } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { Activity, ShieldPlus, ChevronRight } from 'lucide-react';

const Landing = () => {
    const { login } = useContext(AuthContext);
    const navigate = useNavigate();
    const [roleMode, setRoleMode] = useState(null); // 'driver', 'hospital', or null
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('prana123'); // Default for demo
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    const handleLogin = async (e) => {
        e.preventDefault();
        setError('');
        setLoading(true);
        try {
            const user = await login(email, password);
            if (user.role === 'AMBULANCE_DRIVER') {
                navigate('/driver');
            } else if (user.role === 'HOSPITAL_STAFF') {
                navigate('/hospital');
            }
        } catch (err) {
            setError('Invalid credentials. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    const setDemoCredentials = (role) => {
        if (role === 'driver') setEmail('driver1@prana.demo');
        if (role === 'hospital') setEmail('hospital1@prana.demo');
        setPassword('prana123');
    };

    if (roleMode) {
        return (
            <div className="landing-container">
                <div className="container" style={{ maxWidth: '500px', margin: '0 auto' }}>
                    <div className="glass-panel" style={{ padding: '3rem 2rem', textAlign: 'center' }}>
                        <div style={{ marginBottom: '2rem' }}>
                            <h1 className="brand" style={{ justifyContent: 'center', marginBottom: '0.5rem' }}>
                                {roleMode === 'driver' ? <Activity size={32} color="#ffb703" /> : <ShieldPlus size={32} color="#00b4d8" />}
                                PRANA
                            </h1>
                            <p style={{ color: 'var(--text-muted)' }}>
                                {roleMode === 'driver' ? 'Ambulance Driver Portal' : 'Hospital Management Portal'}
                            </p>
                        </div>

                        <form onSubmit={handleLogin} style={{ textAlign: 'left' }}>
                            <div className="form-group">
                                <label className="form-label">Email Address</label>
                                <input
                                    type="email"
                                    className="form-input"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    placeholder="Enter your email"
                                    required
                                />
                            </div>
                            <div className="form-group">
                                <label className="form-label">Password</label>
                                <input
                                    type="password"
                                    className="form-input"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    placeholder="Enter your password"
                                    required
                                />
                            </div>

                            {error && <div style={{ color: 'var(--danger)', marginBottom: '1rem', fontSize: '0.9rem' }}>{error}</div>}

                            <button type="submit" className="btn btn-primary" style={{ width: '100%', marginBottom: '1rem' }} disabled={loading}>
                                {loading ? 'Authenticating...' : 'Sign In'} <ChevronRight size={18} />
                            </button>

                            <button
                                type="button"
                                className="btn btn-outline"
                                style={{ width: '100%' }}
                                onClick={() => setRoleMode(null)}
                            >
                                Back to Role Selection
                            </button>
                        </form>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="landing-container">
            <div className="container" style={{ textAlign: 'center' }}>
                <h1 className="brand" style={{ justifyContent: 'center', fontSize: '4rem', marginBottom: '1rem' }}>
                    <Activity size={64} color="#ffb703" />
                    PRANA
                </h1>
                <p style={{ fontSize: '1.2rem', color: 'var(--text-muted)', maxWidth: '600px', margin: '0 auto 4rem auto' }}>
                    Predictive Response & Ambulance Hospital Network for Actions.
                    Unifying emergency response with intelligent routing and hospital matching.
                </p>

                <div className="grid-2" style={{ maxWidth: '800px', margin: '0 auto' }}>
                    <div
                        className="glass-panel"
                        style={{ padding: '3rem 2rem', cursor: 'pointer', transition: 'all 0.3s' }}
                        onClick={() => {
                            setRoleMode('driver');
                            setDemoCredentials('driver');
                        }}
                    >
                        <Activity size={48} color="#ffb703" style={{ marginBottom: '1.5rem' }} />
                        <h2 style={{ marginBottom: '1rem' }}>Ambulance Driver</h2>
                        <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>
                            Access intelligent dispatch, real-time routing, and explainable hospital matching.
                        </p>
                    </div>

                    <div
                        className="glass-panel"
                        style={{ padding: '3rem 2rem', cursor: 'pointer', transition: 'all 0.3s' }}
                        onClick={() => {
                            setRoleMode('hospital');
                            setDemoCredentials('hospital');
                        }}
                    >
                        <ShieldPlus size={48} color="#00b4d8" style={{ marginBottom: '1.5rem' }} />
                        <h2 style={{ marginBottom: '1rem' }}>Hospital Staff</h2>
                        <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>
                            Manage incoming emergencies, prepare resources pre-arrival, and update bed capacity.
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Landing;
