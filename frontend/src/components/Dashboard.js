/* eslint-disable react-hooks/exhaustive-deps */
import React, { useState, useEffect } from 'react';

// Asegúrate de que las rutas a tus componentes son correctas
import UserCrud from './UserCrud';
import MapView from './MapView';
import Pedidos from './PedidosCrud';
import Cotizaciones from './CotizacionCrud';
import Reportes from './Reportes';
import { SummaryCards, InventoryList } from './Charts';
import { cotizacionesAPI, pedidosAPI, inventarioAPI } from '../utils/api';
import ProveedorCrud from './ProveedorCrud';
import OrdenCompraCrud from './OrdenCompraCrud';
import CuentasPagarCrud from './CuentasPagarCrud';
import MovimientosPagoCrud from './MovimientosPagoCrud';
import ProductoCrud from './ProductoCrud'; // ← IMPORTAR
import InventarioCrud from './InventarioCrud';

import './Dashboard.css';

const Dashboard = () => {
  const [activeTab, setActiveTab] = useState('inicio'); 
  const [openModule, setOpenModule] = useState(null);
  
  const role = localStorage.getItem('role') || 'usuario';

  const [cotizacionesData, setCotizacionesData] = useState([]);
  const [pedidosData, setPedidosData] = useState([]);
  const [inventarioData, setInventarioData] = useState([]);

  useEffect(() => {
    (async () => {
      try {
        const [cRes, pRes, iRes] = await Promise.all([
          cotizacionesAPI.list().catch(() => ({})),
          pedidosAPI.list().catch(() => ({})),
          inventarioAPI.list().catch(() => ({}))
        ]);
        setCotizacionesData(cRes.data && cRes.data.success ? (cRes.data.cotizaciones || []) : []);
        setPedidosData(pRes.data && pRes.data.success ? (pRes.data.pedidos || []) : []);
        setInventarioData(iRes.data && iRes.data.success ? (iRes.data.inventario || []) : []);
      } catch (e) { console.error('Error cargando datos dashboard', e); }
    })();
  }, []);

  useEffect(() => {
    if (activeTab !== 'map') return;
    (async () => {
      try {
        const pRes = await pedidosAPI.list();
        setPedidosData(pRes.data && pRes.data.success ? (pRes.data.pedidos || []) : []);
      } catch (e) { console.error('Error recargando pedidos para mapa', e); }
    })();
  }, [activeTab]);

  const handleLogout = () => {
    localStorage.clear();
    window.location.href = '/login'; 
  };

  const toggleModule = (module) => {
    setOpenModule(openModule === module ? null : module);
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
                <p>12</p>
              </div>
              <div className="stat-card">
                <h3>Nuevos Clientes</h3>
                <p>8</p>
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
              <h3>Pedidos pendientes</h3>
              <ul className="history-list">
                {pedidosData && pedidosData.filter(p => p.estado === 'pendiente').length === 0 && (
                  <li>No hay pedidos pendientes</li>
                )}
                {pedidosData && pedidosData.filter(p => p.estado === 'pendiente').map(p => (
                  <li key={p.id} style={{display:'flex',flexDirection:'column',gap:6}}>
                    <div style={{display:'flex',justifyContent:'space-between'}}>
                      <div className="hist-title">Pedido #{p.id}</div>
                      <div className="hist-meta">Cliente: {p.cliente_id || 'N/A'}</div>
                    </div>
                    <div style={{display:'flex',gap:8}}>
                      <button className="btn btn-primary" onClick={() => {
                        try { localStorage.setItem('openMapPedido', JSON.stringify({ pedidoId: p.id })); } catch(e){/* ignore */}
                        window.location.reload();
                      }}>Abrir en Mapa</button>
                      <button className="btn btn-secondary" onClick={async () => {
                        try {
                          await pedidosAPI.update(p.id, { estado: 'completado' });
                          const pRes = await pedidosAPI.list();
                          setPedidosData(pRes.data && pRes.data.success ? (pRes.data.pedidos || []) : []);
                          alert('Pedido marcado como entregado');
                        } catch (e) { console.error(e); alert('Error marcando pedido'); }
                      }}>Marcar entregado</button>
                    </div>
                  </li>
                ))}
              </ul>
            </aside>
          </div>
        );

      case 'reportes':
        if (role === 'admin') return <Reportes />;
        return <div className="placeholder"><h2>Acceso Denegado</h2></div>;

      case 'usuarios':
        if (role === 'admin') return <UserCrud />;
        return <div className="placeholder"><h2>Acceso Denegado</h2></div>;

      case 'cotizaciones':
        return <Cotizaciones />;

      case 'proveedores':
        return <ProveedorCrud />;

      case 'ordenes':
        return <OrdenCompraCrud />;

      case 'cuentas':
        return (
          <div>
            <CuentasPagarCrud />
            <MovimientosPagoCrud />
          </div>
        );

      // ← CORREGIDO: Renderizar el componente ProductoCrud
      case 'fabrica':
        return <ProductoCrud />;

      case 'existencias':
        return <InventarioCrud />;

      case 'pedidos':
        return <Pedidos />;

      default:
        return (
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
        
        <button className={`sidebar-item ${activeTab === 'inicio' ? 'active' : ''}`} onClick={() => setActiveTab('inicio')}>
          🏠 Inicio
        </button>

        {role === 'admin' && (
          <button className={`sidebar-item ${activeTab === 'usuarios' ? 'active' : ''}`} onClick={() => setActiveTab('usuarios')}>
            👥 Usuarios
          </button>
        )}

        <div className="sidebar-section">
          <button className="sidebar-item" onClick={() => toggleModule('logistica')}>
            🚚 Logística y Distribución
          </button>
          {openModule === 'logistica' && (
            <div className="sidebar-submenu">
              <button onClick={() => setActiveTab('map')}>Rutas</button>
            </div>
          )}
        </div>
        
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

            {/* ← CORREGIDO: Agregar Gestión Fábrica al submenu */}
            <div className="sidebar-section">
              <button className="sidebar-item" onClick={() => toggleModule('inventario')}>
                🏭 Gestión de Inventario
              </button>
              {openModule === 'inventario' && (
                <div className="sidebar-submenu">
                  <button onClick={() => setActiveTab('fabrica')}>Gestión Fábrica</button>
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
          <button className={`sidebar-item ${activeTab === 'reportes' ? 'active' : ''}`} onClick={() => setActiveTab('reportes')}>
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