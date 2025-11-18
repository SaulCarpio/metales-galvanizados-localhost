import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import './ForgotPassword.css';

function ForgotPassword() {
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);

  const handleRequestCode = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMessage('');
    const cleanEmail = email.trim().toLowerCase();
    try {
      const res = await fetch('http://localhost:5000/api/request-password-reset', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: cleanEmail })
      });
      const data = await res.json();
      if (data.success) {
        setStep(2);
        setMessage('Código enviado a tu correo.');
      } else {
        setMessage(data.message);
      }
    } catch (err) {
      setMessage('Error de conexión.');
    }
    setLoading(false);
  };

  const handleResetPassword = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMessage('');
    const cleanEmail = email.trim().toLowerCase();
    try {
      const res = await fetch('http://localhost:5000/api/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: cleanEmail, code, new_password: newPassword })
      });
      const data = await res.json();
      if (data.success) {
        setMessage('Contraseña restablecida correctamente.');
        setStep(3);
      } else {
        setMessage(data.message);
      }
    } catch (err) {
      setMessage('Error de conexión.');
    }
    setLoading(false);
  };

  return (
    <div className="forgot-password-container">
      <h2>Restablecer Contraseña</h2>
      {step === 1 && (
        <form onSubmit={handleRequestCode}>
          <label>Correo electrónico</label>
          <input type="email" value={email} onChange={e => setEmail(e.target.value)} required />
          <button type="submit" disabled={loading}>{loading ? 'Enviando...' : 'Enviar código'}</button>
        </form>
      )}
      {step === 2 && (
        <form onSubmit={handleResetPassword}>
          <label>Código recibido</label>
          <input type="text" value={code} onChange={e => setCode(e.target.value)} required />
          <label>Nueva contraseña</label>
          <input type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} required />
          <button type="submit" disabled={loading}>{loading ? 'Restableciendo...' : 'Restablecer'}</button>
        </form>
      )}
      {step === 3 && (
        <div className="success-message">
          ¡Listo! Ahora puedes iniciar sesión con tu nueva contraseña.<br />
          <button style={{marginTop: '1.2rem'}} onClick={() => navigate('/login')}>
            Ir al Login
          </button>
        </div>
      )}
      {message && <div className="message">{message}</div>}
    </div>
  );
}

export default ForgotPassword;
