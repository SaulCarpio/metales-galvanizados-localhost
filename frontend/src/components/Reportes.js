import React, { useState, useEffect } from 'react';
import { cotizacionesAPI, pedidosAPI, inventarioAPI } from '../utils/api';
import { SummaryCards, InventoryList } from './Charts';

const Reportes = () => {
  const [reportType, setReportType] = useState('cotizaciones');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [reportData, setReportData] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => { fetchReport(); }, [reportType]);

  const fetchReport = async () => {
    setLoading(true);
    try {
      if (reportType === 'cotizaciones') {
        const r = await cotizacionesAPI.list();
        setReportData(r.data && r.data.success ? (r.data.cotizaciones || []) : []);
      } else if (reportType === 'pedidos') {
        const r = await pedidosAPI.list();
        setReportData(r.data && r.data.success ? (r.data.pedidos || []) : []);
      } else if (reportType === 'inventario') {
        const r = await inventarioAPI.list();
        setReportData(r.data && r.data.success ? (r.data.inventario || []) : []);
      }
    } catch (e) {
      console.error('Error cargando reporte', e);
      setReportData([]);
    }
    setLoading(false);
  };

  const handleGenerateReport = () => fetchReport();

  const renderCotizaciones = () => {
    const rows = reportData || [];
    return (
      <div>
        <SummaryCards title="Cotizaciones" rows={rows} />
        <div style={{marginTop:14}}>
          <h4>Listado de Cotizaciones</h4>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th>ID</th>
                <th>Cliente</th>
                <th>Producto</th>
                <th>Cantidad</th>
                <th>Estado</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(r => (
                <tr key={r.id}>
                  <td style={{ padding: 6, border: '1px solid #eee' }}>{r.id}</td>
                  <td style={{ padding: 6, border: '1px solid #eee' }}>{r.nombre_cliente || r.cliente_nombre || r.cliente_id}</td>
                  <td style={{ padding: 6, border: '1px solid #eee' }}>{r.producto || ''}</td>
                  <td style={{ padding: 6, border: '1px solid #eee' }}>{r.cantidad || ''}</td>
                  <td style={{ padding: 6, border: '1px solid #eee' }}>{r.estado}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  const renderPedidos = () => {
    const rows = reportData || [];
    return (
      <div>
        <SummaryCards title="Pedidos" rows={rows} />
        <div style={{marginTop:14}}>
          <h4>Pedidos</h4>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr><th>ID</th><th>Cliente</th><th>Total</th><th>Estado</th></tr>
            </thead>
            <tbody>
              {rows.map(r => (
                <tr key={r.id}>
                  <td style={{ padding: 6, border: '1px solid #eee' }}>{r.id}</td>
                  <td style={{ padding: 6, border: '1px solid #eee' }}>{r.cliente_nombre || r.cliente_id}</td>
                  <td style={{ padding: 6, border: '1px solid #eee' }}>{r.total}</td>
                  <td style={{ padding: 6, border: '1px solid #eee' }}>{r.estado}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  const renderInventario = () => {
    const rows = reportData || [];
    return (
      <div>
        <InventoryList rows={rows} />
      </div>
    );
  };

  return (
    <div style={{ padding: 20 }}>
      <h2>Reportes</h2>
      <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 12 }}>
        <select value={reportType} onChange={e => setReportType(e.target.value)}>
          <option value="cotizaciones">Cotizaciones</option>
          <option value="pedidos">Pedidos</option>
          <option value="inventario">Inventario</option>
        </select>
        <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} />
        <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} />
        <button onClick={handleGenerateReport} style={{ padding: '8px 14px' }}>Cargar</button>
      </div>

      {loading && <div>Cargando...</div>}
      {!loading && reportType === 'cotizaciones' && renderCotizaciones()}
      {!loading && reportType === 'pedidos' && renderPedidos()}
      {!loading && reportType === 'inventario' && renderInventario()}
    </div>
  );
};

export default Reportes;