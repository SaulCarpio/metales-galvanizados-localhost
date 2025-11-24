import React, { useEffect, useState } from 'react';
import { movimientosAPI, finanzasAPI } from '../utils/api';
import './UserCrud.css';

const MovimientosPagoCrud = () => {
  const [movs, setMovs] = useState([]);
  const [cuentas, setCuentas] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [form, setForm] = useState({ 
    cuenta_pagar_id: '', 
    monto: '', 
    metodo_pago_id: '', 
    referencia_pago: '', 
    nota: '' 
  });

  useEffect(() => { 
    fetchData(); 
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);
      
      // Cargar movimientos
      const resM = await movimientosAPI.list();
      console.log('Respuesta movimientos:', resM);
      if (resM.success && resM.data?.movimientos) {
        setMovs(resM.data.movimientos);
      } else {
        setMovs([]);
      }

      // Cargar cuentas por pagar
      const resC = await finanzasAPI.listCuentasPagar();
      console.log('Respuesta cuentas:', resC);
      if (resC.success && resC.data?.cuentas_pagar) {
        setCuentas(resC.data.cuentas_pagar);
      } else {
        setCuentas([]);
      }
    } catch (e) {
      console.error('Error cargando datos:', e);
      setError('Error al cargar los datos');
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    
    // Validación
    if (!form.monto || parseFloat(form.monto) <= 0) {
      alert('⚠️ El monto debe ser mayor a 0');
      return;
    }

    try {
      setLoading(true);
      setError(null);

      // Preparar payload
      const payload = {
        cuenta_pagar_id: form.cuenta_pagar_id ? Number(form.cuenta_pagar_id) : null,
        monto: parseFloat(form.monto),
        metodo_pago_id: form.metodo_pago_id ? Number(form.metodo_pago_id) : null,
        referencia_pago: form.referencia_pago || '',
        nota: form.nota || ''
      };

      console.log('Enviando payload:', payload);

      const res = await movimientosAPI.create(payload);
      console.log('Respuesta crear:', res);

      if (res.success) {
        alert('✅ Movimiento registrado correctamente');
        fetchData();
        // Reset form
        setForm({ 
          cuenta_pagar_id: '', 
          monto: '', 
          metodo_pago_id: '', 
          referencia_pago: '', 
          nota: '' 
        });
      } else {
        alert('⚠️ ' + (res.message || 'Error al registrar el movimiento'));
      }
    } catch (err) {
      console.error('Error creando movimiento:', err);
      setError('Error al registrar el movimiento');
      alert('❌ Error al registrar el movimiento');
    } finally {
      setLoading(false);
    }
  };

  // Función para formatear fecha
  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString('es-BO', { 
        year: 'numeric', 
        month: '2-digit', 
        day: '2-digit' 
      });
    } catch {
      return dateString;
    }
  };

  // Función para formatear moneda
  const formatMoney = (amount) => {
    return `Bs. ${parseFloat(amount || 0).toFixed(2)}`;
  };

  return (
    <div className="user-crud-container">
      <h2>💰 Movimientos de Pago</h2>

      {error && (
        <div style={{
          padding: '15px',
          background: '#fee',
          color: '#c00',
          borderRadius: '8px',
          marginBottom: '20px'
        }}>
          {error}
        </div>
      )}

      <form onSubmit={handleCreate} className="user-form">
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
          <div>
            <label style={{ display: 'block', marginBottom: '5px', fontWeight: '600' }}>
              Cuenta por Pagar (opcional)
            </label>
            <select 
              name="cuenta_pagar_id" 
              value={form.cuenta_pagar_id} 
              onChange={handleChange}
              disabled={loading}
              style={{ width: '100%', padding: '8px' }}
            >
              <option value="">-- Seleccionar cuenta --</option>
              {cuentas.map(c => (
                <option value={c.id} key={c.id}>
                  {c.referencia || `Cuenta ${c.id}`} - {formatMoney(c.monto_total)}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label style={{ display: 'block', marginBottom: '5px', fontWeight: '600' }}>
              Monto <span style={{ color: 'red' }}>*</span>
            </label>
            <input 
              type="number" 
              name="monto" 
              value={form.monto} 
              onChange={handleChange} 
              placeholder="0.00" 
              step="0.01"
              min="0.01"
              required 
              disabled={loading}
              style={{ width: '100%', padding: '8px' }}
            />
          </div>

          <div>
            <label style={{ display: 'block', marginBottom: '5px', fontWeight: '600' }}>
              Método de Pago ID (opcional)
            </label>
            <input 
              type="number"
              name="metodo_pago_id" 
              value={form.metodo_pago_id} 
              onChange={handleChange} 
              placeholder="ID método pago" 
              disabled={loading}
              style={{ width: '100%', padding: '8px' }}
            />
          </div>

          <div>
            <label style={{ display: 'block', marginBottom: '5px', fontWeight: '600' }}>
              Referencia de Pago
            </label>
            <input 
              name="referencia_pago" 
              value={form.referencia_pago} 
              onChange={handleChange} 
              placeholder="Ej: Transferencia #12345" 
              disabled={loading}
              style={{ width: '100%', padding: '8px' }}
            />
          </div>
        </div>

        <div style={{ marginTop: '15px' }}>
          <label style={{ display: 'block', marginBottom: '5px', fontWeight: '600' }}>
            Nota / Observaciones
          </label>
          <textarea 
            name="nota" 
            value={form.nota} 
            onChange={handleChange} 
            placeholder="Observaciones adicionales..." 
            rows="3"
            disabled={loading}
            style={{ width: '100%', padding: '8px', resize: 'vertical' }}
          />
        </div>

        <button 
          type="submit" 
          disabled={loading}
          style={{ marginTop: '15px' }}
        >
          {loading ? '⏳ Registrando...' : '✅ Registrar Movimiento'}
        </button>
      </form>

      <hr style={{ margin: '30px 0' }} />

      <h3>📋 Historial de Movimientos</h3>

      {loading && movs.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '40px', color: '#666' }}>
          Cargando movimientos...
        </div>
      ) : movs.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '40px', color: '#666' }}>
          No hay movimientos registrados
        </div>
      ) : (
        <table className="user-table">
          <thead>
            <tr>
              <th>ID</th>
              <th>Cuenta Pagar</th>
              <th>Monto</th>
              <th>Fecha</th>
              <th>Método Pago</th>
              <th>Referencia</th>
              <th>Nota</th>
            </tr>
          </thead>
          <tbody>
            {movs.map(m => (
              <tr key={m.id}>
                <td>{m.id}</td>
                <td>{m.cuenta_pagar_id || '-'}</td>
                <td style={{ fontWeight: '600', color: '#0077b6' }}>
                  {formatMoney(m.monto)}
                </td>
                <td>{formatDate(m.fecha_pago)}</td>
                <td>{m.metodo_pago_id || '-'}</td>
                <td>{m.referencia_pago || '-'}</td>
                <td>{m.nota || '-'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
};

export default MovimientosPagoCrud;