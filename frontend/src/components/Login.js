import React, { useState } from 'react'; // CORRECCIÓN 1: 'import' en lugar de 'inport'
import { useNavigate } from 'react-router-dom';
import { authAPI } from '../utils/api';
import { useAuth } from '../context/AuthContext';
import './Login.css';

const Login = () => {
  const [credentials, setCredentials] = useState({ username: '', password: '' });
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showChangeForm, setShowChangeForm] = useState(false);
  const [changeData, setChangeData] = useState({ new_username: '', new_password: '' });
  const [loginUser, setLoginUser] = useState('');
  
  const navigate = useNavigate();
  const { login } = useAuth();

  const handleChange = (e) => {
    setCredentials({ ...credentials, [e.target.name]: e.target.value });
    setError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    try {
      const response = await authAPI.login(credentials);
      if (response.data.success) {
        setLoginUser(credentials.username);
        login(credentials.username, response.data.role);

        if (response.data.change_required) {
          setShowChangeForm(true);
        } else {
          navigate('/', { replace: true });
        }
      } else {
        setError(response.data.message || 'Credenciales inválidas');
      }
    } catch (error) {
      setError(error.response?.data?.message || 'Error de conexión con el servidor');
    } finally {
      setIsLoading(false);
    }
  };
  
  const handleChangeForm = (e) => {
    setChangeData({ ...changeData, [e.target.name]: e.target.value });
    setError('');
  };

  const handleChangeSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');
    try {
      const response = await authAPI.changePassword({
        username: loginUser,
        new_username: changeData.new_username,
        new_password: changeData.new_password,
      });
      if (response.data.success) {
        login(changeData.new_username, localStorage.getItem('role'));
        setShowChangeForm(false);
        navigate('/', { replace: true });
      } else {
        setError(response.data.message || 'Error al cambiar usuario/contraseña');
      }
    } catch (error) { // CORRECCIÓN 2: Se añadió la llave de apertura '{'
      setError(error.response?.data?.message || 'Error de conexión con el servidor');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="login-container">
      <div className="login-form">
        <div className="login-header">
          <h1>METALES GALVANIZADOS Y ACEROS S.R.L.</h1>
          <p>Sistema de Gestión Logística</p>
        </div>
        {!showChangeForm ? (
          <form onSubmit={handleSubmit} className="login-form-content">
            <div className="form-group">
              <label htmlFor="username">Usuario</label>
              <input
                type="text"
                id="username"
                name="username"
                value={credentials.username}
                onChange={handleChange}
                placeholder="Ingrese su usuario"
                required
                disabled={isLoading}
              />
            </div>
            <div className="form-group">
              <label htmlFor="password">Contraseña</label>
              <input
                type="password"
                id="password"
                name="password"
                value={credentials.password}
                onChange={handleChange}
                placeholder="Ingrese su contraseña"
                required
                disabled={isLoading}
              />
            </div>
            {error && <div className="error-message">{error}</div>}
            <button
              type="submit"
              disabled={isLoading}
              className={isLoading ? 'loading' : ''}
            >
              {isLoading ? 'Iniciando sesión...' : 'Iniciar sesión'}
            </button>
          </form>
        ) : (
          <form onSubmit={handleChangeSubmit} className="login-form-content">
            <div className="form-group">
              <label htmlFor="new_username">Nuevo usuario</label>
              <input
                type="text"
                id="new_username"
                name="new_username"
                value={changeData.new_username}
                onChange={handleChangeForm}
                placeholder="Ingrese nuevo usuario"
                required
                disabled={isLoading}
              />
            </div>
            <div className="form-group">
              <label htmlFor="new_password">Nueva contraseña</label>
              <input
                type="password"
                id="new_password"
                name="new_password"
                value={changeData.new_password}
                onChange={handleChangeForm}
                placeholder="Ingrese nueva contraseña"
                required
                disabled={isLoading}
              />
            </div>
            {error && <div className="error-message">{error}</div>}
            <button
              type="submit"
              disabled={isLoading}
              className={isLoading ? 'loading' : ''}
            >
              {isLoading ? 'Guardando...' : 'Cambiar usuario y contraseña'}
            </button>
          </form>
        )}
        <div className="login-footer">
          <p>
            <a href="/forgot-password" style={{ color: '#3498db', textDecoration: 'underline', fontWeight: 500 }}>
              ¿Olvidaste tu contraseña?
            </a>
          </p>
          <p style={{ marginTop: 8 }}>¿Necesitas ayuda? Contacta al administrador</p>
        </div>
      </div>
    </div>
  );
};

export default Login;