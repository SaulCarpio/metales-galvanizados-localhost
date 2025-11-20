import React, { useEffect, useState } from 'react';
import { ordenesAPI, proveedoresAPI } from '../utils/api';
import './UserCrud.css';

const OrdenCompraCrud = () => {
  const [ordenes, setOrdenes] = useState([]);
  const [proveedores, setProveedores] = useState([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({ proveedor_id: '', referencia: '', estado: 'borrador', detalles: [] });

  useEffect(() => { fetchData(); }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [resO, resP] = await Promise.all([ordenesAPI.list(), proveedoresAPI.list()]);
      if (resO.data.success) setOrdenes(resO.data.ordenes);
      if (resP.data.success) setProveedores(resP.data.proveedores);
    } catch (e) { console.error(e); }
    setLoading(false);
  };

  const handleChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  const addDetalleRow = () => setForm({ ...form, detalles: [...form.detalles, { id: Date.now(), producto_id: '', cantidad: 1, precio_unitario: 0 }] });
  const updateDetalle = (id, field, value) => setForm({ ...form, detalles: form.detalles.map(d => d.id === id ? { ...d, [field]: value } : d) });
  const removeDetalle = (id) => setForm({ ...form, detalles: form.detalles.filter(d => d.id !== id) });

  const handleCreate = async (e) => {
    e.preventDefault();
    try {
      // preparar detalles para backend (sin id temporales)
      const detalles = form.detalles.map(d => ({ producto_id: d.producto_id, cantidad: Number(d.cantidad), precio_unitario: Number(d.precio_unitario) }));
      const payload = { proveedor_id: Number(form.proveedor_id), referencia: form.referencia, estado: form.estado, detalles };
      const res = await ordenesAPI.create(payload);
      if (res.data.success) { fetchData(); setForm({ proveedor_id: '', referencia: '', estado: 'borrador', detalles: [] }); }
    } catch (err) { console.error(err); }
  };

  const handleDelete = async (id) => { try { await ordenesAPI.delete(id); fetchData(); } catch (e) { console.error(e); } };

  return (
    <div className="user-crud-container">
      <h2>Órdenes de Compra</h2>
      <form onSubmit={handleCreate} className="user-form">
        <select name="proveedor_id" value={form.proveedor_id} onChange={handleChange} required>
          <option value="">-- Seleccionar proveedor --</option>
          {proveedores.map(p => <option value={p.id} key={p.id}>{p.nombre}</option>)}
        </select>
        <input name="referencia" value={form.referencia} onChange={handleChange} placeholder="Referencia" />
        <select name="estado" value={form.estado} onChange={handleChange}>
          <option value="borrador">Borrador</option>
          <option value="enviado">Enviado</option>
          <option value="recibido">Recibido</option>
          <option value="cancelado">Cancelado</option>
        </select>

        <div className="detalles-section">
          <h4>Detalles</h4>
          {form.detalles.map(d => (
            <div key={d.id} style={{display:'flex',gap:8,alignItems:'center'}}>
              <input placeholder="Producto ID" value={d.producto_id} onChange={(e) => updateDetalle(d.id, 'producto_id', e.target.value)} />
              <input type="number" placeholder="Cantidad" value={d.cantidad} onChange={(e) => updateDetalle(d.id, 'cantidad', e.target.value)} />
              <input type="number" placeholder="Precio unitario" value={d.precio_unitario} onChange={(e) => updateDetalle(d.id, 'precio_unitario', e.target.value)} />
              <button type="button" onClick={() => removeDetalle(d.id)} className="delete-btn">Eliminar</button>
            </div>
          ))}
          <button type="button" onClick={addDetalleRow}>+ Agregar detalle</button>
        </div>

        <button type="submit">Crear Orden</button>
      </form>

      <hr />

      <table className="user-table">
        <thead><tr><th>ID</th><th>Proveedor</th><th>Referencia</th><th>Fecha</th><th>Estado</th><th>Total</th><th>Acciones</th></tr></thead>
        <tbody>
          {ordenes.map(o => (
            <tr key={o.id}>
              <td>{o.id}</td>
              <td>{proveedores.find(p=>p.id===o.proveedor_id)?.nombre || o.proveedor_id}</td>
              <td>{o.referencia}</td>
              <td>{o.fecha}</td>
              <td>{o.estado}</td>
              <td>{o.total}</td>
              <td>
                <button onClick={() => navigator.clipboard.writeText(JSON.stringify(o))}>Copiar</button>
                <button onClick={() => handleDelete(o.id)} className="delete-btn">Borrar</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default OrdenCompraCrud;
