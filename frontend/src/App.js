import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';

import Login from './components/Login';
import Dashboard from './components/Dashboard';
import AccessDenied from './components/AccessDenied';
import ForgotPassword from './components/ForgotPassword';
import ProtectedRoute from './components/ProtectedRoute';

import './App.css';

const InitialRedirect = () => {
  const { auth } = useAuth();
  return auth.isAuthenticated 
    ? <Navigate to="/dashboard" replace /> 
    : <Navigate to="/login" replace />;
};

function App() {
  return (
    <AuthProvider>
      <Router>
        <div className="App">
          <Routes>
            {/* Rutas Públicas */}
            <Route path="/login" element={<Login />} />
            <Route path="/forgot-password" element={<ForgotPassword />} />
            <Route path="/access-denied" element={<AccessDenied />} />

            {/* Rutas Protegidas */}
            <Route element={<ProtectedRoute />}>
              <Route path="/dashboard" element={<Dashboard />} />
            </Route>

            {/* Rutas por Defecto y Redirecciones */}
            <Route path="/" element={<InitialRedirect />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </div>
      </Router>
    </AuthProvider>
  );
}

export default App;