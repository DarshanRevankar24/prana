import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, AuthContext } from './context/AuthContext';
import Landing from './pages/Landing';
import AmbulancePortal from './pages/AmbulancePortal';
import HospitalPortal from './pages/HospitalPortal';
import './index.css';

const ProtectedRoute = ({ children, allowedRole }) => {
  const { user, token } = React.useContext(AuthContext);

  if (!token) return <Navigate to="/" />;
  if (allowedRole && user.role !== allowedRole) {
    return <Navigate to="/" />;
  }
  return children;
};

const AppRoutes = () => {
  return (
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route
        path="/driver"
        element={
          <ProtectedRoute allowedRole="AMBULANCE_DRIVER">
            <AmbulancePortal />
          </ProtectedRoute>
        }
      />
      <Route
        path="/hospital"
        element={
          <ProtectedRoute allowedRole="HOSPITAL_STAFF">
            <HospitalPortal />
          </ProtectedRoute>
        }
      />
    </Routes>
  );
};

const App = () => {
  return (
    <AuthProvider>
      <Router>
        <AppRoutes />
      </Router>
    </AuthProvider>
  );
}

export default App;
