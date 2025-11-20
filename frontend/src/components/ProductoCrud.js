import React, { useEffect, useState } from 'react';
import './UserCrud.css';

const ProductoCrud = () => {
  const [activeSection, setActiveSection] = useState('productos');
  
  // Estados para Productos
  const [productos, setProductos] = useState([]);
  const [productoForm, setProductoForm] = useState({
    nombre: '',
    descripcion: '',
    categoria: '',
    precio: 0,
    stock: 0,
    activo: true
  });
  const [editingProducto, setEditingProducto] = useState(null);
  
  // Estado para alertas de stock bajo
  const [alertasStock, setAlertasStock] = useState([]);

  // Estados para Vehículos
  const [vehiculos, setVehiculos] = useState([]);
  const [vehiculoForm, setVehiculoForm] = useState({
    placa: '',
    marca: '',
    modelo: '',
    capacidad: 0
  });
  const [editingVehiculo, setEditingVehiculo] = useState(null);

  useEffect(() => {
    fetchProductos();
    fetchVehiculos();
  }, []);

  // ==================== PRODUCTOS ====================
  const fetchProductos = async () => {
    try {
      const response = await fetch('http://localhost:8080/api/productos');
      const data = await response.json();
      if (data.success) {
        setProductos(data.productos);
        
        // Verificar productos con stock 0 o bajo
        const productosSinStock = data.productos.filter(p => p.stock === 0 && p.activo);
        if (productosSinStock.length > 0) {
          setAlertasStock(productosSinStock.map(p => ({
            id: p.id,
            nombre: p.nombre,
            stock: p.stock
          })));
        }
      }
    } catch (error) {
      console.error('Error al cargar productos:', error);
    }
  };

  const handleProductoChange = (e) => {
    const { name, value, type, checked } = e.target;
    setProductoForm({
      ...productoForm,
      [name]: type === 'checkbox' ? checked : value
    });
  };

  const handleProductoSubmit = async (e) => {
    e.preventDefault();
    
    if (!productoForm.nombre || !productoForm.precio) {
      alert('Nombre y precio son obligatorios');
      return;
    }

    try {
      const url = editingProducto 
        ? `http://localhost:8080/api/productos/${editingProducto}`
        : 'http://localhost:8080/api/productos';
      
      const method = editingProducto ? 'PUT' : 'POST';
      
      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...productoForm,
          precio: Number(productoForm.precio),
          stock: Number(productoForm.stock)
        })
      });

      const data = await response.json();
      
      if (data.success) {
        fetchProductos();
        resetProductoForm();
        alert(editingProducto ? 'Producto actualizado' : 'Producto creado');
      } else {
        alert(data.message || 'Error al guardar producto');
      }
    } catch (error) {
      console.error('Error:', error);
      alert('Error al comunicarse con el servidor');
    }
  };

  const handleEditProducto = (producto) => {
    setEditingProducto(producto.id);
    setProductoForm({
      nombre: producto.nombre,
      descripcion: producto.descripcion || '',
      categoria: producto.categoria || '',
      precio: producto.precio,
      stock: producto.stock,
      activo: producto.activo
    });
  };

  const handleDeleteProducto = async (id) => {
    if (!window.confirm('¿Estás seguro de eliminar este producto?')) return;

    try {
      const response = await fetch(`http://localhost:8080/api/productos/${id}`, {
        method: 'DELETE'
      });
      const data = await response.json();
      
      if (data.success) {
        fetchProductos();
        alert('Producto eliminado');
      }
    } catch (error) {
      console.error('Error:', error);
      alert('Error al eliminar producto');
    }
  };

  const resetProductoForm = () => {
    setProductoForm({
      nombre: '',
      descripcion: '',
      categoria: '',
      precio: 0,
      stock: 0,
      activo: true
    });
    setEditingProducto(null);
  };

  // ==================== VEHÍCULOS ====================
  const fetchVehiculos = async () => {
    try {
      const response = await fetch('http://localhost:8080/api/vehiculos');
      const data = await response.json();
      if (data.success) {
        setVehiculos(data.vehiculos);
      }
    } catch (error) {
      console.error('Error al cargar vehículos:', error);
    }
  };

  const handleVehiculoChange = (e) => {
    const { name, value } = e.target;
    setVehiculoForm({
      ...vehiculoForm,
      [name]: value
    });
  };

  const handleVehiculoSubmit = async (e) => {
    e.preventDefault();
    
    if (!vehiculoForm.placa) {
      alert('La placa es obligatoria');
      return;
    }

    try {
      const url = editingVehiculo 
        ? `http://localhost:8080/api/vehiculos/${editingVehiculo}`
        : 'http://localhost:8080/api/vehiculos';
      
      const method = editingVehiculo ? 'PUT' : 'POST';
      
      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...vehiculoForm,
          capacidad: Number(vehiculoForm.capacidad)
        })
      });

      const data = await response.json();
      
      if (data.success) {
        fetchVehiculos();
        resetVehiculoForm();
        alert(editingVehiculo ? 'Vehículo actualizado' : 'Vehículo creado');
      } else {
        alert(data.message || 'Error al guardar vehículo');
      }
    } catch (error) {
      console.error('Error:', error);
      alert('Error al comunicarse con el servidor');
    }
  };

  const handleEditVehiculo = (vehiculo) => {
    setEditingVehiculo(vehiculo.id);
    setVehiculoForm({
      placa: vehiculo.placa,
      marca: vehiculo.marca || '',
      modelo: vehiculo.modelo || '',
      capacidad: vehiculo.capacidad || 0
    });
  };

  const handleDeleteVehiculo = async (id) => {
    if (!window.confirm('¿Estás seguro de eliminar este vehículo?')) return;

    try {
      const response = await fetch(`http://localhost:8080/api/vehiculos/${id}`, {
        method: 'DELETE'
      });
      const data = await response.json();
      
      if (data.success) {
        fetchVehiculos();
        alert('Vehículo eliminado');
      }
    } catch (error) {
      console.error('Error:', error);
      alert('Error al eliminar vehículo');
    }
  };

  const resetVehiculoForm = () => {
    setVehiculoForm({
      placa: '',
      marca: '',
      modelo: '',
      capacidad: 0
    });
    setEditingVehiculo(null);
  };

  return (
    <div className="user-crud-container">
      <h2>Gestión de Fábrica</h2>
      
      <div className="tabs">
        <button 
          className={activeSection === 'productos' ? 'active' : ''}
          onClick={() => setActiveSection('productos')}
        >
          📦 Productos
        </button>
        <button 
          className={activeSection === 'vehiculos' ? 'active' : ''}
          onClick={() => setActiveSection('vehiculos')}
        >
          🚚 Vehículos
        </button>
      </div>

      {activeSection === 'productos' && (
        <div>
          <h3>{editingProducto ? 'Editar Producto' : 'Nuevo Producto'}</h3>
          <div className="user-form">
            <input
              type="text"
              name="nombre"
              value={productoForm.nombre}
              onChange={handleProductoChange}
              placeholder="Nombre del producto *"
            />
            <textarea
              name="descripcion"
              value={productoForm.descripcion}
              onChange={handleProductoChange}
              placeholder="Descripción"
              rows="3"
            />
            <input
              type="text"
              name="categoria"
              value={productoForm.categoria}
              onChange={handleProductoChange}
              placeholder="Categoría (ej: calamina, plásticos)"
            />
            <input
              type="number"
              step="0.01"
              name="precio"
              value={productoForm.precio}
              onChange={handleProductoChange}
              placeholder="Precio *"
            />
            <input
              type="number"
              name="stock"
              value={productoForm.stock}
              onChange={handleProductoChange}
              placeholder="Stock inicial"
            />
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <input
                type="checkbox"
                name="activo"
                checked={productoForm.activo}
                onChange={handleProductoChange}
              />
              Producto activo
            </label>
            <div style={{ display: 'flex', gap: '10px' }}>
              <button onClick={handleProductoSubmit}>
                {editingProducto ? 'Actualizar' : 'Crear'} Producto
              </button>
              {editingProducto && (
                <button onClick={resetProductoForm}>
                  Cancelar
                </button>
              )}
            </div>
          </div>

          <hr />

          <h3>Lista de Productos</h3>
          <table className="user-table">
            <thead>
              <tr>
                <th>ID</th>
                <th>Nombre</th>
                <th>Categoría</th>
                <th>Precio</th>
                <th>Stock</th>
                <th>Estado</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {productos.length === 0 ? (
                <tr>
                  <td colSpan="7" style={{ textAlign: 'center' }}>
                    No hay productos registrados
                  </td>
                </tr>
              ) : (
                productos.map(producto => (
                  <tr key={producto.id}>
                    <td>{producto.id}</td>
                    <td>{producto.nombre}</td>
                    <td>{producto.categoria || '-'}</td>
                    <td>Bs. {Number(producto.precio).toFixed(2)}</td>
                    <td>{producto.stock}</td>
                    <td>
                      <span className={producto.activo ? 'status-active' : 'status-inactive'}>
                        {producto.activo ? 'Activo' : 'Inactivo'}
                      </span>
                    </td>
                    <td>
                      <button 
                        onClick={() => handleEditProducto(producto)}
                        className="btn-edit"
                      >
                        ✏️
                      </button>
                      <button 
                        onClick={() => handleDeleteProducto(producto.id)}
                        className="btn-delete"
                      >
                        🗑️
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {activeSection === 'vehiculos' && (
        <div>
          <h3>{editingVehiculo ? 'Editar Vehículo' : 'Nuevo Vehículo'}</h3>
          <div className="user-form">
            <input
              type="text"
              name="placa"
              value={vehiculoForm.placa}
              onChange={handleVehiculoChange}
              placeholder="Placa del vehículo *"
            />
            <input
              type="text"
              name="marca"
              value={vehiculoForm.marca}
              onChange={handleVehiculoChange}
              placeholder="Marca (ej: Toyota, Volvo)"
            />
            <input
              type="text"
              name="modelo"
              value={vehiculoForm.modelo}
              onChange={handleVehiculoChange}
              placeholder="Modelo"
            />
            <input
              type="number"
              name="capacidad"
              value={vehiculoForm.capacidad}
              onChange={handleVehiculoChange}
              placeholder="Capacidad (kg)"
            />
            <div style={{ display: 'flex', gap: '10px' }}>
              <button onClick={handleVehiculoSubmit}>
                {editingVehiculo ? 'Actualizar' : 'Crear'} Vehículo
              </button>
              {editingVehiculo && (
                <button onClick={resetVehiculoForm}>
                  Cancelar
                </button>
              )}
            </div>
          </div>

          <hr />

          <h3>Lista de Vehículos</h3>
          <table className="user-table">
            <thead>
              <tr>
                <th>ID</th>
                <th>Placa</th>
                <th>Marca</th>
                <th>Modelo</th>
                <th>Capacidad (kg)</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {vehiculos.length === 0 ? (
                <tr>
                  <td colSpan="6" style={{ textAlign: 'center' }}>
                    No hay vehículos registrados
                  </td>
                </tr>
              ) : (
                vehiculos.map(vehiculo => (
                  <tr key={vehiculo.id}>
                    <td>{vehiculo.id}</td>
                    <td><strong>{vehiculo.placa}</strong></td>
                    <td>{vehiculo.marca || '-'}</td>
                    <td>{vehiculo.modelo || '-'}</td>
                    <td>{vehiculo.capacidad || 0}</td>
                    <td>
                      <button 
                        onClick={() => handleEditVehiculo(vehiculo)}
                        className="btn-edit"
                      >
                        ✏️
                      </button>
                      <button 
                        onClick={() => handleDeleteVehiculo(vehiculo.id)}
                        className="btn-delete"
                      >
                        🗑️
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default ProductoCrud;