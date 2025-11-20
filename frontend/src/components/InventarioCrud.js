import React, { useEffect, useState } from 'react';
import { inventarioAPI, proveedoresAPI } from '../utils/api';
import './UserCrud.css';

const InventarioCrud = () => {
  const [items, setItems] = useState([]);
  const [form, setForm] = useState({ producto_id: '', sucursal_id: '', cantidad: 0, estado: 'disponible' });

  useEffect(() => { fetchData(); }, []);
  const fetchData = async () => {
    try {
      const res = await inventarioAPI.list();
      if (res.data.success) setItems(res.data.inventario);
    } catch (e) { console.error(e); }
  };

  const handleChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });
  const handleCreate = async (e) => {
  e.preventDefault();

  // Validar IDs
  if (!form.producto_id || !form.sucursal_id) {
    alert("Producto y Sucursal son obligatorios");
    return;
  }

  const payload = { 
    ...form, 
    producto_id: Number(form.producto_id), 
    sucursal_id: Number(form.sucursal_id), 
    cantidad: Number(form.cantidad || 0)
  };

  try {
    const res = await inventarioAPI.create(payload);
    if (res.data.success) {
      fetchData();
      setForm({ producto_id: '', sucursal_id: '', cantidad: 0, estado: 'disponible' });
    } else {
      alert(res.data.message || "Error al crear registro");
    }
  } catch (err) {
    console.error(err);
    alert("Error en la comunicación con el servidor");
  }
};


  return (
    <div className="user-crud-container">
      <h2>Inventario (Control de existencias)</h2>
      <form onSubmit={handleCreate} className="user-form">
        <input name="producto_id" value={form.producto_id} onChange={handleChange} placeholder="ID producto" required />
        <input name="sucursal_id" value={form.sucursal_id} onChange={handleChange} placeholder="ID sucursal" required />
        <input type="number" name="cantidad" value={form.cantidad} onChange={handleChange} placeholder="Cantidad" />
        <select name="estado" value={form.estado} onChange={handleChange}>
          <option value="disponible">disponible</option>
          <option value="en_produccion">en_produccion</option>
          <option value="sellado">sellado</option>
        </select>
        <button type="submit">Crear registro</button>
      </form>

      <hr />

      <table className="user-table">
        <thead><tr><th>ID</th><th>Producto</th><th>Sucursal</th><th>Cantidad</th><th>Estado</th><th>Últ. mov.</th></tr></thead>
        <tbody>
          {items.map(i => (
            <tr key={i.id}>
              <td>{i.id}</td>
              <td>{i.producto_id}</td>
              <td>{i.sucursal_id}</td>
              <td>{i.cantidad}</td>
              <td>{i.estado}</td>
              <td>{i.ultimo_movimiento}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default InventarioCrud;
