import React, { useEffect, useState } from 'react';
import axios from 'axios';
import './Pedidos.css'; // Importa el archivo CSS

const API_BASE = process.env.REACT_APP_API_BASE || 'http://localhost:8080';

const initialFormState = {
  nroProforma: '',
  cliente: '',
  vendedor: '',
  fecha: '',
  producto: '',
  color: '',
  cantidad: '',
  longitud: '',
  precioUnitario: '',
  total: '',
};

const Pedidos = () => {
  const [list, setList] = useState([]);
  const [formData, setFormData] = useState(initialFormState);
  const [loading, setLoading] = useState(false);

  const fetchPedidos = async () => {
    setLoading(true);
    try {
      const r = await axios.get(`${API_BASE}/api/pedidos`);
      setList(r.data.pedidos || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPedidos();
  }, []);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSavePedido = async (e) => {
    e.preventDefault();
    try {
      // Adapta la estructura de 'formData' a lo que tu API espera
      const pedidoData = {
        cliente_id: formData.cliente, // Asumiendo que 'cliente' es el ID
        estado: 'pendiente',
        prioridad: 'normal',
        total: formData.total,
        detalles: [
          {
            // Asume que tienes una forma de obtener el ID del producto
            producto_id: formData.producto,
            cantidad: formData.cantidad,
            subtotal: formData.total, // O como lo calcules
          },
        ],
      };
      await axios.post(`${API_BASE}/api/pedidos`, pedidoData);
      setFormData(initialFormState);
      fetchPedidos();
    } catch (error) {
      console.error('Error al guardar el pedido:', error);
    }
  };

  const handleClearForm = () => {
    setFormData(initialFormState);
  };

  const handleRemovePedido = async (id) => {
    if (window.confirm('¿Estás seguro de que quieres eliminar este pedido?')) {
      try {
        await axios.delete(`${API_BASE}/api/pedidos/${id}`);
        fetchPedidos();
      } catch (error) {
        console.error('Error al eliminar el pedido:', error);
      }
    }
  };

  return (
    <div className="pedidos-container">
      <div className="form-layout">
        <h2 className="form-title">NUEVA NOTA DE VENTA</h2>
        <form onSubmit={handleSavePedido}>
          <input 
            type="text" 
            name="nroProforma" 
            value={formData.nroProforma} 
            onChange={handleInputChange} 
            onKeyPress={(e) => {
              // Solo permite números
              if (!/[0-9]/.test(e.key)) {
                e.preventDefault();
              }
            }}
            placeholder="Nro. Proforma" 
            className="form-edit-text" 
          />
          
          <input type="text" name="cliente" value={formData.cliente} onChange={handleInputChange} placeholder="Cliente" className="form-edit-text" />
          <input type="text" name="vendedor" value={formData.vendedor} onChange={handleInputChange} placeholder="Vendedor" className="form-edit-text" />
          
          <input 
            type="date" 
            name="fecha" 
            value={formData.fecha} 
            onChange={handleInputChange} 
            className="form-edit-text" 
          />
          
          {/* Aquí podrías tener un select/options para productos si los cargas desde la API */}
          <input type="text" name="producto" value={formData.producto} onChange={handleInputChange} placeholder="Producto" className="form-edit-text" />
          <input type="text" name="color" value={formData.color} onChange={handleInputChange} placeholder="Color" className="form-edit-text" />
          <input type="number" name="cantidad" value={formData.cantidad} onChange={handleInputChange} placeholder="Cantidad" className="form-edit-text" />
          <input type="number" name="longitud" value={formData.longitud} onChange={handleInputChange} placeholder="Longitud (m)" className="form-edit-text" />
          <input type="number" name="precioUnitario" value={formData.precioUnitario} onChange={handleInputChange} placeholder="Precio Unitario Bs" className="form-edit-text" />
          <input type="number" name="total" value={formData.total} onChange={handleInputChange} placeholder="Total Bs" className="form-edit-text" />

          <div className="action-buttons">
            <button type="submit" className="btn-guardar">Guardar</button>
            <button type="button" onClick={handleClearForm} className="btn-limpiar">Limpiar</button>
          </div>
        </form>
      </div>

      <div className="list-layout">
        <h2 className="list-title">NOTAS GUARDADAS</h2>
        {loading ? (
          <p>Cargando...</p>
        ) : (
          <div className="recycler-view">
            {list.map((p) => (
              <div key={p.id} className="list-item">
                <div className="item-details">
                  <p><b>ID:</b> {p.id}</p>
                  <p><b>Cliente:</b> {p.cliente_id}</p>
                  <p><b>Total:</b> {p.total}</p>
                  <p><b>Estado:</b> {p.estado}</p>
                </div>
                <button onClick={() => handleRemovePedido(p.id)} className="btn-eliminar">Eliminar</button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default Pedidos;