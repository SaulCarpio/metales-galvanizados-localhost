import React, { useEffect, useState } from 'react';
import { authAPI } from '../utils/api';
import './Dashboard.css';
import './UserCrud.css';
const UserCrud = () => {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [newUser, setNewUser] = useState({ email: '', role: 'usuario' });
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await authAPI.getUsers();
      if (res.data.success) {
        setUsers(res.data.users);
      } else {
        setError('Error al cargar usuarios');
      }
    } catch {
      setError('Error de conexión');
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (e) => {
    setNewUser({ ...newUser, [e.target.name]: e.target.value });
  };

  const handleCreateUser = async (e) => {
    e.preventDefault();
    setCreating(true);
    setError('');
    try {
      const res = await authAPI.createUser(newUser);
      if (res.data.success) {
        fetchUsers();
        setNewUser({ email: '', role: 'usuario' });
      } else {
        setError(res.data.message || 'Error al crear usuario');
      }
    } catch (error) {
      if (error.response && error.response.data && error.response.data.message) {
        setError('Error de conexión: ' + error.response.data.message);
      } else {
        setError('Error de conexión: ' + (error.message || 'Error desconocido'));
      }
    } finally {
      setCreating(false);
    }
  };

  const handleToggleUser = async (id) => {
    await authAPI.toggleUser(id);
    fetchUsers();
  };

  const handleDeleteUser = async (id) => {
    setError('');
    try {
      await authAPI.deleteUser(id);
      fetchUsers();
    } catch (err) {
      if (err.response && err.response.data && err.response.data.message) {
        setError('Error al borrar usuario: ' + err.response.data.message);
      } else {
        setError('Error al borrar usuario: ' + (err.message || 'Error desconocido'));
      }
    }
  };

  return (
    <div className="user-crud-container">
      <h2>Gestión de Usuarios</h2>
      <form onSubmit={handleCreateUser} className="user-form">
        <input
          type="email"
          name="email"
          value={newUser.email}
          onChange={handleInputChange}
          placeholder="Correo electrónico"
          required
        />
        <select name="role" value={newUser.role} onChange={handleInputChange}>
          <option value="admin">Admin</option>
          <option value="usuario">Usuario</option>
        </select>
        <button type="submit" disabled={creating}>
          {creating ? 'Creando...' : 'Crear usuario'}
        </button>
      </form>
      {error && <div className="error-message">{error}
        {error.includes('Error de red') && (
          <div style={{marginTop: '10px', color: '#888', fontSize: '13px'}}>
            Verifica que el backend esté corriendo y la URL en <b>src/utils/api.js</b> apunte al backend correcto.<br />
            Si usas otra IP, cambia 'localhost' por la IP local del backend.
          </div>
        )}
      </div>}
      <table className="user-table">
        <thead>
          <tr>
            <th>ID</th>
            <th>Usuario</th>
            <th>Email</th>
            <th>Rol</th>
            <th>Estado</th>
            <th>Acciones</th>
          </tr>
        </thead>
        <tbody>
          {users.map((u) => (
            <tr key={u.id}>
              <td>{u.id}</td>
              <td>{u.username}</td>
              <td>{u.email}</td>
              <td>{u.role}</td>
              <td>{u.is_active ? 'Activo' : 'Deshabilitado'}</td>
              <td>
                <button onClick={() => handleToggleUser(u.id)}>
                  {u.is_active ? 'Deshabilitar' : 'Habilitar'}
                </button>
                <button onClick={() => handleDeleteUser(u.id)} className="delete-btn">
                  Borrar
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default UserCrud;
