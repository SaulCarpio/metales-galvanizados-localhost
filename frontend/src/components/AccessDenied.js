import React from 'react';
import { useNavigate } from 'react-router-dom';
import './Login.css';

const AccessDenied = () => {
  const navigate = useNavigate();
  return (
    <div className="login-container">
      <div className="login-form">
        <div className="login-header">
          <h1>Acceso Denegado</h1>
          <p>No tienes permisos para ver esta página. Por favor inicia sesión.</p>
        </div>
        <button onClick={() => navigate('/login', { replace: true })} className="logout-button">
          Ir al Login
        </button>
      </div>
    </div>
  );
};

export default AccessDenied;
