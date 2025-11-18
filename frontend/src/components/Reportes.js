import React, { useState } from 'react';

const Reportes = () => {
  const [reportType, setReportType] = useState('ventas');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [reportData, setReportData] = useState(null);

  // Función para generar datos aleatorios según el tipo de reporte
  const generateRandomData = (type) => {
    const productos = ['Coca Cola', 'Pepsi', 'Sprite', 'Fanta', 'Agua Mineral', 'Jugo Naranja'];
    const clientes = ['Tienda El Sol', 'Minimarket Central', 'Bodega Los Andes', 'Super La Paz', 'Kiosko Norte'];
    const rutas = ['Ruta Norte', 'Ruta Sur', 'Ruta Centro', 'Ruta Este', 'Ruta Oeste'];

    switch(type) {
      case 'ventas':
        return Array.from({ length: 8 }, (_, i) => ({
          id: i + 1,
          producto: productos[Math.floor(Math.random() * productos.length)],
          cantidad: Math.floor(Math.random() * 100) + 10,
          precio: (Math.random() * 50 + 10).toFixed(2),
          total: (Math.random() * 5000 + 500).toFixed(2),
          fecha: new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000).toLocaleDateString()
        }));
      
      case 'inventario':
        return Array.from({ length: 8 }, (_, i) => ({
          id: i + 1,
          producto: productos[Math.floor(Math.random() * productos.length)],
          stock: Math.floor(Math.random() * 500) + 50,
          minimo: Math.floor(Math.random() * 50) + 20,
          estado: Math.random() > 0.3 ? 'Disponible' : 'Stock Bajo'
        }));
      
      case 'clientes':
        return Array.from({ length: 8 }, (_, i) => ({
          id: i + 1,
          nombre: clientes[Math.floor(Math.random() * clientes.length)],
          compras: Math.floor(Math.random() * 50) + 5,
          total: (Math.random() * 50000 + 5000).toFixed(2),
          ultimaCompra: new Date(Date.now() - Math.random() * 15 * 24 * 60 * 60 * 1000).toLocaleDateString()
        }));
      
      case 'rutas':
        return Array.from({ length: 6 }, (_, i) => ({
          id: i + 1,
          nombre: rutas[i],
          clientes: Math.floor(Math.random() * 20) + 5,
          ventasDia: (Math.random() * 10000 + 2000).toFixed(2),
          estado: Math.random() > 0.2 ? 'Completada' : 'En Proceso'
        }));
      
      default:
        return [];
    }
  };

  const handleGenerateReport = () => {
    if (!startDate || !endDate) {
      alert('Por favor seleccione ambas fechas');
      return;
    }

    const data = generateRandomData(reportType);
    setReportData(data);
  };

  const renderTable = () => {
    if (!reportData) return null;

    switch(reportType) {
      case 'ventas':
        return (
          <table className="report-table">
            <thead>
              <tr>
                <th>ID</th>
                <th>Producto</th>
                <th>Cantidad</th>
                <th>Precio Unit.</th>
                <th>Total</th>
                <th>Fecha</th>
              </tr>
            </thead>
            <tbody>
              {reportData.map(row => (
                <tr key={row.id}>
                  <td>{row.id}</td>
                  <td>{row.producto}</td>
                  <td>{row.cantidad}</td>
                  <td>Bs. {row.precio}</td>
                  <td>Bs. {row.total}</td>
                  <td>{row.fecha}</td>
                </tr>
              ))}
            </tbody>
          </table>
        );
      
      case 'inventario':
        return (
          <table className="report-table">
            <thead>
              <tr>
                <th>ID</th>
                <th>Producto</th>
                <th>Stock Actual</th>
                <th>Stock Mínimo</th>
                <th>Estado</th>
              </tr>
            </thead>
            <tbody>
              {reportData.map(row => (
                <tr key={row.id}>
                  <td>{row.id}</td>
                  <td>{row.producto}</td>
                  <td>{row.stock}</td>
                  <td>{row.minimo}</td>
                  <td>
                    <span className={`badge ${row.estado === 'Disponible' ? 'badge-success' : 'badge-warning'}`}>
                      {row.estado}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        );
      
      case 'clientes':
        return (
          <table className="report-table">
            <thead>
              <tr>
                <th>ID</th>
                <th>Cliente</th>
                <th>Compras</th>
                <th>Total Gastado</th>
                <th>Última Compra</th>
              </tr>
            </thead>
            <tbody>
              {reportData.map(row => (
                <tr key={row.id}>
                  <td>{row.id}</td>
                  <td>{row.nombre}</td>
                  <td>{row.compras}</td>
                  <td>Bs. {row.total}</td>
                  <td>{row.ultimaCompra}</td>
                </tr>
              ))}
            </tbody>
          </table>
        );
      
      case 'rutas':
        return (
          <table className="report-table">
            <thead>
              <tr>
                <th>ID</th>
                <th>Ruta</th>
                <th>Clientes</th>
                <th>Ventas del Día</th>
                <th>Estado</th>
              </tr>
            </thead>
            <tbody>
              {reportData.map(row => (
                <tr key={row.id}>
                  <td>{row.id}</td>
                  <td>{row.nombre}</td>
                  <td>{row.clientes}</td>
                  <td>Bs. {row.ventasDia}</td>
                  <td>
                    <span className={`badge ${row.estado === 'Completada' ? 'badge-success' : 'badge-info'}`}>
                      {row.estado}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        );
      
      default:
        return null;
    }
  };

  const calculateTotal = () => {
    if (!reportData) return 0;
    
    switch(reportType) {
      case 'ventas':
        return reportData.reduce((sum, row) => sum + parseFloat(row.total), 0).toFixed(2);
      case 'clientes':
        return reportData.reduce((sum, row) => sum + parseFloat(row.total), 0).toFixed(2);
      case 'rutas':
        return reportData.reduce((sum, row) => sum + parseFloat(row.ventasDia), 0).toFixed(2);
      default:
        return 0;
    }
  };

  return (
    <div style={styles.container}>
      <h2 style={styles.title}>Generador de Reportes</h2>
      <p style={styles.subtitle}>Seleccione los filtros para generar un nuevo reporte.</p>
      
      <div style={styles.filters}>
        <div style={styles.filterGroup}>
          <label style={styles.label}>Tipo de Reporte</label>
          <select 
            value={reportType} 
            onChange={(e) => setReportType(e.target.value)}
            style={styles.select}
          >
            <option value="ventas">Reporte de Ventas</option>
            <option value="inventario">Reporte de Inventario</option>
            <option value="clientes">Reporte de Clientes</option>
            <option value="rutas">Reporte de Rutas</option>
          </select>
        </div>
        
        <div style={styles.filterGroup}>
          <label style={styles.label}>Fecha de Inicio</label>
          <input 
            type="date" 
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            style={styles.input}
          />
        </div>
        
        <div style={styles.filterGroup}>
          <label style={styles.label}>Fecha de Fin</label>
          <input 
            type="date" 
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            style={styles.input}
          />
        </div>
      </div>
      
      <div style={styles.actions}>
        <button onClick={handleGenerateReport} style={styles.button}>
          Generar Reporte
        </button>
      </div>

      {reportData && (
        <div style={styles.reportContainer}>
          <div style={styles.reportHeader}>
            <h3 style={styles.reportTitle}>
              {reportType === 'ventas' && 'Reporte de Ventas'}
              {reportType === 'inventario' && 'Reporte de Inventario'}
              {reportType === 'clientes' && 'Reporte de Clientes'}
              {reportType === 'rutas' && 'Reporte de Rutas'}
            </h3>
            <p style={styles.reportDates}>
              Período: {startDate} - {endDate}
            </p>
          </div>

          {renderTable()}

          {(reportType === 'ventas' || reportType === 'clientes' || reportType === 'rutas') && (
            <div style={styles.summary}>
              <strong>Total: Bs. {calculateTotal()}</strong>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

const styles = {
  container: {
    padding: '20px',
    maxWidth: '1200px',
    margin: '0 auto',
    fontFamily: 'Arial, sans-serif',
    animation: 'fadeIn 0.5s ease-in-out'
  },
  title: {
    color: '#333',
    marginBottom: '10px'
  },
  subtitle: {
    color: '#666',
    marginBottom: '30px'
  },
  filters: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
    gap: '20px',
    backgroundColor: '#fff',
    padding: '20px',
    borderRadius: '8px',
    boxShadow: '0 4px 8px rgba(0, 0, 0, 0.05)',
    marginBottom: '30px'
  },
  filterGroup: {
    display: 'flex',
    flexDirection: 'column'
  },
  label: {
    marginBottom: '8px',
    fontWeight: '500',
    color: '#444'
  },
  input: {
    padding: '10px',
    border: '1px solid #ddd',
    borderRadius: '4px',
    fontSize: '16px'
  },
  select: {
    padding: '10px',
    border: '1px solid #ddd',
    borderRadius: '4px',
    fontSize: '16px',
    backgroundColor: 'white',
    cursor: 'pointer'
  },
  actions: {
    textAlign: 'right',
    marginBottom: '30px'
  },
  button: {
    backgroundColor: '#0077aa',
    color: 'white',
    padding: '12px 25px',
    border: 'none',
    borderRadius: '5px',
    fontSize: '16px',
    fontWeight: 'bold',
    cursor: 'pointer',
    transition: 'background-color 0.2s'
  },
  reportContainer: {
    backgroundColor: '#fff',
    padding: '20px',
    borderRadius: '8px',
    boxShadow: '0 4px 8px rgba(0, 0, 0, 0.05)',
    animation: 'slideIn 0.3s ease-out'
  },
  reportHeader: {
    marginBottom: '20px',
    paddingBottom: '15px',
    borderBottom: '2px solid #0077aa'
  },
  reportTitle: {
    color: '#333',
    marginBottom: '5px'
  },
  reportDates: {
    color: '#666',
    fontSize: '14px'
  },
  summary: {
    marginTop: '20px',
    padding: '15px',
    backgroundColor: '#f8f9fa',
    borderRadius: '5px',
    textAlign: 'right',
    fontSize: '18px',
    color: '#333'
  }
};

// Estilos globales para la tabla
const styleSheet = document.createElement("style");
styleSheet.textContent = `
  @keyframes fadeIn {
    from { opacity: 0; transform: translateY(10px); }
    to { opacity: 1; transform: translateY(0); }
  }
  
  @keyframes slideIn {
    from { opacity: 0; transform: translateY(20px); }
    to { opacity: 1; transform: translateY(0); }
  }

  .report-table {
    width: 100%;
    border-collapse: collapse;
    margin-top: 10px;
  }

  .report-table th {
    background-color: #0077aa;
    color: white;
    padding: 12px;
    text-align: left;
    font-weight: 600;
  }

  .report-table td {
    padding: 10px 12px;
    border-bottom: 1px solid #ddd;
  }

  .report-table tbody tr:hover {
    background-color: #f8f9fa;
  }

  .badge {
    padding: 4px 12px;
    border-radius: 12px;
    font-size: 12px;
    font-weight: 600;
  }

  .badge-success {
    background-color: #d4edda;
    color: #155724;
  }

  .badge-warning {
    background-color: #fff3cd;
    color: #856404;
  }

  .badge-info {
    background-color: #d1ecf1;
    color: #0c5460;
  }
`;
document.head.appendChild(styleSheet);

export default Reportes;