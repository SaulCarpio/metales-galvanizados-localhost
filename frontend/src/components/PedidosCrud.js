import React, { useEffect, useState } from 'react';
import axios from 'axios';
import './Pedidos.css';

const API_BASE = process.env.REACT_APP_API_BASE || 'http://localhost:8080';

const productosOficiales = [
  "Ondulado",
  "Trapezoidal",
  "Teja Colonial",
  "Teja América"
];

const coloresOficiales = [
  "Azul",
  "Rojo",
  "Naranja",
  "Turquesa",
  "Verde",
  "Vino Shingle",
  "Café Shingle",
  "Rojo Shingle",
  "Naranja Shingle",
  "Zincalum"
];

const initialFormState = {
  nroProforma: '',
  cliente: '',
  vendedor: '',
  fecha: new Date().toISOString().split('T')[0],
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
  const [clientes, setClientes] = useState([]);
  const [clienteSeleccionado, setClienteSeleccionado] = useState(null);

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

  const fetchClientes = async () => {
    try {
      const r = await axios.get(`${API_BASE}/api/clientes`);
      if (r.data.success) {
        setClientes(r.data.clientes || []);
      }
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    fetchPedidos();
    fetchClientes();
  }, []);

  // Calcular total automáticamente
  useEffect(() => {
    const cantidad = parseFloat(formData.cantidad) || 0;
    const longitud = parseFloat(formData.longitud) || 0;
    const precioUnitario = parseFloat(formData.precioUnitario) || 0;
    
    // Total = cantidad × longitud × precio por m²
    const metrosCuadrados = cantidad * longitud;
    const total = metrosCuadrados * precioUnitario;
    
    setFormData(prev => ({ ...prev, total: total.toFixed(2) }));
  }, [formData.cantidad, formData.longitud, formData.precioUnitario]);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleClienteChange = (e) => {
    const clienteId = e.target.value;
    setFormData((prev) => ({ ...prev, cliente: clienteId }));
    
    const cliente = clientes.find(c => c.id === parseInt(clienteId));
    setClienteSeleccionado(cliente);
  };

  const handleSavePedido = async (e) => {
    e.preventDefault();

    if (!formData.cliente || !formData.producto || !formData.cantidad) {
      alert("Cliente, producto y cantidad son obligatorios.");
      return;
    }

    try {
      const pedidoData = {
        cliente_id: Number(formData.cliente),
        estado: 'pendiente',
        prioridad: 'normal',
        total: Number(formData.total),
        detalles: [
          {
            producto_id: 1, // Puedes mejorarlo relacionando producto con su ID
            cantidad: Number(formData.cantidad),
            subtotal: Number(formData.total),
          },
        ],
      };

      const res = await axios.post(`${API_BASE}/api/pedidos`, pedidoData);

      setFormData(initialFormState);
      setClienteSeleccionado(null);

      if (res.data && res.data.success && res.data.id) {
        localStorage.setItem('openMapPedido', JSON.stringify({ pedidoId: res.data.id }));
        window.location.href = '/dashboard';
        return;
      }

      fetchPedidos();
    } catch (error) {
      console.error('Error al guardar el pedido:', error);
    }
  };

  const handleClearForm = () => {
    setFormData(initialFormState);
    setClienteSeleccionado(null);
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
        <div className="user-form">
          <input 
            type="text" 
            name="nroProforma" 
            value={formData.nroProforma} 
            onChange={handleInputChange} 
            onKeyPress={(e) => {
              if (!/[0-9]/.test(e.key)) {
                e.preventDefault();
              }
            }}
            placeholder="Nro. Proforma" 
            className="form-edit-text" 
          />
          
          <select 
            name="cliente" 
            value={formData.cliente} 
            onChange={handleClienteChange} 
            className="form-edit-text"
            required
          >
            <option value="">-- Seleccionar Cliente --</option>
            {clientes.map(c => (
              <option key={c.id} value={c.id}>
                {c.nombre} - {c.email}
              </option>
            ))}
          </select>

          {clienteSeleccionado && (
            <div style={{
              backgroundColor: '#f0f0f0',
              padding: '10px',
              borderRadius: '5px',
              marginBottom: '10px',
              fontSize: '13px'
            }}>
              <strong>📍 Datos del Cliente:</strong>
              <p style={{ margin: '5px 0' }}>Teléfono: {clienteSeleccionado.telefono || 'N/A'}</p>
              <p style={{ margin: '5px 0' }}>Dirección: {clienteSeleccionado.direccion || 'N/A'}</p>
              <p style={{ margin: '5px 0' }}>NIT: {clienteSeleccionado.nit || 'N/A'}</p>
            </div>
          )}
          
          <input 
            type="text" 
            name="vendedor" 
            value={formData.vendedor} 
            onChange={handleInputChange} 
            placeholder="Vendedor" 
            className="form-edit-text" 
          />
          
          <input 
            type="date" 
            name="fecha" 
            value={formData.fecha} 
            onChange={handleInputChange} 
            className="form-edit-text" 
          />
          
          <select 
            name="producto" 
            value={formData.producto} 
            onChange={handleInputChange} 
            className="form-edit-text"
            required
          >
            <option value="">-- Seleccionar Producto --</option>
            {productosOficiales.map(p => (
              <option key={p} value={p}>{p}</option>
            ))}
          </select>

          <select 
            name="color" 
            value={formData.color} 
            onChange={handleInputChange} 
            className="form-edit-text"
          >
            <option value="">-- Seleccionar Color --</option>
            {coloresOficiales.map(c => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>

          <input 
            type="number" 
            name="cantidad" 
            value={formData.cantidad} 
            onChange={handleInputChange} 
            placeholder="Cantidad (unidades)" 
            className="form-edit-text"
            step="1"
          />
          
          <input 
            type="number" 
            name="longitud" 
            value={formData.longitud} 
            onChange={handleInputChange} 
            placeholder="Longitud (m)" 
            className="form-edit-text"
            step="0.01"
          />

          <div style={{
            backgroundColor: '#e8f4f8',
            padding: '8px',
            borderRadius: '5px',
            marginBottom: '5px',
            fontSize: '13px'
          }}>
            <strong>📐 Metros cuadrados totales:</strong> {
              ((parseFloat(formData.cantidad) || 0) * (parseFloat(formData.longitud) || 0)).toFixed(2)
            } m²
          </div>
          
          <input 
            type="number" 
            name="precioUnitario" 
            value={formData.precioUnitario} 
            onChange={handleInputChange} 
            placeholder="Precio por m² (Bs)" 
            className="form-edit-text"
            step="0.01"
          />
          
          <input 
            type="number" 
            name="total" 
            value={formData.total} 
            onChange={handleInputChange} 
            placeholder="Total Bs" 
            className="form-edit-text"
            readOnly
            style={{ backgroundColor: '#f0f0f0', fontWeight: 'bold' }}
          />

          <div className="action-buttons">
            <button onClick={handleSavePedido} className="btn-guardar">Guardar</button>
            <button onClick={handleClearForm} className="btn-limpiar">Limpiar</button>
          </div>
        </div>
      </div>

      <div className="list-layout">
        <h2 className="list-title">NOTAS GUARDADAS</h2>
        {loading ? (
          <p>Cargando...</p>
        ) : (
          <div className="recycler-view">
            {list.map((p) => {
              const cliente = clientes.find(c => c.id === p.cliente_id);
              return (
                <div key={p.id} className="list-item-card">
                  <div className="card-header">
                    <span className="pedido-id">Pedido #{p.id}</span>
                    <span className={`estado-badge ${p.estado}`}>
                      {p.estado.toUpperCase()}
                    </span>
                  </div>
                  <div className="card-body">
                    <div className="info-row">
                      <span className="label">👤 Cliente:</span>
                      <span className="value">{cliente?.nombre || `ID: ${p.cliente_id}`}</span>
                    </div>
                    {cliente?.telefono && (
                      <div className="info-row">
                        <span className="label">📞 Teléfono:</span>
                        <span className="value">{cliente.telefono}</span>
                      </div>
                    )}
                    {cliente?.direccion && (
                      <div className="info-row">
                        <span className="label">📍 Dirección:</span>
                        <span className="value">{cliente.direccion}</span>
                      </div>
                    )}
                    <div className="info-row">
                      <span className="label">💰 Total:</span>
                      <span className="value total-amount">Bs. {parseFloat(p.total).toFixed(2)}</span>
                    </div>
                    <div className="info-row">
                      <span className="label">📅 Fecha:</span>
                      <span className="value">
                        {p.fecha_pedido ? new Date(p.fecha_pedido).toLocaleDateString() : 'N/A'}
                      </span>
                    </div>
                  </div>
                  <div className="card-footer">
                    <button onClick={() => handleRemovePedido(p.id)} className="btn-eliminar">
                      🗑️ Eliminar
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default Pedidos;