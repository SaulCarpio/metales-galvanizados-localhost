import React, { useState } from 'react';

// Asegúrate de que las rutas a tus componentes son correctas
import UserCrud from './UserCrud';
import MapView from './MapView';
import Pedidos from './PedidosCrud';
import Cotizaciones from './CotizacionCrud';
import Reportes from './Reportes'; // <-- 1. IMPORTA EL NUEVO COMPONENTE

import './Dashboard.css';

const Dashboard = () => {
  // El estado inicial ahora es 'inicio' para ver el nuevo dashboard al cargar
  const [activeTab, setActiveTab] = useState('inicio'); 
  const [openModule, setOpenModule] = useState(null);
  
  const role = localStorage.getItem('role') || 'usuario';

  const handleLogout = () => {
    localStorage.clear();
    window.location.href = '/login'; 
  };

  const toggleModule = (module) => {
    setOpenModule(openModule === module ? null : module);
  };

  const renderActiveTabContent = () => {
    switch (activeTab) {
      // --- 2. SECCIÓN DE INICIO ACTUALIZADA CON GRÁFICOS ---
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
                <h4>Ventas por Categoría (Últimos 6 meses)</h4>
                {/* Aquí iría tu componente de gráfico de barras */}
                <div className="chart-placeholder"></div>
              </div>
              <div className="chart-container">
                <h4>Distribución de Pedidos</h4>
                {/* Aquí iría tu componente de gráfico de pastel */}
                <div className="chart-placeholder"></div>
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
              <h3>Historial de Viajes</h3>
              <ul className="history-list">
                <li><div className="hist-title">Ruta A</div><div className="hist-meta">2025-10-20 — Completado</div></li>
                <li><div className="hist-title">Ruta B</div><div className="hist-meta">2025-10-18 — En curso</div></li>
              </ul>
            </aside>
          </div>
        );
      // --- 3. AÑADIDO EL CASO PARA RENDERIZAR REPORTES ---
      case 'reportes':
        if (role === 'admin') return <Reportes />;
        return <div className="placeholder"><h2>Acceso Denegado</h2></div>;
      case 'usuarios':
        if (role === 'admin') return <UserCrud />;
        return <div className="placeholder"><h2>Acceso Denegado</h2></div>;
      case 'cotizaciones':
        return <Cotizaciones />;
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
              {openModule === 'finanzas' && ( <div className="sidebar-submenu"><button onClick={() => setActiveTab('cuentas')}>Gestión Cuentas</button></div> )}
            </div>
            <div className="sidebar-section">
              <button className="sidebar-item" onClick={() => toggleModule('inventario')}>
                🏭 Gestión de Inventario
              </button>
               {openModule === 'inventario' && ( <div className="sidebar-submenu"><button onClick={() => setActiveTab('existencias')}>Control Existencias</button></div> )}
            </div>
             <div className="sidebar-section">
              <button className="sidebar-item" onClick={() => toggleModule('compras')}>
                🛒 Compras y Proveedores
              </button>
              {openModule === 'compras' && ( <div className="sidebar-submenu"><button onClick={() => setActiveTab('ordenes')}>Órdenes de Compra</button></div> )}
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