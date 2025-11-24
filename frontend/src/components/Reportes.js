import React, { useState, useEffect, useCallback } from 'react';
import { cotizacionesAPI, pedidosAPI, inventarioAPI } from '../utils/api';
import { SummaryCards, InventoryList } from './Charts';

// --- SECCIÓN CORREGIDA PARA IMPORTAR Y REGISTRAR EL PLUGIN ---
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable'; // <-- Importamos la función directamente

// Estilos básicos para no depender de CSS externo
const styles = {
  container: { padding: '24px', maxWidth: '1200px', margin: 'auto', fontFamily: 'sans-serif' },
  header: { fontSize: '28px', fontWeight: '600', marginBottom: '20px' },
  filters: { display: 'flex', gap: '12px', alignItems: 'center', marginBottom: '24px', flexWrap: 'wrap' },
  reportContainer: { marginTop: '20px', padding: '20px', background: '#fff', borderRadius: '8px', boxShadow: '0 2px 10px rgba(0,0,0,0.05)'},
  table: { width: '100%', borderCollapse: 'collapse', marginTop: '20px' },
  th: { padding: '12px', border: '1px solid #eee', background: '#f8f9fa', fontWeight: '600', textAlign: 'left' },
  td: { padding: '12px', border: '1px solid #eee' },
};

const Reportes = () => {
  const [reportType, setReportType] = useState('cotizaciones');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [allData, setAllData] = useState([]); // Datos sin filtrar
  const [filteredData, setFilteredData] = useState([]); // Datos filtrados por fecha
  const [loading, setLoading] = useState(false);

  const fetchReportData = useCallback(async (type) => {
    setLoading(true);
    setAllData([]);
    try {
      let response;
      if (type === 'cotizaciones') {
        response = await cotizacionesAPI.list();
        setAllData(response.success ? (response.data.cotizaciones || []) : []);
      } else if (type === 'pedidos') {
        response = await pedidosAPI.list();
        setAllData(response.success ? (response.data.pedidos || []) : []);
      } else if (type === 'inventario') {
        response = await inventarioAPI.list();
        setAllData(response.success ? (response.data.inventario || []) : []);
      }
    } catch (e) {
      console.error('Error cargando reporte', e);
      setAllData([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchReportData(reportType);
  }, [reportType, fetchReportData]);

  useEffect(() => {
    let dataToFilter = [...allData];
    if (startDate) {
      const start = new Date(startDate);
      dataToFilter = dataToFilter.filter(item => {
        const itemDate = new Date(item.fecha_emitida || item.fecha_pedido);
        return itemDate >= start;
      });
    }
    if (endDate) {
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);
      dataToFilter = dataToFilter.filter(item => {
        const itemDate = new Date(item.fecha_emitida || item.fecha_pedido);
        return itemDate <= end;
      });
    }
    setFilteredData(dataToFilter);
  }, [startDate, endDate, allData]);

  const handleExportPDF = () => {
    const doc = new jsPDF();
    
    const tableData = filteredData.map(item => {
        if (reportType === 'cotizaciones') {
            return [item.id, item.nombre_cliente, item.producto, item.cantidad, item.estado];
        }
        if (reportType === 'pedidos') {
            return [item.id, item.cliente_info?.nombre || 'N/A', Number(item.total).toFixed(2), item.estado];
        }
        return [];
    });
    
    const headers = reportType === 'cotizaciones'
        ? [['ID', 'Cliente', 'Producto', 'Cantidad', 'Estado']]
        : [['ID', 'Cliente', 'Total (Bs.)', 'Estado']];

    doc.text(`Reporte de ${reportType.charAt(0).toUpperCase() + reportType.slice(1)}`, 14, 15);
    
    // --- AQUÍ ESTÁ LA CORRECCIÓN ---
    // Se llama a autoTable como una función, pasándole el objeto 'doc'
    autoTable(doc, {
        startY: 20,
        head: headers,
        body: tableData,
    });

    doc.save(`reporte_${reportType}.pdf`);
  };

  const renderContent = () => {
    if (loading) return <div>Cargando...</div>;
    if (!filteredData || filteredData.length === 0) return <div>No hay datos para mostrar con los filtros seleccionados.</div>;
    
    switch (reportType) {
      case 'cotizaciones': return <RenderCotizaciones data={filteredData} />;
      case 'pedidos': return <RenderPedidos data={filteredData} />;
      case 'inventario': return <RenderInventario data={filteredData} />;
      default: return null;
    }
  };

  return (
    <div style={styles.container}>
      <h2 style={styles.header}>Generador de Reportes</h2>
      <div style={styles.filters}>
        <select value={reportType} onChange={e => setReportType(e.target.value)}>
          <option value="cotizaciones">Cotizaciones</option>
          <option value="pedidos">Pedidos</option>
          <option value="inventario">Inventario</option>
        </select>
        <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} />
        <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} />
        <button onClick={() => fetchReportData(reportType)} style={{ padding: '8px 14px' }}>Recargar</button>
        {filteredData.length > 0 && reportType !== 'inventario' && (
          <button onClick={handleExportPDF} style={{ padding: '8px 14px', background: '#28a745', color: 'white', border: 'none', cursor: 'pointer' }}>Exportar a PDF</button>
        )}
      </div>

      <div style={styles.reportContainer}>
        {renderContent()}
      </div>
    </div>
  );
};

// --- Sub-componentes para renderizar cada tipo de reporte ---

const RenderCotizaciones = ({ data }) => (
  <div>
    <SummaryCards title="Cotizaciones" rows={data} />
    <h4 style={{ marginTop: '20px' }}>Listado de Cotizaciones</h4>
    <table style={styles.table}>
      <thead><tr><th style={styles.th}>ID</th><th style={styles.th}>Cliente</th><th style={styles.th}>Producto</th><th style={styles.th}>Cantidad</th><th style={styles.th}>Estado</th></tr></thead>
      <tbody>
        {data.map(r => (
          <tr key={r.id}>
            <td style={styles.td}>{r.id}</td><td style={styles.td}>{r.nombre_cliente}</td><td style={styles.td}>{r.producto}</td>
            <td style={styles.td}>{r.cantidad}</td><td style={styles.td}>{r.estado}</td>
          </tr>
        ))}
      </tbody>
    </table>
  </div>
);

const RenderPedidos = ({ data }) => (
  <div>
    <SummaryCards title="Pedidos" rows={data} />
    <h4 style={{ marginTop: '20px' }}>Listado de Pedidos</h4>
    <table style={styles.table}>
      <thead><tr><th style={styles.th}>ID</th><th style={styles.th}>Cliente</th><th style={styles.th}>Total (Bs.)</th><th style={styles.th}>Estado</th></tr></thead>
      <tbody>
        {data.map(r => (
          <tr key={r.id}>
            <td style={styles.td}>{r.id}</td><td style={styles.td}>{r.cliente_info?.nombre || 'N/A'}</td>
            <td style={styles.td}>{Number(r.total).toFixed(2)}</td><td style={styles.td}>{r.estado}</td>
          </tr>
        ))}
      </tbody>
    </table>
  </div>
);

const RenderInventario = ({ data }) => (
  <InventoryList rows={data} />
);

export default Reportes;