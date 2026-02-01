import React, { useEffect, useRef, useState, useCallback } from 'react';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import { pedidosAPI, rutasAPI, vehiculosAPI } from '../utils/api';
import axios from 'axios';

const API_BASE_URL = 'http://localhost:8080';

// CONFIGURACIÓN DE LA ZONA DE CALOR / PELIGROSA
const DANGER_ZONE = {
  center: [-16.598451, -68.183696],
  radius: 500, // metros (aprox 5 cuadras)
  color: '#ff0000',
  fillColor: '#f03',
  fillOpacity: 0.3
};

const MapViewStyles = () => (
  <style>{`
    .map-container { position: relative; height: 100%; width: 100%; }
    #map { height: 100%; width: 100%; border-radius: 10px; z-index: 1; }
    .map-controls { position: absolute; top: 10px; left: 10px; z-index: 999; display: flex; flex-direction: column; gap: 8px; }
    .btn { padding: 8px 14px; border-radius: 6px; cursor: pointer; border: none; font-weight: bold; font-size: 14px; transition: background-color 0.2s; }
    .btn:disabled { background-color: #ccc; cursor: not-allowed; }
    .btn-primary { background: #007bff; color: white; }
    .btn-active { background: #ffc107; color: black; }
    .btn-danger { background: #dc3545; color: white; }
    .btn-secondary { background: #6c757d; color: white; }
    .btn-success { background: #28a745; color: white; }
    .route-info-panel { position: absolute; right: 10px; top: 10px; background: white; padding: 15px; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.2); width: 320px; z-index: 999; }
    .route-info-panel h3 { margin: 0 0 10px 0; font-size: 18px; }
    .info-row { display: flex; justify-content: space-between; margin: 8px 0; font-size: 14px; }
    .modal-overlay { position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.5); z-index: 1000; display: flex; align-items: center; justify-content: center; }
    .modal-content { background: white; padding: 20px; border-radius: 10px; width: 400px; max-width: 90%; }
    .modal-content h3 { margin-top: 0; }
    .modal-content label { display: block; margin: 10px 0 5px; font-weight: bold; font-size: 14px; }
    .modal-content input, .modal-content select { width: 100%; padding: 8px; border: 1px solid #ccc; border-radius: 4px; font-size: 14px; }
    .modal-buttons { display: flex; gap: 10px; margin-top: 15px; }
    .modal-buttons button { flex: 1; }
    .start-marker, .waypoint-marker { border: 2px solid white; box-shadow: 0 2px 5px rgba(0,0,0,0.5); border-radius: 50%; text-align: center; font-weight: bold; color: white; }
    .start-marker { background: #007bff; width: 55px; height: 55px; line-height: 51px; font-size: 16px; }
    .waypoint-marker { background: #ff8800; color: black; width: 35px; height: 35px; line-height: 31px; }
    .tracking-panel { display: flex; flex-direction: column; }
    .timer-display { text-align: center; margin-bottom: 15px; padding: 10px; background-color: #e9ecef; border-radius: 8px; }
    .timer-clock { font-size: 28px; font-weight: bold; color: #343a40; }
    .timer-status { font-weight: bold; margin-top: 5px; }
    .stops-list { list-style: none; padding: 0; margin: 0; max-height: 250px; overflow-y: auto; }
    .stop-item { display: flex; justify-content: space-between; align-items: center; padding: 12px 8px; border-bottom: 1px solid #dee2e6; }
    .stop-item:last-child { border-bottom: none; }
    .stop-item.completed { background-color: #e7f5ec; text-decoration: line-through; color: #6c757d; }
    .stop-info { font-size: 14px; }
    .stop-info strong { display: block; }
    .btn-deliver { background-color: #28a745; color: white; padding: 6px 10px; font-size: 12px; border: none; border-radius: 4px; cursor: pointer; }
    .vehicle-panel { position: absolute; bottom: 10px; right: 10px; background: white; padding: 15px; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.2); width: 300px; z-index: 999; }
    .vehicle-panel h4 { margin: 0 0 10px 0; font-size: 16px; color: #343a40; }
    .vehicle-select { width: 100%; padding: 8px; border: 1px solid #ced4da; border-radius: 4px; font-size: 14px; margin-bottom: 10px; }
    .vehicle-info { background: #f8f9fa; padding: 10px; border-radius: 6px; font-size: 13px; }
    .vehicle-info p { margin: 4px 0; }
    .vehicle-info strong { color: #495057; }
    .stats-badge { background: #f8f9fa; padding: 10px; border-radius: 6px; margin: 8px 0; font-size: 13px; }
    .stats-badge strong { color: #495057; display: block; margin-bottom: 8px; }
    .note-text { font-size: 12px; color: #6c757d; margin-top: 5px; font-style: italic; }
    
    /* Estilos nuevos para controles de zona */
    .zone-controls { background: white; padding: 10px; border-radius: 6px; margin-top: 5px; box-shadow: 0 2px 5px rgba(0,0,0,0.2); font-size: 13px; }
    .checkbox-wrapper { display: flex; align-items: center; gap: 8px; cursor: pointer; }
    .danger-alert { background-color: #ffebee; border: 1px solid #ef5350; color: #c62828; padding: 8px; border-radius: 4px; margin-bottom: 10px; font-size: 12px; font-weight: bold; }
  `}</style>
);

const MapView = ({ initialCoord = [-16.482392, -68.242340] }) => {
  const mapRef = useRef(null);
  const mapInstance = useRef(null);
  const markersLayer = useRef(null);
  const routeLayer = useRef(null);
  const dangerZoneLayer = useRef(null); // Nueva capa para la zona

  const [waypoints, setWaypoints] = useState([]);
  const [allPendingPedidos, setAllPendingPedidos] = useState([]);
  const [isAddingPoints, setIsAddingPoints] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newPointCoords, setNewPointCoords] = useState(null);
  const [routeInfo, setRouteInfo] = useState(null);
  const [currentRouteId, setCurrentRouteId] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [isRouteActive, setIsRouteActive] = useState(false);
  const [elapsedTime, setElapsedTime] = useState(0);
  const timerRef = useRef(null);

  const [vehiculos, setVehiculos] = useState([]);
  const [selectedVehiculo, setSelectedVehiculo] = useState(null);

  const [isFinishModalOpen, setIsFinishModalOpen] = useState(false);
  const [finishData, setFinishData] = useState({ distancia_real_km: '' });

  // Nuevo estado para evitar zona
  const [avoidDangerZones, setAvoidDangerZones] = useState(true);
  const [intersectsDanger, setIntersectsDanger] = useState(false);

  const saveMetricaToLocalStorage = (metrica) => {
    try {
      const metricas = JSON.parse(localStorage.getItem('metricas_rutas') || '[]');
      metricas.push({
        ...metrica,
        id: Date.now(),
        fecha: new Date().toISOString()
      });
      localStorage.setItem('metricas_rutas', JSON.stringify(metricas));
    } catch (error) {
      console.error('❌ Error guardando métrica:', error);
    }
  };

  const fetchPedidos = useCallback(async () => {
    try {
      const res = await pedidosAPI.list();
      const pedidos = res.data?.pedidos || [];
      setAllPendingPedidos(pedidos.filter(p => p.estado === 'pendiente'));
    } catch (e) { console.error(e); }
  }, []);

  const fetchVehiculos = useCallback(async () => {
    try {
      const res = await vehiculosAPI.list();
      if (res.success && res.data?.vehiculos) {
        setVehiculos(res.data.vehiculos);
      }
    } catch (e) { 
      console.error('Error cargando vehículos:', e); 
    }
  }, []);

  useEffect(() => {
    fetchPedidos();
    fetchVehiculos();
  }, [fetchPedidos, fetchVehiculos]);

  // INICIALIZACIÓN DEL MAPA Y LA ZONA DE CALOR
  useEffect(() => {
    if (mapInstance.current) return;
    mapInstance.current = L.map(mapRef.current).setView(initialCoord, 13);
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png").addTo(mapInstance.current);
    
    markersLayer.current = L.layerGroup().addTo(mapInstance.current);
    routeLayer.current = L.layerGroup().addTo(mapInstance.current);
    dangerZoneLayer.current = L.layerGroup().addTo(mapInstance.current);

    // Dibujar la zona de calor (peligrosa)
    const circle = L.circle(DANGER_ZONE.center, {
      color: DANGER_ZONE.color,
      fillColor: DANGER_ZONE.fillColor,
      fillOpacity: DANGER_ZONE.fillOpacity,
      radius: DANGER_ZONE.radius
    }).addTo(dangerZoneLayer.current);
    
    circle.bindPopup("<b>⚠️ ZONA DE ALTO TRÁFICO/PELIGRO</b><br>Radio: 500m (Evitar)");

  }, [initialCoord]);

  const handleMapClick = useCallback((e) => {
    if (!isAddingPoints) return;
    setNewPointCoords(e.latlng);
    setIsModalOpen(true);
  }, [isAddingPoints]);

  useEffect(() => {
    const map = mapInstance.current;
    if (!map) return;
    map.on("click", handleMapClick);
    return () => map.off("click", handleMapClick);
  }, [handleMapClick]);

  useEffect(() => {
    if (!markersLayer.current) return;
    markersLayer.current.clearLayers();
    L.marker(initialCoord, { icon: L.divIcon({ className: "start-marker", html: "INICIO" }) }).addTo(markersLayer.current);
    waypoints.forEach((wp, idx) => {
      const marker = L.marker(wp.latlng, { icon: L.divIcon({ className: "waypoint-marker", html: `P${idx+1}` }) });
      marker.bindPopup(`<b>Pedido #${wp.pedido.id}</b><br>${wp.pedido.cliente_info?.nombre}`);
      marker.addTo(markersLayer.current);
    });
  }, [waypoints, initialCoord]);

  const handleSelectPedido = (pedidoId) => {
    const selected = allPendingPedidos.find(p => p.id === parseInt(pedidoId));
    if (selected && newPointCoords) {
      setWaypoints(prev => [...prev, { latlng: newPointCoords, pedido: selected, completed: false }]);
    }
    setIsModalOpen(false);
    setNewPointCoords(null);
    setIsAddingPoints(false);
  };

  // Función auxiliar para verificar si la ruta cruza la zona
  const checkIntersection = (routeCoordinates) => {
    const center = L.latLng(DANGER_ZONE.center);
    // Verificar si algún punto de la ruta está a menos distancia que el radio
    const intersects = routeCoordinates.some(coord => {
      // Leaflet coordinates in arrays are [lat, lng] usually
      const point = L.latLng(coord[0], coord[1]);
      return center.distanceTo(point) < DANGER_ZONE.radius;
    });
    return intersects;
  };

  const findOptimalRoute = async () => {
    if (waypoints.length === 0) {
      alert("Agrega al menos un pedido a la ruta.");
      return;
    }
    setLoading(true);
    setError(null);
    setIntersectsDanger(false);

    try {
      // Agregamos parámetro 'exclude_danger_zone' para el backend si lo soporta
      const payload = { 
        waypoints: [initialCoord, ...waypoints.map(w => [w.latlng.lat, w.latlng.lng])],
        options: {
          avoid_zones: avoidDangerZones ? [DANGER_ZONE] : [] 
        }
      };

      const res = await axios.post(`${API_BASE_URL}/api/find-route`, payload);
      const { coordinates, distance_meters, predicted_time_min } = res.data.route;
      
      routeLayer.current.clearLayers();

      // Verificar localmente si intersecta (por si el backend no lo filtró o para feedback visual)
      const isRisky = checkIntersection(coordinates);
      setIntersectsDanger(isRisky);

      // Si es riesgoso y el usuario quería evitarlo, pintar de rojo, sino azul
      const routeColor = isRisky ? '#dc3545' : '#007bff'; // Rojo o Azul
      const routeWeight = isRisky ? 6 : 5;
      const dashArray = isRisky ? '10, 10' : null; // Línea punteada si es peligroso

      const polyline = L.polyline(coordinates, { 
        weight: routeWeight, 
        color: routeColor,
        dashArray: dashArray 
      }).addTo(routeLayer.current);
      
      // Ajustar vista a la ruta
      mapInstance.current.fitBounds(polyline.getBounds(), { padding: [50, 50] });

      setRouteInfo({ 
        distance: (distance_meters/1000).toFixed(2), 
        time: Math.round(predicted_time_min), 
        stops: waypoints.length 
      });

      if (isRisky) {
        alert("⚠️ ATENCIÓN: La ruta calculada cruza por la Zona de Calor detectada. Se recomienda precaución.");
      }

    } catch (e) { 
      setError("Error calculando la ruta."); 
      console.error("Error en findOptimalRoute:", e);
    }
    setLoading(false);
  };

  const handleDispatchRoute = async () => {
    if (!selectedVehiculo) {
      alert("⚠️ Por favor selecciona un vehículo antes de despachar la ruta.");
      return;
    }
    if (waypoints.length === 0) {
      alert("⚠️ No hay pedidos en la ruta.");
      return;
    }
    if (!routeInfo) {
      alert("⚠️ Primero calcula la ruta antes de despachar.");
      return;
    }

    if (intersectsDanger && !window.confirm("⚠️ La ruta actual atraviesa una zona peligrosa. ¿Estás seguro de despachar esta ruta?")) {
      return;
    }

    const payload = { 
      conductor_id: 1,
      vehiculo_id: selectedVehiculo.id,
      pedido_ids: waypoints.map(w => w.pedido.id),
      route_details: {
        distance_km: parseFloat(routeInfo.distance || 0),
        time_min: parseInt(routeInfo.time || 0)
      }
    };
    
    try {
      const res = await rutasAPI.dispatch(payload);
      
      if (res.success) {
        if (res.data && res.data.data && res.data.data.ruta_id) {
          setCurrentRouteId(res.data.data.ruta_id);
          alert(`✅ Ruta despachada con el vehículo: ${selectedVehiculo.placa}`);
          setIsRouteActive(true);
          timerRef.current = setInterval(() => setElapsedTime(prev => prev + 1), 1000);
        } else {
          alert('❌ Error: No se recibió el ID de la ruta del servidor.');
        }
      } else {
        alert(`❌ Error: ${res.message || 'No se pudo despachar la ruta'}`);
      }
    } catch (error) {
      console.error('❌ Error despachando ruta:', error);
      const errorMessage = error.response?.data?.message || error.message || "Error desconocido al despachar la ruta.";
      setError(errorMessage);
    }
  };

  const handleMarkAsDelivered = (pedidoId) => {
    setWaypoints(prev => prev.map(wp => wp.pedido.id === pedidoId ? { ...wp, completed: true } : wp));
  };
  
  const handleFinishRoute = () => {
    const distanciaEstimada = parseFloat(routeInfo.distance || 0);
    setFinishData({ distancia_real_km: distanciaEstimada.toString() });
    setIsFinishModalOpen(true);
  };

  const confirmFinishRoute = async () => {
    if (!currentRouteId || currentRouteId === 'undefined') {
      alert('❌ Error: No se puede finalizar la ruta. ID de ruta no válido.');
      return;
    }
    if (timerRef.current) clearInterval(timerRef.current);
    
    try {
      const tiempo_estimado_min = routeInfo.time;
      const tiempo_real_min = Math.round(elapsedTime / 60);
      const distancia_estimada_km = parseFloat(routeInfo.distance);
      const distancia_real_km = parseFloat(finishData.distancia_real_km) || distancia_estimada_km;
      const entregas_completadas = waypoints.filter(w => w.completed).length;
      const entregas_planificadas = waypoints.length;
      const retraso = tiempo_real_min > (tiempo_estimado_min * 1.1);

      const metrica = {
        ruta_id: currentRouteId,
        tiempo_estimado_min,
        tiempo_real_min,
        distancia_estimada_km,
        distancia_real_km,
        entregas_completadas,
        entregas_planificadas,
        retraso,
        vehiculo: selectedVehiculo?.placa || 'N/A'
      };
      
      saveMetricaToLocalStorage(metrica);

      const payload = { distancia_real_km };
      const res = await rutasAPI.complete(currentRouteId, payload);
      
      if (res.success) {
        alert(`✅ Ruta finalizada exitosamente!`);
        setIsFinishModalOpen(false);
        clearTrip();
      } else {
        alert(`❌ Error: ${res.message || 'No se pudo finalizar la ruta'}`);
      }
    } catch (error) { 
      console.error('❌ Error finalizando ruta:', error);
      const errorMessage = error.response?.data?.message || error.message;
      setError(errorMessage);
    }
  };

  const clearTrip = async () => {
    setWaypoints([]);
    setRouteInfo(null);
    setError(null);
    setIsRouteActive(false);
    setElapsedTime(0);
    setCurrentRouteId(null);
    setIntersectsDanger(false);
    if (routeLayer.current) routeLayer.current.clearLayers();
    setTimeout(() => {
      fetchPedidos();
      fetchVehiculos();
    }, 500);
  };

  const formatTime = sec => `${String(Math.floor(sec/60)).padStart(2,'0')}:${String(sec%60).padStart(2,'0')}`;
  
  const getStatus = () => {
    if (!routeInfo) return { text: 'N/A', color: '#6c757d' };
    const estimatedSec = (routeInfo.time || 0) * 60;
    return elapsedTime > estimatedSec * 1.1 ? {text:"CON RETRASO", color:"#dc3545"} : {text:"A TIEMPO", color:"#28a745"};
  };

  const allStopsCompleted = waypoints.length > 0 && waypoints.every(wp => wp.completed);
  const availablePedidosForModal = allPendingPedidos.filter(p => !waypoints.some(wp => wp.pedido.id === p.id));

  const handleVehiculoChange = (e) => {
    const vehiculoId = parseInt(e.target.value);
    const vehiculo = vehiculos.find(v => v.id === vehiculoId);
    setSelectedVehiculo(vehiculo || null);
  };

  return (
    <div className="map-container">
      <MapViewStyles />
      <div id="map" ref={mapRef}></div>

      {!isRouteActive && (
        <div className="map-controls">
          <button className={`btn ${isAddingPoints?"btn-active":"btn-primary"}`} onClick={() => setIsAddingPoints(!isAddingPoints)}>
            {isAddingPoints ? "Cancelar" : "Asignar Pedido"}
          </button>
          <button className="btn btn-secondary" onClick={findOptimalRoute} disabled={waypoints.length === 0 || loading}>Calcular Ruta</button>
          <button className="btn btn-danger" onClick={clearTrip}>Limpiar</button>
          
          <div className="zone-controls">
            <label className="checkbox-wrapper">
              <input 
                type="checkbox" 
                checked={avoidDangerZones} 
                onChange={(e) => setAvoidDangerZones(e.target.checked)} 
              />
              Evitar Zonas Peligrosas
            </label>
          </div>
        </div>
      )}

      {!isRouteActive && (
        <div className="vehicle-panel">
          <h4>🚚 Asignar Vehículo</h4>
          <select className="vehicle-select" value={selectedVehiculo?.id || ''} onChange={handleVehiculoChange}>
            <option value="">-- Seleccionar Vehículo --</option>
            {vehiculos.map(v => (
              <option key={v.id} value={v.id}>{v.placa} - {v.marca} {v.modelo}</option>
            ))}
          </select>
          {selectedVehiculo && (
            <div className="vehicle-info">
              <p><strong>Placa:</strong> {selectedVehiculo.placa}</p>
              <p><strong>Capacidad:</strong> {selectedVehiculo.capacidad || 'N/A'}</p>
            </div>
          )}
        </div>
      )}

      {routeInfo && (
        <div className="route-info-panel">
          {!isRouteActive ? (
            <>
              <h3>📍 Resumen de Ruta</h3>
              
              {intersectsDanger && (
                <div className="danger-alert">
                  ⚠️ CUIDADO: Esta ruta cruza una zona identificada como peligrosa.
                </div>
              )}

              <div className="info-row"><span>Paradas:</span><span>{routeInfo.stops}</span></div>
              <div className="info-row"><span>Distancia:</span><span>{routeInfo.distance} km</span></div>
              <div className="info-row"><span>Tiempo Estimado:</span><span>{routeInfo.time} min</span></div>
              {selectedVehiculo && (
                <div className="info-row"><span>Vehículo:</span><span>{selectedVehiculo.placa}</span></div>
              )}
              <button className="btn btn-primary" style={{width:"100%", marginTop: '10px'}} onClick={handleDispatchRoute}>Despachar Camión</button>
            </>
          ) : (
            <div className="tracking-panel">
              <h3>🚚 Ruta en Progreso</h3>
              <div className="timer-display">
                <div className="timer-clock">{formatTime(elapsedTime)}</div>
                <div className="timer-status" style={{color: getStatus().color}}>{getStatus().text}</div>
              </div>
              
              <div className="stats-badge">
                <strong>📊 Estadísticas</strong>
                <div className="info-row"><span>Entregas:</span><span>{waypoints.filter(w => w.completed).length}/{waypoints.length}</span></div>
              </div>

              <h4 style={{marginTop: '15px', marginBottom: '10px'}}>Entregas Pendientes:</h4>
              <ul className="stops-list">
                {waypoints.map((wp, index) => (
                  <li key={wp.pedido.id} className={`stop-item ${wp.completed ? 'completed' : ''}`}>
                    <div className="stop-info">
                      <strong>P{index+1}: Pedido #{wp.pedido.id}</strong>
                      {wp.pedido.cliente_info?.nombre}
                    </div>
                    {!wp.completed && (
                      <button className="btn-deliver" onClick={() => handleMarkAsDelivered(wp.pedido.id)}>
                        Entregado
                      </button>
                    )}
                  </li>
                ))}
              </ul>
              {allStopsCompleted && (
                <button className="btn btn-success" style={{width:"100%", marginTop: '15px'}} onClick={handleFinishRoute}>Finalizar Ruta</button>
              )}
            </div>
          )}
        </div>
      )}

      {isModalOpen && (
        <div className="modal-overlay">
          <div className="modal-content">
            <h3>Asignar Pedido</h3>
            <p>Selecciona el pedido para esta ubicación:</p>
            {availablePedidosForModal.length > 0 ? (
              <select onChange={e => handleSelectPedido(e.target.value)} defaultValue="">
                <option value="" disabled>-- Elegir pedido --</option>
                {availablePedidosForModal.map(p => (<option key={p.id} value={p.id}>Pedido #{p.id} - {p.cliente_info?.nombre}</option>))}
              </select>
            ) : (
              <p>No hay más pedidos pendientes para asignar.</p>
            )}
            <button style={{marginTop: '10px'}} className="btn btn-danger" onClick={() => setIsModalOpen(false)}>Cancelar</button>
          </div>
        </div>
      )}

      {isFinishModalOpen && (
        <div className="modal-overlay">
          <div className="modal-content">
            <h3>🏁 Finalizar Ruta</h3>
            <label>Distancia Real Recorrida (km):</label>
            <input 
              type="number" 
              step="0.1"
              value={finishData.distancia_real_km}
              onChange={(e) => setFinishData({...finishData, distancia_real_km: e.target.value})}
              placeholder={`Por defecto: ${routeInfo.distance} km`}
            />
            <div className="modal-buttons">
              <button className="btn btn-secondary" onClick={() => setIsFinishModalOpen(false)}>Cancelar</button>
              <button className="btn btn-success" onClick={confirmFinishRoute}>✓ Confirmar</button>
            </div>
          </div>
        </div>
      )}
      
      {error && <div style={{position:"absolute", bottom:10, left:10, background:"#dc3545", color:"white", padding:"10px 15px", borderRadius:"6px", zIndex: 1000}}>{error}</div>}
      {loading && <div style={{position:"absolute", top: '50%', left: '50%', transform: 'translate(-50%, -50%)', background: 'white', padding: '20px', borderRadius: '10px', zIndex: 1000, boxShadow: '0 4px 12px rgba(0,0,0,0.3)'}}>Calculando ruta óptima...</div>}
    </div>
  );
};

export default MapView;