import React, { useEffect, useState } from 'react';
import { pedidosAPI, clientesAPI, productosAPI } from '../utils/api';
import './Pedidos.css';

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
  total: '0.00',
};

const coloresOficiales = ["Azul", "Rojo", "Naranja", "Turquesa", "Verde", "Vino Shingle", "Café Shingle", "Rojo Shingle", "Naranja Shingle", "Zincalum"];

const Pedidos = () => {
  const [list, setList] = useState([]);
  const [formData, setFormData] = useState(initialFormState);
  const [loading, setLoading] = useState(true);
  const [clientes, setClientes] = useState([]);
  const [productos, setProductos] = useState([]);
  const [clienteSeleccionado, setClienteSeleccionado] = useState(null);
  const [isSaving, setIsSaving] = useState(false);

  // Cargar datos iniciales
  const fetchInitialData = async () => {
    setLoading(true);
    try {
      console.log('🔄 Cargando datos de pedidos...');
  
      // Pedidos
      const pedidosRes = await pedidosAPI.list();
      console.log('📦 Respuesta pedidos:', pedidosRes);
  
      if (pedidosRes && pedidosRes.success) {
        // Acceder a data.pedidos
        setList(pedidosRes.data?.pedidos || []);
        console.log('✅ Pedidos cargados:', pedidosRes.data?.pedidos?.length || 0);
      } else {
        console.warn('⚠️ No se pudieron cargar pedidos');
        setList([]);
      }
  
      // Clientes
      const clientesRes = await clientesAPI.list();
      console.log('👥 Respuesta clientes:', clientesRes);
      setClientes(clientesRes.success ? (clientesRes.data?.clientes || []) : []);
  
      // Productos
      const productosRes = await productosAPI.list();
      console.log('📦 Respuesta productos:', productosRes);
      setProductos(productosRes.success ? (productosRes.data?.productos || []) : []);
  
    } catch (error) {
      console.error('💥 Error cargando datos iniciales:', error);
      setList([]);
      setClientes([]);
      setProductos([]);
    } finally {
      setLoading(false);
    }
  };
  

  useEffect(() => {
    fetchInitialData();
  }, []);

  // Calcular total automáticamente
  useEffect(() => {
    const cantidad = parseFloat(formData.cantidad) || 0;
    const longitud = parseFloat(formData.longitud) || 0;
    const precioUnitario = parseFloat(formData.precioUnitario) || 0;
    
    const metrosCuadrados = cantidad * longitud;
    const total = metrosCuadrados * precioUnitario;
    
    setFormData(prev => ({ ...prev, total: total.toFixed(2) }));
  }, [formData.cantidad, formData.longitud, formData.precioUnitario]);

  // Manejadores de eventos
  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleClienteChange = (e) => {
    const clienteId = e.target.value;
    setFormData(prev => ({ ...prev, cliente: clienteId }));
    const cliente = clientes.find(c => c.id === parseInt(clienteId));
    setClienteSeleccionado(cliente);
  };

  const handleClearForm = () => {
    setFormData(initialFormState);
    setClienteSeleccionado(null);
  };

  // Guardar pedido
  const handleSavePedido = async (e) => {
    e.preventDefault();
    setIsSaving(true);

    // Validaciones
    if (!formData.cliente) {
      alert("⚠️ Debes seleccionar un cliente");
      setIsSaving(false);
      return;
    }

    if (!formData.producto) {
      alert("⚠️ Debes seleccionar un producto");
      setIsSaving(false);
      return;
    }

    if (!formData.cantidad || parseFloat(formData.cantidad) <= 0) {
      alert("⚠️ La cantidad debe ser mayor a 0");
      setIsSaving(false);
      return;
    }

    try {
      console.log('💾 Guardando pedido...');
      
      const pedidoData = {
        cliente_id: parseInt(formData.cliente),
        estado: 'pendiente',
        prioridad: 'normal',
        total: parseFloat(formData.total) || 0,
        detalles: [
          {
            producto_id: parseInt(formData.producto),
            cantidad: parseFloat(formData.cantidad),
            subtotal: parseFloat(formData.total) || 0,
          },
        ],
      };

      console.log('📤 Datos a enviar:', pedidoData);
      const res = await pedidosAPI.create(pedidoData);
      console.log('📥 Respuesta del servidor:', res);

      if (res && res.success) {
        alert('✅ Pedido creado exitosamente');
        handleClearForm();
        
        // Recargar la lista completa
        await fetchInitialData();
      } else {
        const errorMsg = res?.message || 'Error desconocido al crear pedido';
        console.error('❌ Error del servidor:', errorMsg);
        alert('❌ Error al crear pedido: ' + errorMsg);
      }
    } catch (error) {
      console.error('💥 Error de red al guardar el pedido:', error);
      alert('❌ Error de conexión. No se pudo guardar el pedido.');
    } finally {
      setIsSaving(false);
    }
  };

  // Eliminar pedido
  const handleRemovePedido = async (id) => {
    if (!window.confirm('¿Estás seguro de que quieres eliminar este pedido?')) {
      return;
    }

    try {
      console.log(`🗑️ Eliminando pedido ${id}...`);
      const response = await pedidosAPI.delete(id);
      
      if (response && response.success) {
        alert('✅ Pedido eliminado exitosamente');
        setList(prevList => prevList.filter(p => p.id !== id));
      } else {
        alert('❌ Error al eliminar pedido: ' + (response?.message || 'Error desconocido'));
      }
    } catch (error) {
      console.error('💥 Error al eliminar el pedido:', error);
      alert('❌ Error de conexión. No se pudo eliminar el pedido.');
    }
  };

  // Renderizado
  return (
    <div className="pedidos-container">
      <div className="form-layout">
        <h2 className="form-title">NUEVA NOTA DE VENTA</h2>
        <form onSubmit={handleSavePedido} className="user-form">
          <input 
            type="text" 
            name="nroProforma" 
            value={formData.nroProforma} 
            onChange={handleInputChange} 
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
              <option key={c.id} value={c.id}>{c.nombre}</option>
            ))}
          </select>

          {clienteSeleccionado && (
            <div className="cliente-info-box">
              <strong>📍 Datos del Cliente:</strong>
              <p>Teléfono: {clienteSeleccionado.telefono || 'N/A'}</p>
              <p>Dirección: {clienteSeleccionado.direccion || 'N/A'}</p>
              <p>NIT: {clienteSeleccionado.nit || 'N/A'}</p>
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
            {productos.map(p => (
              <option key={p.id} value={p.id}>{p.nombre}</option>
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
            min="1" 
            required
          />
          
          <input 
            type="number" 
            name="longitud" 
            value={formData.longitud} 
            onChange={handleInputChange} 
            placeholder="Longitud (m)" 
            className="form-edit-text" 
            step="0.01" 
            min="0.1"
          />

          <div className="calculation-box">
            <strong>📐 Metros cuadrados totales:</strong> 
            {((parseFloat(formData.cantidad) || 0) * (parseFloat(formData.longitud) || 0)).toFixed(2)} m²
          </div>
          
          <input 
            type="number" 
            name="precioUnitario" 
            value={formData.precioUnitario} 
            onChange={handleInputChange} 
            placeholder="Precio por m² (Bs)" 
            className="form-edit-text" 
            step="0.01" 
            min="0"
          />
          
          <input 
            type="text" 
            name="total" 
            value={formData.total} 
            placeholder="Total Bs" 
            className="form-edit-text" 
            readOnly
          />

          <div className="action-buttons">
            <button type="submit" className="btn-guardar" disabled={isSaving}>
              {isSaving ? '⏳ Guardando...' : '💾 Guardar'}
            </button>
            <button type="button" onClick={handleClearForm} className="btn-limpiar">
              🧹 Limpiar
            </button>
          </div>
        </form>
      </div>

      <div className="list-layout">
        <h2 className="list-title">NOTAS GUARDADAS ({list.length})</h2>
        {loading ? (
          <div style={{textAlign: 'center', padding: '20px'}}>
            <p>⏳ Cargando pedidos...</p>
          </div>
        ) : (
          <div className="recycler-view">
            {list.length === 0 ? (
              <p style={{textAlign: 'center', padding: '20px', color: '#666'}}>
                📭 No hay pedidos registrados
              </p>
            ) : (
              list.map((p) => (
                <div key={p.id} className="list-item-card">
                  <div className="card-header">
                    <span className="pedido-id">Pedido #{p.id}</span>
                    <span className={`estado-badge ${p.estado}`}>
                      {p.estado?.toUpperCase()}
                    </span>
                  </div>
                  <div className="card-body">
                    <div className="info-row">
                      <span className="label">👤 Cliente:</span>
                      <span className="value">
                        {p.cliente_info?.nombre || `ID: ${p.cliente_id}`}
                      </span>
                    </div>
                    {p.cliente_info?.telefono && (
                      <div className="info-row">
                        <span className="label">📞 Teléfono:</span>
                        <span className="value">{p.cliente_info.telefono}</span>
                      </div>
                    )}
                    {p.cliente_info?.direccion && (
                      <div className="info-row">
                        <span className="label">📍 Dirección:</span>
                        <span className="value">{p.cliente_info.direccion}</span>
                      </div>
                    )}
                    <div className="info-row">
                      <span className="label">💰 Total:</span>
                      <span className="value total-amount">
                        Bs. {parseFloat(p.total || 0).toFixed(2)}
                      </span>
                    </div>
                    <div className="info-row">
                      <span className="label">📅 Fecha:</span>
                      <span className="value">
                        {p.fecha_pedido 
                          ? new Date(p.fecha_pedido).toLocaleDateString('es-BO') 
                          : 'N/A'}
                      </span>
                    </div>
                  </div>
                  <div className="card-footer">
                    <button 
                      onClick={() => handleRemovePedido(p.id)} 
                      className="btn-eliminar"
                    >
                      🗑️ Eliminar
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default Pedidos;