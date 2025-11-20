import React, { useEffect, useState } from 'react';
import { proveedoresAPI } from '../utils/api';
import './UserCrud.css';

const ProveedorCrud = () => {
  const [proveedores, setProveedores] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [form, setForm] = useState({ nombre: '', contacto: '', telefono: '', direccion: '', datos_extra: '' });

  useEffect(() => { fetchProveedores(); }, []);

  const fetchProveedores = async () => {
    setLoading(true); setError('');
    try {
      const res = await proveedoresAPI.list();
      if (res.data.success) setProveedores(res.data.proveedores);
      else setError('Error cargando proveedores');
    } catch (e) { setError('Error de conexión'); }
    setLoading(false);
  };

  const handleChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  const handleCreate = async (e) => {
    e.preventDefault();
    try {
      const payload = { ...form };
      // intentar parsear datos_extra si es JSON
      try { payload.datos_extra = payload.datos_extra ? JSON.parse(payload.datos_extra) : null; } catch { payload.datos_extra = null; }
      const res = await proveedoresAPI.create(payload);
      if (res.data.success) { fetchProveedores(); setForm({ nombre: '', contacto: '', telefono: '', direccion: '', datos_extra: '' }); }
      else setError(res.data.message || 'Error creando proveedor');
    } catch (err) { setError('Error de conexión: ' + (err.message || '')); }
  };

  const handleDelete = async (id) => {
    try { await proveedoresAPI.delete(id); fetchProveedores(); } catch (err) { setError('Error al eliminar'); }
  };

  return (
    <div className="user-crud-container">
      <h2>Proveedores</h2>
      <form onSubmit={handleCreate} className="user-form">
        <input name="nombre" value={form.nombre} onChange={handleChange} placeholder="Nombre" required />
        <input name="contacto" value={form.contacto} onChange={handleChange} placeholder="Contacto" />
        <input name="telefono" value={form.telefono} onChange={handleChange} placeholder="Teléfono" />
        <input name="direccion" value={form.direccion} onChange={handleChange} placeholder="Dirección" />
        <input name="datos_extra" value={form.datos_extra} onChange={handleChange} placeholder='datos_extra (JSON opcional)' />
        <button type="submit">Crear proveedor</button>
      </form>

      {error && <div className="error-message">{error}</div>}

      <table className="user-table">
        <thead>
          <tr><th>ID</th><th>Nombre</th><th>Contacto</th><th>Teléfono</th><th>Dirección</th><th>Acciones</th></tr>
        </thead>
        <tbody>
          {proveedores.map(p => (
            <tr key={p.id}>
              <td>{p.id}</td>
              <td>{p.nombre}</td>
              <td>{p.contacto}</td>
              <td>{p.telefono}</td>
              <td style={{maxWidth:200,overflow:'hidden',textOverflow:'ellipsis'}}>{p.direccion}</td>
              <td>
                <button onClick={() => navigator.clipboard.writeText(JSON.stringify(p))}>Copiar</button>
                <button onClick={() => handleDelete(p.id)} className="delete-btn">Borrar</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default ProveedorCrud;
