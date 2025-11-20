import React, { useState, useEffect } from 'react';
import './Cotizaciones.css';
import { cotizacionesAPI } from '../utils/api';

// FILA DE DETALLE
const DetalleRow = ({ item, onChange, onRemove }) => (
  <div className="detalle-row">
    <input
      type="number"
      placeholder="Cant."
      className="detalle-input"
      value={item.cantidad}
      onChange={(e) => onChange(item.id, "cantidad", e.target.value)}
    />

    <input
      type="number"
      placeholder="Longitud (m)"
      className="detalle-input"
      value={item.longitud}
      onChange={(e) => onChange(item.id, "longitud", e.target.value)}
    />

    <span className="subtotal-mts">
      {(item.cantidad * item.longitud).toFixed(2)} mts
    </span>

    <button className="btn-remove-row" onClick={() => onRemove(item.id)}>
      ✖
    </button>
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

  const productosOficiales = [
    "Ondulado",
    "Trapezoidal",
    "Teja Colonial",
    "Teja América"
  ];

  const coloresOficiales = [
    "Azul",
    "Rojo",
    "Naranja",
    "Turquesa",
    "Verde",
    "Vino Shingle",
    "Café Shingle",
    "Rojo Shingle",
    "Naranja Shingle",
    "Zincalum"
  ];

  const cumbreraTipos = ["Corte 33", "Corte 50"];

  useEffect(() => {
    loadCotizaciones();
  }, []);

  const loadCotizaciones = async () => {
    try {
      const res = await cotizacionesAPI.list();
      if (res.data?.success) setCotizacionesList(res.data.cotizaciones);
    } catch (err) {
      console.error(err);
    }
  };

  const addDetalle = (tipo) => {
    const newItem = { id: Date.now(), cantidad: "", longitud: "" };
    if (tipo === "calamina") {
      setCalaminas([...calaminas, newItem]);
    } else {
      setCumbreras([...cumbreras, newItem]);
    }
  };

  const updateDetalle = (id, tipo, field, value) => {
    const updateFn = (arr) =>
      arr.map((item) =>
        item.id === id ? { ...item, [field]: value } : item
      );
    if (tipo === "calamina") setCalaminas(updateFn(calaminas));
    else setCumbreras(updateFn(cumbreras));
  };

  const removeDetalle = (id, tipo) => {
    if (tipo === "calamina") setCalaminas(calaminas.filter((i) => i.id !== id));
    else setCumbreras(cumbreras.filter((i) => i.id !== id));
  };

  const totalCalaminas = calaminas.reduce(
    (sum, i) => sum + Number(i.cantidad) * Number(i.longitud), 0
  );

  const totalCumbreras = cumbreras.reduce(
    (sum, i) => sum + Number(i.cantidad) * Number(i.longitud), 0
  );

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
    let txt = `*COTIZACIÓN MEGACERO S.R.L.*\n\n`;
    txt += `Cliente: ${cliente}\nProducto: ${producto} (${color})\n\n`;
    if (showCalaminas) {
      txt += `--- CALAMINAS ---\n`;
      calaminas.forEach(c =>
        txt += `${c.cantidad}u x ${c.longitud}m = ${(c.cantidad * c.longitud).toFixed(2)} mts\n`
      );
      txt += `TOTAL: ${totalCalaminas.toFixed(2)} mts\n\n`;
    }
    if (showCumbreras) {
      txt += `--- CUMBRERAS ---\nTipo: ${tipoCumbrera}\n`;
      cumbreras.forEach(c =>
        txt += `${c.cantidad}u x ${c.longitud}m = ${(c.cantidad * c.longitud).toFixed(2)} mts\n`
      );
      txt += `TOTAL: ${totalCumbreras.toFixed(2)} mts\n\n`;
    }
    txt += `TOTAL GENERAL: ${totalGeneral.toFixed(2)} mts`;
    navigator.clipboard.writeText(txt);
    alert("Copiado al portapapeles");
  };

  const handleGuardar = async () => {
    if (!producto) return alert("Seleccione un producto");
    const payload = {
      nombre_cliente: cliente,
      producto,
      color,
      calaminas,
      cumbreras,
      tipo_cumbrera: tipoCumbrera,
      total_calaminas: totalCalaminas,
      total_cumbreras: totalCumbreras,
      cantidad: totalGeneral,
      precio_unitario: 0,
      estado: "emitida",
      fecha_expiracion: new Date(Date.now() + 2 * 86400000).toISOString()
    };
    try {
      const res = await cotizacionesAPI.create(payload);
      if (res.data.success) {
        openPDF({ id: res.data.id, ...payload });
        window.location.reload();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const openPDF = (cot) => {
    const calaminasDetalle = cot.calaminas || [];
    const cumbrerasDetalle = cot.cumbreras || [];
    const tipoCumbreraTexto = cot.tipo_cumbrera || "No especificado";
    const totalCalaminasValor = cot.total_calaminas || 0;
    const totalCumbrerasValor = cot.total_cumbreras || 0;
    const fechaFormateada = new Date(cot.fecha_expiracion).toLocaleDateString();

    const w = window.open("", "_blank");
    w.document.write(`
      <html>
        <head>
          <title>Cotización ${cot.id}</title>
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Oxygen, Ubuntu, Cantarell, "Open Sans", "Helvetica Neue", sans-serif; margin: 0; padding: 0; background-color: #f7f7f7; color: #333; }
            .container { width: 800px; margin: 40px auto; background: #fff; padding: 40px; border-radius: 8px; box-shadow: 0 4px 12px rgba(0, 0, 0, 0.05); }
            .header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #eee; padding-bottom: 20px; margin-bottom: 20px; }
            .header .company-details h1 { margin: 0; font-size: 28px; color: #2c3e50; }
            .header .company-details p { margin: 4px 0 0; font-size: 14px; color: #7f8c8d; }
            .quote-details { text-align: right; }
            .quote-details h2 { margin: 0; font-size: 24px; color: #3498db; }
            .quote-details p { margin: 4px 0 0; font-size: 14px; }
            .customer-details { margin-bottom: 30px; }
            .customer-details h3 { margin: 0 0 10px; font-size: 18px; color: #3498db; border-bottom: 1px solid #eee; padding-bottom: 5px; }
            .customer-details p { margin: 4px 0; font-size: 14px; }
            table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
            th, td { padding: 12px 15px; text-align: left; font-size: 14px; }
            th { background-color: #f2f2f2; font-weight: 600; color: #555; }
            tbody tr:nth-child(even) { background-color: #f9f9f9; }
            .totals-table { width: 50%; margin-left: auto; border-top: 2px solid #3498db; }
            .totals-table td { padding: 12px 15px; }
            .totals-table .total-label { font-weight: bold; }
            .totals-table .total-value { text-align: right; font-size: 18px; color: #3498db; }
            .footer { margin-top: 40px; text-align: center; font-size: 12px; color: #95a5a6; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <div class="company-details"><h1>MEGACERO S.R.L.</h1><p>Dirección de la Empresa, Ciudad</p><p>telefono@empresa.com | (123) 456-7890</p></div>
              <div class="quote-details"><h2>COTIZACIÓN</h2><p><b>ID:</b> ${cot.id}</p><p><b>Fecha:</b> ${fechaFormateada}</p></div>
            </div>
            <div class="customer-details">
              <h3>Cliente</h3>
              <p><b>Nombre:</b> ${cot.nombre_cliente}</p>
              <p><b>Producto:</b> ${cot.producto} ${cot.color ? `(${cot.color})` : ''}</p>
            </div>
            ${calaminasDetalle.length > 0 ? `<h3>Detalle de Calaminas</h3><table><thead><tr><th>Cantidad</th><th>Longitud (m)</th><th>Subtotal (mts)</th></tr></thead><tbody>${calaminasDetalle.map(c => `<tr><td>${c.cantidad} u.</td><td>${c.longitud} m.</td><td>${(c.cantidad * c.longitud).toFixed(2)} mts</td></tr>`).join('')}</tbody></table>` : ''}
            ${cumbrerasDetalle.length > 0 ? `<h3>Detalle de Cumbreras (${tipoCumbreraTexto})</h3><table><thead><tr><th>Cantidad</th><th>Longitud (m)</th><th>Subtotal (mts)</th></tr></thead><tbody>${cumbrerasDetalle.map(c => `<tr><td>${c.cantidad} u.</td><td>${c.longitud} m.</td><td>${(c.cantidad * c.longitud).toFixed(2)} mts</td></tr>`).join('')}</tbody></table>` : ''}
            <table class="totals-table">
              <tbody>
                ${totalCalaminasValor > 0 ? `<tr><td class="total-label">Total Calaminas</td><td class="total-value">${totalCalaminasValor.toFixed(2)} mts</td></tr>` : ''}
                ${totalCumbrerasValor > 0 ? `<tr><td class="total-label">Total Cumbreras</td><td class="total-value">${totalCumbrerasValor.toFixed(2)} mts</td></tr>` : ''}
                <tr><td class="total-label">TOTAL GENERAL</td><td class="total-value">${parseFloat(cot.cantidad).toFixed(2)} MTS</td></tr>
              </tbody>
            </table>
            <div class="footer"><p>Gracias por su preferencia.</p><p>MEGACERO S.R.L. &copy; ${new Date().getFullYear()}</p></div>
          </div>
          <script>window.print()</script>
        </body>
      </html>
    `);
  };

  const handleOpenPDF = async (id) => {
    try {
      const res = await cotizacionesAPI.get(id);
      if (res.data?.success) {
        openPDF(res.data.cotizacion);
      } else {
        alert("No se pudieron cargar los detalles.");
      }
    } catch (err) {
      console.error("Error al buscar la cotización:", err);
      alert("Hubo un error al cargar los detalles.");
    }
  };

  const eliminarCotizacion = async (id) => {
    if (!window.confirm("¿Eliminar cotización?")) return;
    try {
      await cotizacionesAPI.delete(id);
      loadCotizaciones();
    } catch (err) {
      console.log(err);
    }
  };

  return (
    <div className="cotizador-container">
      <div className="cotizador-form">
        <input
          className="form-input"
          placeholder="Nombre del cliente"
          value={cliente}
          onChange={(e) => setCliente(e.target.value)}
        />
        <select
          className="form-input"
          value={producto}
          onChange={(e) => setProducto(e.target.value)}
        >
          <option value="">Seleccione producto</option>
          {productosOficiales.map((p) => (<option key={p}>{p}</option>))}
        </select>
        <select
          className="form-input"
          value={color}
          onChange={(e) => setColor(e.target.value)}
        >
          <option value="">Seleccione color</option>
          {coloresOficiales.map((c) => (<option key={c}>{c}</option>))}
        </select>
        <div className="checkbox-container">
          <label>
            <input
              type="checkbox"
              checked={showCalaminas}
              onChange={(e) => setShowCalaminas(e.target.checked)}
            /> Calaminas
          </label>
          <label>
            <input
              type="checkbox"
              checked={showCumbreras}
              onChange={(e) => setShowCumbreras(e.target.checked)}
            /> Cumbreras
          </label>
        </div>
        {showCumbreras && (
          <select
            className="form-input"
            value={tipoCumbrera}
            onChange={(e) => setTipoCumbrera(e.target.value)}
          >
            <option value="">Seleccione tipo de cumbrera</option>
            {cumbreraTipos.map((t) => (<option key={t}>{t}</option>))}
          </select>
        )}
        {showCalaminas && (
          <div className="detalle-section">
            <h2 className="detalle-title">Calaminas</h2>
            {calaminas.map((item) => (
              <DetalleRow
                key={item.id}
                item={item}
                onChange={(id, field, val) => updateDetalle(id, "calamina", field, val)}
                onRemove={(id) => removeDetalle(id, "calamina")}
              />
            ))}
            <button className="btn-agregar" onClick={() => addDetalle("calamina")}>
              + Agregar Calamina
            </button>
            <p className="total-mts">TOTAL: {totalCalaminas.toFixed(2)} mts</p>
          </div>
        )}
        {showCumbreras && (
          <div className="detalle-section">
            <h2 className="detalle-title">Cumbreras</h2>
            {cumbreras.map((item) => (
              <DetalleRow
                key={item.id}
                item={item}
                onChange={(id, field, val) => updateDetalle(id, "cumbrera", field, val)}
                onRemove={(id) => removeDetalle(id, "cumbrera")}
              />
            ))}
            <button className="btn-agregar" onClick={() => addDetalle("cumbrera")}>
              + Agregar Cumbrera
            </button>
            <p className="total-mts">TOTAL: {totalCumbreras.toFixed(2)} mts</p>
          </div>
        )}
        <p className="total-general">TOTAL GENERAL: {totalGeneral.toFixed(2)} MTS</p>
        <div className="final-buttons-container">
          <button className="btn-copiar" onClick={handleCopiar}>📋 Copiar</button>
          <button className="btn-guardar-cot" onClick={handleGuardar}>💾 Guardar & PDF</button>
          <button className="btn-limpiar-final" onClick={handleLimpiar}>🗑 Limpiar</button>
        </div>
        <div className="cotizaciones-list">
          <h3>Cotizaciones Guardadas</h3>
          <table>
            <thead>
              <tr>
                <th>ID</th>
                <th>Cliente</th>
                <th>Producto</th>
                <th>Cantidad</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {cotizacionesList.map((c) => (
                <tr key={c.id}>
                  <td>{c.id}</td>
                  <td>{c.nombre_cliente}</td>
                  <td>{c.producto} {c.color ? `(${c.color})` : ""}</td>
                  <td>{c.cantidad}</td>
                  <td className="acciones-cell">
                    <button className="btn-pdf" onClick={() => handleOpenPDF(c.id)}>
                      📄
                    </button>
                    <button className="btn-eliminar" onClick={() => eliminarCotizacion(c.id)}>
                      ❌
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default Cotizaciones;