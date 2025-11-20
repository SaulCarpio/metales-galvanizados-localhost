import React, { useEffect, useState } from 'react';
import { finanzasAPI, proveedoresAPI } from '../utils/api';
import './UserCrud.css';

const CuentasPagarCrud = () => {
  const [cuentas, setCuentas] = useState([]);
  const [proveedores, setProveedores] = useState([]);
  const [form, setForm] = useState({ proveedor_id: '', referencia: '', monto_total: 0, fecha_vencimiento: '', descripcion: '' });

  useEffect(() => { fetchData(); }, []);
  const fetchData = async () => {
    try {
      const [resC, resP] = await Promise.all([finanzasAPI.listCuentasPagar(), proveedoresAPI.list()]);
      if (resC.data.success) setCuentas(resC.data.cuentas_pagar);
      if (resP.data.success) setProveedores(resP.data.proveedores);
    } catch (e) { console.error(e); }
  };

  const handleChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });
  const handleCreate = async (e) => {
    e.preventDefault();
    try {
      const payload = { ...form, proveedor_id: Number(form.proveedor_id) };
      const res = await finanzasAPI.createCuentaPagar(payload);
      if (res.data.success) { fetchData(); setForm({ proveedor_id: '', referencia: '', monto_total: 0, fecha_vencimiento: '', descripcion: '' }); }
    } catch (err) { console.error(err); }
  };

  return (
    <div className="user-crud-container">
      <h2>Cuentas por Pagar</h2>
      <form onSubmit={handleCreate} className="user-form">
        <select name="proveedor_id" value={form.proveedor_id} onChange={handleChange} required>
          <option value="">-- Seleccionar proveedor --</option>
          {proveedores.map(p => <option value={p.id} key={p.id}>{p.nombre}</option>)}
        </select>
        <input name="referencia" value={form.referencia} onChange={handleChange} placeholder="Referencia" />
        <input type="number" name="monto_total" value={form.monto_total} onChange={handleChange} placeholder="Monto total" />
        <input name="fecha_vencimiento" value={form.fecha_vencimiento} onChange={handleChange} placeholder="Fecha vencimiento (YYYY-MM-DD)" />
        <input name="descripcion" value={form.descripcion} onChange={handleChange} placeholder="Descripción" />
        <button type="submit">Crear cuenta</button>
      </form>

      <hr />

      <table className="user-table">
        <thead><tr><th>ID</th><th>Proveedor</th><th>Referencia</th><th>Monto</th><th>Pagado</th><th>Vencimiento</th><th>Estado</th></tr></thead>
        <tbody>
          {cuentas.map(c => (
            <tr key={c.id}>
              <td>{c.id}</td>
              <td>{proveedores.find(p=>p.id===c.proveedor_id)?.nombre || c.proveedor_id}</td>
              <td>{c.referencia}</td>
              <td>{c.monto_total}</td>
              <td>{c.monto_pagado}</td>
              <td>{c.fecha_vencimiento}</td>
              <td>{c.estado}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default CuentasPagarCrud;
