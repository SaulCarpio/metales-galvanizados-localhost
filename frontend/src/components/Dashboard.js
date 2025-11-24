import React, { useState, useEffect } from 'react';

// Componentes
import UserCrud from './UserCrud';
import MapView from './MapView';
import Pedidos from './PedidosCrud';
import Cotizaciones from './CotizacionCrud';
import Reportes from './Reportes';
import { SummaryCards, InventoryList } from './Charts';
import { cotizacionesAPI, pedidosAPI, inventarioAPI, vehiculosAPI } from '../utils/api';
import ProveedorCrud from './ProveedorCrud';
import OrdenCompraCrud from './OrdenCompraCrud';
import CuentasPagarCrud from './CuentasPagarCrud';
import MovimientosPagoCrud from './MovimientosPagoCrud';
import ProductoCrud from './ProductoCrud';
import InventarioCrud from './InventarioCrud';
import LogisticsDashboard from './LogisticsDashboard'; 
import ImportacionCrud from './ImportacionCrud'

import './Dashboard.css';

const Dashboard = () => {
  const [activeTab, setActiveTab] = useState('inicio'); 
  const [openModule, setOpenModule] = useState(null);

  const role = localStorage.getItem('role') || 'usuario';

  const [cotizacionesData, setCotizacionesData] = useState([]);
  const [pedidosData, setPedidosData] = useState([]);
  const [inventarioData, setInventarioData] = useState([]);
  const [vehiculosData, setVehiculosData] = useState([]); // NUEVO

  // Función genérica para cargar datos
  const fetchData = async (apiFn, setData, dataKey) => {
    try {
      const res = await apiFn();
      const items = res?.data?.[dataKey] || [];
      if (Array.isArray(items)) {
        setData(items);
        console.log(`✅ ${dataKey} cargados:`, items.length);
      } else {
        console.warn(`⚠️ No se pudieron cargar ${dataKey}`);
        setData([]);
      }
    } catch (error) {
      console.error(`❌ Error cargando ${dataKey}:`, error);
      setData([]);
    }
  };
  
  const loadDashboardData = async () => {
    try {
      console.log('🔄 Cargando datos del dashboard...');
  
      // Cotizaciones
      try {
        const cRes = await cotizacionesAPI.list();
        if (cRes.success && cRes.data?.cotizaciones) {
          setCotizacionesData(cRes.data.cotizaciones);
        } else {
          setCotizacionesData([]);
        }
      } catch (e) {
        console.error('❌ Error loading cotizaciones:', e);
        setCotizacionesData([]);
      }
  
      // Pedidos
      try {
        const pRes = await pedidosAPI.list();
        if (pRes.success && pRes.data?.pedidos) {
          setPedidosData(pRes.data.pedidos);
        } else {
          setPedidosData([]);
        }
      } catch (e) {
        console.error('❌ Error loading pedidos:', e);
        setPedidosData([]);
      }
  
      // Inventario
      try {
        const iRes = await inventarioAPI.list();
        if (iRes.success && iRes.data?.inventario) {
          setInventarioData(iRes.data.inventario);
        } else {
          setInventarioData([]);
        }
      } catch (e) {
        console.error('❌ Error loading inventario:', e);
        setInventarioData([]);
      }

      // NUEVO: Vehículos
      try {
        const vRes = await vehiculosAPI.list();
        if (vRes.success && vRes.data?.vehiculos) {
          setVehiculosData(vRes.data.vehiculos);
        } else {
          setVehiculosData([]);
        }
      } catch (e) {
        console.error('❌ Error loading vehículos:', e);
        setVehiculosData([]);
      }
  
    } catch (e) {
      console.error('💥 Error general cargando datos dashboard:', e);
    }
  };
  
  useEffect(() => {
    loadDashboardData();
  }, []);

  useEffect(() => {
    if (activeTab === 'inicio' || activeTab === 'reportes') {
      loadDashboardData();
    }
    if (activeTab === 'map') {
      fetchData(pedidosAPI.list, setPedidosData, 'pedidos');
      fetchData(vehiculosAPI.list, setVehiculosData, 'vehiculos'); // NUEVO
    }
  }, [activeTab]);

  const handleLogout = () => {
    localStorage.clear();
    window.location.href = '/login'; 
  };

  const toggleModule = (module) => {
    setOpenModule(openModule === module ? null : module);
  };

  // NUEVO: Handler para asignar vehículo a pedido
  const handleAsignarVehiculo = async (pedidoId, vehiculoId) => {
    try {
      const res = await pedidosAPI.asignarVehiculo(pedidoId, vehiculoId);
      if (res.success) {
        alert(`✅ Vehículo asignado correctamente al Pedido #${pedidoId}`);
        // Recargar pedidos para actualizar estado
        const pRes = await pedidosAPI.list();
        if (pRes.success && pRes.data?.pedidos) {
          setPedidosData(pRes.data.pedidos);
        }
      } else {
        alert('⚠️ Error al asignar vehículo: ' + res.message);
      }
    } catch (error) {
      console.error('Error asignando vehículo:', error);
      alert('❌ Error al asignar vehículo');
    }
  };

  const renderActiveTabContent = () => {
    switch (activeTab) {
      case 'inicio':
        return (
          <div className="inicio-dashboard">
            <div className="stats-grid">
              <div className="stat-card">
                <h3>Ventas del Mes</h3>
                <p>$45,231.89</p>
              </div>
              <div className="stat-card">
                <h3>Pedidos Pendientes</h3>
                <p>{pedidosData.filter(p => p.estado === 'pendiente').length}</p>
              </div>
              <div className="stat-card">
                <h3>Cotizaciones Activas</h3>
                <p>{cotizacionesData.filter(c => c.estado === 'emitida').length}</p>
              </div>
              <div className="stat-card">
                <h3>Tasa de Entrega</h3>
                <p>98.5%</p>
              </div>
            </div>

            <div className="charts-grid">
              <div className="chart-container">
                <h4>Resumen Cotizaciones</h4>
                <SummaryCards title="Cotizaciones" rows={cotizacionesData} />
              </div>
              <div className="chart-container">
                <h4>Resumen Pedidos</h4>
                <SummaryCards title="Pedidos" rows={pedidosData} />
              </div>
              <div className="chart-container" style={{gridColumn: '1 / -1'}}>
                <h4>Existencias (Resumen)</h4>
                <InventoryList rows={inventarioData} />
              </div>
            </div>
          </div>
        );

      case 'map':
        return (
          <div className="map-layout">
            <div className="map-main">
              <MapView initialCoord={[-16.482392, -68.242340]} />
            </div>
            <aside className="map-history">
              <h3>Pedidos pendientes ({pedidosData.filter(p => p.estado === 'pendiente').length})</h3>
              <ul className="history-list">
                {pedidosData.filter(p => p.estado === 'pendiente').length === 0 && (
                  <li>No hay pedidos pendientes</li>
                )}
                {pedidosData.filter(p => p.estado === 'pendiente').map(p => (
                  <li key={p.id} style={{display:'flex',flexDirection:'column',gap:10, padding: '12px', border: '1px solid #dee2e6', borderRadius: '6px', marginBottom: '10px'}}>
                    <div style={{display:'flex',justifyContent:'space-between'}}>
                      <div className="hist-title" style={{fontWeight:'bold', fontSize:'16px'}}>Pedido #{p.id}</div>
                      <div className="hist-meta" style={{fontSize:'14px', color:'#666'}}>
                        Cliente: {p.cliente_info?.nombre || p.cliente_id || 'N/A'}
                      </div>
                    </div>

                    <div className="hist-meta" style={{fontSize: '0.9em', color: '#666'}}>
                      Total: Bs. {Number(p.total || 0).toFixed(2)}
                    </div>

                    <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', gap:8}}>
                      <div style={{fontWeight:'bold'}}>
                        Estado: <span style={{textTransform:'uppercase', color: p.vehiculo_id ? '#28a745' : '#ffc107'}}>
                          {p.vehiculo_id ? 'VEHÍCULO ASIGNADO' : p.estado}
                        </span>
                      </div>
                    </div>

                    {/* NUEVO: Selector de vehículo y botón de asignación */}
                    <div style={{display:'flex', gap:8, alignItems:'center'}}>
                      <select 
                        style={{flex:1, padding:'6px', borderRadius:'4px', border:'1px solid #ced4da'}}
                        disabled={!!p.vehiculo_id}
                        defaultValue=""
                        id={`vehiculo-select-${p.id}`}
                      >
                        <option value="">-- Seleccionar Vehículo --</option>
                        {vehiculosData.map(v => (
                          <option key={v.id} value={v.id}>
                            {v.placa} - {v.marca} {v.modelo}
                          </option>
                        ))}
                      </select>

                      <button 
                        className="btn btn-primary" 
                        style={{padding:'6px 12px'}}
                        disabled={!!p.vehiculo_id}
                        onClick={() => {
                          const selectElement = document.getElementById(`vehiculo-select-${p.id}`);
                          const vehiculoId = parseInt(selectElement.value);
                          if (!vehiculoId) {
                            alert('⚠️ Por favor selecciona un vehículo');
                            return;
                          }
                          handleAsignarVehiculo(p.id, vehiculoId);
                        }}
                      >
                        {p.vehiculo_id ? '✓ Asignado' : 'Asignar'}
                      </button>
                    </div>

                    {/* Mostrar info del vehículo asignado */}
                    {p.vehiculo_id && p.vehiculo_info && (
                      <div style={{background:'#e7f5ec', padding:'8px', borderRadius:'4px', fontSize:'13px'}}>
                        <strong>🚚 Vehículo:</strong> {p.vehiculo_info.placa} - {p.vehiculo_info.marca} {p.vehiculo_info.modelo}
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            </aside>
          </div>
        );

      case 'kpis':
        return role === 'admin' ? <LogisticsDashboard /> : <div className="placeholder"><h2>Acceso Denegado</h2></div>;

      case 'reportes':
        return role === 'admin' ? <Reportes /> : <div className="placeholder"><h2>Acceso Denegado</h2></div>;
      case 'usuarios':
        return role === 'admin' ? <UserCrud /> : <div className="placeholder"><h2>Acceso Denegado</h2></div>;
      case 'cotizaciones': return <Cotizaciones />;
      case 'proveedores': return <ProveedorCrud />;
      case 'ordenes': return <OrdenCompraCrud />;
      case 'cuentas': return (
        <>
          <CuentasPagarCrud />
          <MovimientosPagoCrud />
        </>
      );
      case 'fabrica': return <ProductoCrud />;
      case 'importaciones': return role === 'admin' ? <ImportacionCrud /> : <div className="placeholder"><h2>Acceso Denegado</h2></div>;
      case 'existencias': return <InventarioCrud />;
      case 'pedidos': return <Pedidos />;
      default: return (
        <div className="placeholder">
          <h2>Módulo: {activeTab.charAt(0).toUpperCase() + activeTab.slice(1)}</h2>
          <p>Contenido del módulo seleccionado.</p>
        </div>
      );
    }
  };

  return (
    <div className="dashboard">
      <aside className="sidebar">
        <h2 className="sidebar-title">Menú</h2>

        <button 
          className={`sidebar-item ${activeTab === 'inicio' ? 'active' : ''}`} 
          onClick={() => setActiveTab('inicio')}
        >
          🏠 Inicio
        </button>

        {role === 'admin' && (
          <button 
            className={`sidebar-item ${activeTab === 'usuarios' ? 'active' : ''}`} 
            onClick={() => setActiveTab('usuarios')}
          >
            👥 Usuarios
          </button>
        )}

        {/* Menú Logística */}
        <div className="sidebar-section">
          <button className="sidebar-item" onClick={() => toggleModule('logistica')}>
            🚚 Logística y Distribución
          </button>
          {openModule === 'logistica' && (
            <div className="sidebar-submenu">
              <button onClick={() => setActiveTab('map')}>Rutas</button>
              {role === 'admin' && (
                 <button 
                    className={`${activeTab === 'kpis' ? 'active-submenu' : ''}`} 
                    onClick={() => setActiveTab('kpis')}
                >
                    KPIs Logísticos
                </button>
              )}
            </div>
          )}
        </div>

        {/* Menú Admin */}
        {role === 'admin' && (
          <>
            <div className="sidebar-section">
              <button className="sidebar-item" onClick={() => toggleModule('finanzas')}>
                💰 Finanzas y Contabilidad
              </button>
              {openModule === 'finanzas' && (
                <div className="sidebar-submenu">
                  <button onClick={() => setActiveTab('cuentas')}>Gestión Cuentas</button>
                </div>
              )}
            </div>

            <div className="sidebar-section">
              <button className="sidebar-item" onClick={() => toggleModule('inventario')}>
                🏭 Gestión de Inventario
              </button>
              {openModule === 'inventario' && (
                <div className="sidebar-submenu">
                  <button onClick={() => setActiveTab('fabrica')}>Gestión Fábrica</button>
                  <button onClick={() => setActiveTab('importaciones')}>Gestión Importaciones</button>
                  <button onClick={() => setActiveTab('existencias')}>Control Existencias</button>
                </div>
              )}
            </div>

            <div className="sidebar-section">
              <button className="sidebar-item" onClick={() => toggleModule('compras')}>
                🛒 Compras y Proveedores
              </button>
              {openModule === 'compras' && (
                <div className="sidebar-submenu">
                  <button onClick={() => setActiveTab('ordenes')}>Órdenes de Compra</button>
                  <button onClick={() => setActiveTab('proveedores')}>Proveedores</button>
                </div>
              )}
            </div>
          </>
        )}

        {/* Menú Ventas */}
        <div className="sidebar-section">
          <button className="sidebar-item" onClick={() => toggleModule('ventas')}>
            🧾 Ventas
          </button>
          {openModule === 'ventas' && (
            <div className="sidebar-submenu">
              <button onClick={() => setActiveTab('cotizaciones')}>Cotizaciones</button>
              <button onClick={() => setActiveTab('pedidos')}>Pedidos</button>
            </div>
          )}
        </div>

        {role === 'admin' && (
          <button 
            className={`sidebar-item ${activeTab === 'reportes' ? 'active' : ''}`} 
            onClick={() => setActiveTab('reportes')}
          >
            📈 Reportes
          </button>
        )}

        <button className="logout-button" onClick={handleLogout}>
          Cerrar sesión
        </button>
      </aside>

      <main className="dashboard-content">
        <header className="dashboard-header">
          <h1>METALES GALVANIZADOS Y ACEROS S.R.L.</h1>
          <span className="welcome-text">
            Bienvenido, {localStorage.getItem('username')}
          </span>
        </header>

        {renderActiveTabContent()}
      </main>
    </div>
  );
};

export default Dashboard;