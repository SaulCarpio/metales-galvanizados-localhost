import React, { useState, useEffect, useCallback } from 'react';
import './Cotizaciones.css';
import { cotizacionesAPI } from '../utils/api';

const DetalleRow = ({ item, onChange, onRemove }) => (
    <div className="detalle-row">
      <input type="number" placeholder="Cant." className="detalle-input" value={item.cantidad || ""} onChange={(e) => onChange(item.id, "cantidad", e.target.value)} />
      <input type="number" placeholder="Longitud (m)" className="detalle-input" value={item.longitud || ""} onChange={(e) => onChange(item.id, "longitud", e.target.value)} />
      <span className="subtotal-mts">{(Number(item.cantidad || 0) * Number(item.longitud || 0)).toFixed(2)} mts</span>
      <button type="button" className="btn-remove-row" onClick={() => onRemove(item.id)}>✖</button>
    </div>
);

const Cotizaciones = () => {
  const [cliente, setCliente] = useState("");
  const [producto, setProducto] = useState("");
  const [color, setColor] = useState("");
  const [tipoCumbrera, setTipoCumbrera] = useState("");
  const [showCalaminas, setShowCalaminas] = useState(false);
  const [showCumbreras, setShowCumbreras] = useState(false);
  const [calaminas, setCalaminas] = useState([]);
  const [cumbreras, setCumbreras] = useState([]);
  const [cotizacionesList, setCotizacionesList] = useState([]);
  
  // --- CORRECCIÓN AQUÍ ---
  const [loadingList, setLoadingList] = useState(true); // Para la tabla
  const [isSaving, setIsSaving] = useState(false); // Para el formulario

  const productosOficiales = ["Ondulado", "Trapezoidal", "Teja Colonial", "Teja América"];
  const coloresOficiales = ["Azul", "Rojo", "Naranja", "Turquesa", "Verde", "Vino Shingle", "Café Shingle", "Rojo Shingle", "Naranja Shingle", "Zincalum"];
  const cumbreraTipos = ["Corte 33", "Corte 50"];

  const loadCotizaciones = useCallback(async () => {
    setLoadingList(true);
    try {
      const res = await cotizacionesAPI.list();
      const cotizacionesData = res?.data?.cotizaciones || [];
      if (res?.success && Array.isArray(cotizacionesData)) {
        setCotizacionesList(cotizacionesData);
      } else {
        setCotizacionesList([]);
      }
    } catch (err) {
      console.error('Error cargando cotizaciones:', err);
      setCotizacionesList([]);
    } finally {
      setLoadingList(false);
    }
  }, []);

  useEffect(() => {
    loadCotizaciones();
  }, [loadCotizaciones]);

  const addDetalle = (tipo) => {
    const newItem = { id: Date.now(), cantidad: "", longitud: "", subtotal: 0 };
    if (tipo === "calamina") setCalaminas([...calaminas, newItem]);
    else setCumbreras([...cumbreras, newItem]);
  };

  const updateDetalle = (id, tipo, field, value) => {
    const updater = (items) => items.map(item => {
      if (item.id === id) {
        const updatedItem = { ...item, [field]: value };
        const precioEjemplo = 31; 
        updatedItem.subtotal = (Number(updatedItem.cantidad || 0) * Number(updatedItem.longitud || 0)) * precioEjemplo;
        return updatedItem;
      }
      return item;
    });
    if (tipo === "calamina") setCalaminas(updater(calaminas));
    else setCumbreras(updater(cumbreras));
  };
  
  const removeDetalle = (id, tipo) => {
    if (tipo === "calamina") setCalaminas(calaminas.filter((i) => i.id !== id));
    else setCumbreras(cumbreras.filter((i) => i.id !== id));
  };

  const totalCalaminas = calaminas.reduce((sum, i) => sum + Number(i.cantidad || 0) * Number(i.longitud || 0), 0);
  const totalCumbreras = cumbreras.reduce((sum, i) => sum + Number(i.cantidad || 0) * Number(i.longitud || 0), 0);
  const totalGeneral = totalCalaminas + totalCumbreras;

  const handleLimpiar = () => {
    setCliente("");
    setProducto("");
    setColor("");
    setTipoCumbrera("");
    setShowCalaminas(false);
    setShowCumbreras(false);
    setCalaminas([]);
    setCumbreras([]);
  };

  const handleCopiar = () => {
    // 1. Validaciones básicas
    if (!cliente && !producto) {
      alert("Por favor, ingrese el nombre del cliente y seleccione un producto antes de copiar.");
      return;
    }
    if (!showCalaminas && !showCumbreras) {
      alert("Por favor, agregue detalles de calaminas o cumbreras.");
      return;
    }

    // 2. Construcción del texto a copiar
    let textoACopiar = `*COTIZACIÓN - METALES GALVANIZADOS Y ACEROS S.R.L.*\n\n`;
    textoACopiar += `*Cliente:* ${cliente || 'N/A'}\n`;
    textoACopiar += `*Producto:* ${producto || 'N/A'}\n`;
    if (color) {
      textoACopiar += `*Color:* ${color}\n`;
    }
    textoACopiar += `------------------------------------\n`;

    // 3. Sección de Calaminas
    if (showCalaminas && calaminas.length > 0) {
      textoACopiar += `*DETALLE DE CALAMINAS:*\n`;
      calaminas.forEach(item => {
        const cantidad = Number(item.cantidad || 0);
        const longitud = Number(item.longitud || 0);
        if (cantidad > 0 && longitud > 0) {
          const subtotalMetros = (cantidad * longitud).toFixed(2);
          textoACopiar += `- ${cantidad} u. de ${longitud} m = *${subtotalMetros} mts*\n`;
        }
      });
      textoACopiar += `*Subtotal Calaminas:* ${totalCalaminas.toFixed(2)} mts\n`;
      textoACopiar += `------------------------------------\n`;
    }

    // 4. Sección de Cumbreras
    if (showCumbreras && cumbreras.length > 0) {
      textoACopiar += `*DETALLE DE CUMBRERAS (${tipoCumbrera || 'N/A'}):*\n`;
      cumbreras.forEach(item => {
        const cantidad = Number(item.cantidad || 0);
        const longitud = Number(item.longitud || 0);
        if (cantidad > 0 && longitud > 0) {
          const subtotalMetros = (cantidad * longitud).toFixed(2);
          textoACopiar += `- ${cantidad} u. de ${longitud} m = *${subtotalMetros} mts*\n`;
        }
      });
      textoACopiar += `*Subtotal Cumbreras:* ${totalCumbreras.toFixed(2)} mts\n`;
      textoACopiar += `------------------------------------\n`;
    }

    // 5. Total General
    textoACopiar += `*TOTAL GENERAL EN METROS:* *${totalGeneral.toFixed(2)} mts*\n\n`;
    textoACopiar += `_Esta es una cotización preliminar. Precios sujetos a cambio._\n`;

    // 6. Copiar al portapapeles y notificar al usuario
    navigator.clipboard.writeText(textoACopiar).then(() => {
      alert("✅ Cotización copiada al portapapeles. ¡Lista para pegar en WhatsApp!");
    }).catch(err => {
      console.error('Error al copiar: ', err);
      alert("❌ Hubo un error al intentar copiar el texto.");
    });
  };

  const handleOpenPDF = useCallback(async (id) => {
    try {
      const response = await cotizacionesAPI.getPDF(id);
      if (response.success) {
        const file = new Blob([response.data], { type: 'application/pdf' });
        const fileURL = URL.createObjectURL(file);
        window.open(fileURL, '_blank');
      } else {
        alert('Error al generar el PDF: ' + response.message);
      }
    } catch (error) {
      alert('Error de red al intentar obtener el PDF.');
    }
  }, []);

  const handleGuardar = async () => {
    if (!producto) {
      alert("⚠️ Seleccione un producto");
      return;
    }
    setIsSaving(true);
    
    const payload = {
      nombre_cliente: cliente,
      producto,
      color,
      detalles: {
        calaminas,
        cumbreras,
        tipo_cumbrera: tipoCumbrera,
        total_calaminas: totalCalaminas,
        total_cumbreras: totalCumbreras,
      },
      cantidad: totalGeneral,
      precio_unitario: 0,
      estado: "emitida",
      fecha_expiracion: new Date(Date.now() + 2 * 86400000).toISOString()
    };
    
    try {
      const res = await cotizacionesAPI.create(payload);
      if (res && res.success) {
        alert('✅ Cotización guardada exitosamente');
        handleLimpiar();
        await loadCotizaciones();
        if (res.data.id) {
          await handleOpenPDF(res.data.id);
        }
      } else {
        alert("❌ No se pudo guardar la cotización: " + (res?.message || 'Error desconocido'));
      }
    } catch (err) {
      alert("❌ Error al guardar la cotización: " + err.message);
    } finally {
      setIsSaving(false);
    }
  };

  const eliminarCotizacion = async (id) => {
    if (!window.confirm("¿Está seguro de que desea eliminar esta cotización?")) return;
    try {
      const res = await cotizacionesAPI.delete(id);
      if (res && res.success) {
        alert('✅ Cotización eliminada');
        await loadCotizaciones();
      } else {
        alert('❌ Error al eliminar: ' + (res?.message || 'Error desconocido'));
      }
    } catch (err) {
      alert('❌ Error de red al eliminar.');
    }
  };

  return (
    <div className="cotizador-container">
      <div className="cotizador-form">
        <h2>Nueva Cotización</h2>
        
        <input className="form-input" placeholder="Nombre del cliente" value={cliente} onChange={(e) => setCliente(e.target.value)} />
        <select className="form-input" value={producto} onChange={(e) => setProducto(e.target.value)}>
          <option value="">Seleccione producto</option>
          {productosOficiales.map((p) => (<option key={p} value={p}>{p}</option>))}
        </select>
        <select className="form-input" value={color} onChange={(e) => setColor(e.target.value)}>
          <option value="">Seleccione color</option>
          {coloresOficiales.map((c) => (<option key={c} value={c}>{c}</option>))}
        </select>

        <div className="checkbox-container">
          <label><input type="checkbox" checked={showCalaminas} onChange={(e) => setShowCalaminas(e.target.checked)} /> Calaminas</label>
          <label><input type="checkbox" checked={showCumbreras} onChange={(e) => setShowCumbreras(e.target.checked)} /> Cumbreras</label>
        </div>

        {showCumbreras && (
          <select className="form-input" value={tipoCumbrera} onChange={(e) => setTipoCumbrera(e.target.value)}>
            <option value="">Seleccione tipo de cumbrera</option>
            {cumbreraTipos.map((t) => (<option key={t} value={t}>{t}</option>))}
          </select>
        )}

        {showCalaminas && (
          <div className="detalle-section">
            <h3 className="detalle-title">Detalle de Calaminas</h3>
            {calaminas.map((item) => <DetalleRow key={item.id} item={item} onChange={(id, field, val) => updateDetalle(id, "calamina", field, val)} onRemove={(id) => removeDetalle(id, "calamina")} />)}
            <button type="button" className="btn-agregar" onClick={() => addDetalle("calamina")}>+ Agregar Fila</button>
            <p className="total-mts">TOTAL CALAMINAS: {totalCalaminas.toFixed(2)} mts</p>
          </div>
        )}

        {showCumbreras && (
          <div className="detalle-section">
            <h3 className="detalle-title">Detalle de Cumbreras</h3>
            {cumbreras.map((item) => <DetalleRow key={item.id} item={item} onChange={(id, field, val) => updateDetalle(id, "cumbrera", field, val)} onRemove={(id) => removeDetalle(id, "cumbrera")} />)}
            <button type="button" className="btn-agregar" onClick={() => addDetalle("cumbrera")}>+ Agregar Fila</button>
            <p className="total-mts">TOTAL CUMBRERAS: {totalCumbreras.toFixed(2)} mts</p>
          </div>
        )}

        <p className="total-general">TOTAL GENERAL: {totalGeneral.toFixed(2)} MTS</p>

        <div className="final-buttons-container">
          <button className="btn-copiar" onClick={handleCopiar} disabled={isSaving}>📋 Copiar</button>
          <button className="btn-guardar-cot" onClick={handleGuardar} disabled={isSaving}>{isSaving ? 'Guardando...' : '💾 Guardar & PDF'}</button>
          <button className="btn-limpiar-final" onClick={handleLimpiar} disabled={isSaving}>🗑️ Limpiar</button>
        </div>
      </div>

      <div className="cotizaciones-list">
        <h3>Cotizaciones Guardadas ({cotizacionesList.length})</h3>
        {loadingList ? <p className="loading">Cargando...</p> : (
          <table>
            <thead>
              <tr>
                <th>ID</th><th>Cliente</th><th>Producto</th><th>Metros Totales</th><th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {cotizacionesList.length > 0 ? (
                cotizacionesList.map((c) => (
                  <tr key={c.id}>
                    <td>{c.id}</td>
                    <td>{c.nombre_cliente || 'Sin cliente'}</td>
                    <td>{c.producto} {c.color ? `(${c.color})` : ""}</td>
                    <td>{Number(c.cantidad || 0).toFixed(2)}</td>
                    <td className="acciones-cell">
                      <button className="btn-pdf" onClick={() => handleOpenPDF(c.id)}>PDF</button>
                      <button className="btn-eliminar" onClick={() => eliminarCotizacion(c.id)}>X</button>
                    </td>
                  </tr>
                ))
              ) : (
                <tr><td colSpan="5" style={{textAlign: 'center', padding: '20px'}}>No hay cotizaciones guardadas</td></tr>
              )}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
};

export default Cotizaciones;