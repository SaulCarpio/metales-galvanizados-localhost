import React, { useEffect, useState } from 'react';
import { movimientosAPI, finanzasAPI } from '../utils/api';
import './UserCrud.css';

const MovimientosPagoCrud = () => {
  const [movs, setMovs] = useState([]);
  const [cuentas, setCuentas] = useState([]);
  const [form, setForm] = useState({ cuenta_pagar_id: '', monto: 0, metodo_pago_id: '', referencia_pago: '', nota: '' });

  useEffect(() => { fetchData(); }, []);
  const fetchData = async () => {
    try {
      const resM = await movimientosAPI.list();
      const resC = await finanzasAPI.listCuentasPagar();
      if (resM.data.success) setMovs(resM.data.movimientos);
      if (resC.data.success) setCuentas(resC.data.cuentas_pagar);
    } catch (e) { console.error(e); }
  };

  const handleChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });
  const handleCreate = async (e) => {
    e.preventDefault();
    try {
      const payload = { ...form, cuenta_pagar_id: form.cuenta_pagar_id ? Number(form.cuenta_pagar_id) : null, monto: Number(form.monto) };
      const res = await movimientosAPI.create(payload);
      if (res.data.success) { fetchData(); setForm({ cuenta_pagar_id: '', monto: 0, metodo_pago_id: '', referencia_pago: '', nota: '' }); }
    } catch (err) { console.error(err); }
  };

  return (
    <div className="user-crud-container">
      <h2>Movimientos de Pago</h2>
      <form onSubmit={handleCreate} className="user-form">
        <select name="cuenta_pagar_id" value={form.cuenta_pagar_id} onChange={handleChange}>
          <option value="">-- Asociar a cuenta pagar (opcional) --</option>
          {cuentas.map(c => <option value={c.id} key={c.id}>{c.referencia || ('Cuenta '+c.id)}</option>)}
        </select>
        <input type="number" name="monto" value={form.monto} onChange={handleChange} placeholder="Monto" required />
        <input name="metodo_pago_id" value={form.metodo_pago_id} onChange={handleChange} placeholder="ID método pago (opcional)" />
        <input name="referencia_pago" value={form.referencia_pago} onChange={handleChange} placeholder="Referencia pago" />
        <input name="nota" value={form.nota} onChange={handleChange} placeholder="Nota" />
        <button type="submit">Registrar movimiento</button>
      </form>

      <hr />

      <table className="user-table">
        <thead><tr><th>ID</th><th>Cuenta Pagar</th><th>Monto</th><th>Fecha</th><th>Referencia</th><th>Nota</th></tr></thead>
        <tbody>
          {movs.map(m => (
            <tr key={m.id}>
              <td>{m.id}</td>
              <td>{m.cuenta_pagar_id}</td>
              <td>{m.monto}</td>
              <td>{m.fecha_pago}</td>
              <td>{m.referencia_pago}</td>
              <td>{m.nota}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default MovimientosPagoCrud;
