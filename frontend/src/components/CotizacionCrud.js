import React, { useState, useEffect } from 'react';
import './Cotizaciones.css'; // Importa el nuevo archivo CSS

// Componente para una fila de la tabla de detalles
const DetalleRow = ({ item, onChange, onRemove }) => (
  <div className="detalle-row">
    <input
      type="number"
      placeholder="Cant."
      value={item.cantidad}
      onChange={(e) => onChange(item.id, 'cantidad', e.target.value)}
      className="detalle-input"
    />
    <input
      type="number"
      placeholder="Longitud (m)"
      value={item.longitud}
      onChange={(e) => onChange(item.id, 'longitud', e.target.value)}
      className="detalle-input"
    />
    <span className="subtotal-mts">
      Subtotal: {(Number(item.cantidad) * Number(item.longitud)).toFixed(2)} mts
    </span>
    <button onClick={() => onRemove(item.id)} className="btn-remove-row">
      &times;
    </button>
  </div>
);


const Cotizaciones = () => {
  // Estado para los campos principales
  const [cliente, setCliente] = useState('');
  const [producto, setProducto] = useState('');
  const [color, setColor] = useState('');

  // Estado para la visibilidad de las secciones
  const [showCalaminas, setShowCalaminas] = useState(false);
  const [showCumbreras, setShowCumbreras] = useState(false);

  // Estado para los detalles
  const [calaminas, setCalaminas] = useState([]);
  const [cumbreras, setCumbreras] = useState([]);

  // Estado para los totales
  const [totalMtsCalaminas, setTotalMtsCalaminas] = useState(0);
  const [totalMtsCumbreras, setTotalMtsCumbreras] = useState(0);

  // --- Lógica para manipular detalles ---

  const addDetalle = (tipo) => {
    const newItem = { id: Date.now(), cantidad: '', longitud: '' };
    if (tipo === 'calamina') {
      setCalaminas([...calaminas, newItem]);
    } else {
      setCumbreras([...cumbreras, newItem]);
    }
  };

  const updateDetalle = (id, tipo, field, value) => {
    const updater = (items) =>
      items.map((item) => (item.id === id ? { ...item, [field]: value } : item));

    if (tipo === 'calamina') {
      setCalaminas(updater);
    } else {
      setCumbreras(updater);
    }
  };

  const removeDetalle = (id, tipo) => {
    if (tipo === 'calamina') {
      setCalaminas(calaminas.filter((item) => item.id !== id));
    } else {
      setCumbreras(cumbreras.filter((item) => item.id !== id));
    }
  };

  // --- Efectos para calcular totales ---

  useEffect(() => {
    const total = calaminas.reduce(
      (sum, item) => sum + Number(item.cantidad) * Number(item.longitud),
      0
    );
    setTotalMtsCalaminas(total);
  }, [calaminas]);

  useEffect(() => {
    const total = cumbreras.reduce(
      (sum, item) => sum + Number(item.cantidad) * Number(item.longitud),
      0
    );
    setTotalMtsCumbreras(total);
  }, [cumbreras]);
  
  // --- Lógica de los botones principales ---

  const handleLimpiar = () => {
    setCliente('');
    setProducto('');
    setColor('');
    setShowCalaminas(false);
    setShowCumbreras(false);
    setCalaminas([]);
    setCumbreras([]);
  };

  const handleCopiar = () => {
    let cotizacionTexto = `*COTIZACIÓN - MEGACERO S.R.L.*\n\n`;
    cotizacionTexto += `*Cliente:* ${cliente || 'N/A'}\n`;
    cotizacionTexto += `*Producto:* ${producto || 'N/A'}\n`;
    cotizacionTexto += `*Color:* ${color || 'N/A'}\n\n`;

    if (showCalaminas && calaminas.length > 0) {
      cotizacionTexto += `*--- Calaminas ---*\n`;
      calaminas.forEach(c => {
        cotizacionTexto += `- ${c.cantidad}u de ${c.longitud}m = ${(c.cantidad * c.longitud).toFixed(2)} mts\n`;
      });
      cotizacionTexto += `*TOTAL MTS. CALAMINAS: ${totalMtsCalaminas.toFixed(2)}*\n\n`;
    }

    if (showCumbreras && cumbreras.length > 0) {
      cotizacionTexto += `*--- Cumbreras ---*\n`;
      cumbreras.forEach(c => {
        cotizacionTexto += `- ${c.cantidad}u de ${c.longitud}m = ${(c.cantidad * c.longitud).toFixed(2)} mts\n`;
      });
      cotizacionTexto += `*TOTAL MTS. CUMBRERAS: ${totalMtsCumbreras.toFixed(2)}*\n\n`;
    }

    cotizacionTexto += `*TOTAL GENERAL MTS.: ${(totalMtsCalaminas + totalMtsCumbreras).toFixed(2)}*`;
    
    navigator.clipboard.writeText(cotizacionTexto)
      .then(() => alert('¡Cotización copiada al portapapeles!'))
      .catch(err => console.error('Error al copiar:', err));
  };


  return (
    <div className="cotizador-container">
      <div className="cotizador-form">
        <h1 className="header-title">COTIZADOR - MEGACERO S.R.L.</h1>

        <input
          type="text"
          id="etCliente"
          placeholder="Nombre del cliente"
          value={cliente}
          onChange={(e) => setCliente(e.target.value)}
          className="form-input"
        />

        {/* Simulación de Spinners con <select> */}
        <select id="spinnerProducto" value={producto} onChange={e => setProducto(e.target.value)} className="form-input">
          <option value="Ondulado T-35">Ondulado</option>
          <option value="Trapezoidal">Trapezoidal</option>
          <option value="Teja Colonial">Teja Colonial</option>
          <option value="Teja Americana">Teja Americana</option>
        </select>

        <select id="spinnerColor" value={color} onChange={e => setColor(e.target.value)} className="form-input">
          <option value="Rojo">Rojo</option>
          <option value="Azul">Azul</option>
          <option value="Naranja">Naranja</option>
          <option value="Turquesa">Turquesa</option>
          <option value="Verde">Verde</option>
          <option value="Vino Shingle">Vino Shingle</option>
          <option value="Cafe Shingle">Cafe Shingle</option>
          <option value="Rojo Shingle">Rojo Shingle</option>
          <option value="Naranja Shingle">Naranja Shingle</option>
          <option value="Zincalum">Zincalum</option>
        </select>
        
        <div className="checkbox-container">
          <label>
            <input type="checkbox" id="checkCalamina" checked={showCalaminas} onChange={e => setShowCalaminas(e.target.checked)} />
            Calaminas
          </label>
          <label>
            <input type="checkbox" id="checkPlanas" checked={showCumbreras} onChange={e => setShowCumbreras(e.target.checked)} />
            Cumbreras
          </label>
        </div>

        {/* Sección Calaminas */}
        {showCalaminas && (
          <div className="detalle-section">
            <h2 className="detalle-title">Calaminas</h2>
            <div className="detalle-table">
              {calaminas.map(item => (
                <DetalleRow key={item.id} item={item}
                  onChange={(id, field, value) => updateDetalle(id, 'calamina', field, value)}
                  onRemove={(id) => removeDetalle(id, 'calamina')} />
              ))}
            </div>
            <p className="total-mts">TOTAL MTS.: {totalMtsCalaminas.toFixed(2)}</p>
            <button onClick={() => addDetalle('calamina')} className="btn-agregar">+ Agregar Calamina</button>
          </div>
        )}

        {/* Sección Cumbreras */}
        {showCumbreras && (
          <div className="detalle-section">
            <h2 className="detalle-title">Cumbreras</h2>
             <div className="detalle-table">
              {cumbreras.map(item => (
                <DetalleRow key={item.id} item={item}
                  onChange={(id, field, value) => updateDetalle(id, 'cumbrera', field, value)}
                  onRemove={(id) => removeDetalle(id, 'cumbrera')} />
              ))}
            </div>
            <p className="total-mts">TOTAL MTS.: {totalMtsCumbreras.toFixed(2)}</p>
            <button onClick={() => addDetalle('cumbrera')} className="btn-agregar">+ Agregar Cumbrera</button>
          </div>
        )}

        <p className="total-general">TOTAL GENERAL: {(totalMtsCalaminas + totalMtsCumbreras).toFixed(2)} MTS.</p>
        
        <div className="final-buttons-container">
          <button onClick={handleCopiar} className="btn-copiar">📋 Copiar</button>
          <button onClick={handleLimpiar} className="btn-limpiar-final">🗑️ Limpiar</button>
        </div>
      </div>
    </div>
  );
};

export default Cotizaciones;