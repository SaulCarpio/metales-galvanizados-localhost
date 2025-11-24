import React, { useEffect, useRef, useState, useCallback } from 'react';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import { pedidosAPI, rutasAPI, vehiculosAPI } from '../utils/api';
import axios from 'axios';

const API_BASE_URL = 'http://localhost:8080';

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
    .modal-content { background: white; padding: 20px; border-radius: 10px; width: 320px; }
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
    
    /* NUEVO: Panel de selección de vehículos */
    .vehicle-panel { position: absolute; bottom: 10px; right: 10px; background: white; padding: 15px; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.2); width: 300px; z-index: 999; }
    .vehicle-panel h4 { margin: 0 0 10px 0; font-size: 16px; color: #343a40; }
    .vehicle-select { width: 100%; padding: 8px; border: 1px solid #ced4da; border-radius: 4px; font-size: 14px; margin-bottom: 10px; }
    .vehicle-info { background: #f8f9fa; padding: 10px; border-radius: 6px; font-size: 13px; }
    .vehicle-info p { margin: 4px 0; }
    .vehicle-info strong { color: #495057; }
  `}</style>
);

const MapView = ({ initialCoord = [-16.482392, -68.242340] }) => {
  const mapRef = useRef(null);
  const mapInstance = useRef(null);
  const markersLayer = useRef(null);
  const routeLayer = useRef(null);

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

  // NUEVO: Estados para vehículos
  const [vehiculos, setVehiculos] = useState([]);
  const [selectedVehiculo, setSelectedVehiculo] = useState(null);

  // Agrega este useEffect para debuggear currentRouteId
  useEffect(() => {
    console.log("🔄 currentRouteId actualizado:", currentRouteId);
  }, [currentRouteId]);

  const fetchPedidos = useCallback(async () => {
    try {
      const res = await pedidosAPI.list();
      const pedidos = res.data?.pedidos || [];
      setAllPendingPedidos(pedidos.filter(p => p.estado === 'pendiente'));
    } catch (e) { console.error(e); }
  }, []);

  // NUEVO: Cargar vehículos
  const fetchVehiculos = useCallback(async () => {
    try {
      const res = await vehiculosAPI.list();
      if (res.success && res.data?.vehiculos) {
        setVehiculos(res.data.vehiculos);
        console.log('✅ Vehículos cargados:', res.data.vehiculos.length);
      }
    } catch (e) { 
      console.error('Error cargando vehículos:', e); 
    }
  }, []);

  useEffect(() => {
    fetchPedidos();
    fetchVehiculos(); // NUEVO
  }, [fetchPedidos, fetchVehiculos]);

  useEffect(() => {
    if (mapInstance.current) return;
    mapInstance.current = L.map(mapRef.current).setView(initialCoord, 13);
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png").addTo(mapInstance.current);
    markersLayer.current = L.layerGroup().addTo(mapInstance.current);
    routeLayer.current = L.layerGroup().addTo(mapInstance.current);
  }, [initialCoord]);

  useEffect(() => {
    const pedidoIdToAssign = localStorage.getItem('pedidoParaAsignar');
    if (pedidoIdToAssign) {
      alert(`Modo de asignación activado para Pedido #${pedidoIdToAssign}. Haz clic en el mapa para ubicar la entrega.`);
      setIsAddingPoints(true);
      localStorage.removeItem('pedidoParaAsignar');
    }
  }, []);

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

  const findOptimalRoute = async () => {
    if (waypoints.length === 0) {
      alert("Agrega al menos un pedido a la ruta.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const payload = { waypoints: [initialCoord, ...waypoints.map(w => [w.latlng.lat, w.latlng.lng])] };
      const res = await axios.post(`${API_BASE_URL}/api/find-route`, payload);
      const { coordinates, distance_meters, predicted_time_min } = res.data.route;
      
      routeLayer.current.clearLayers();
      L.polyline(coordinates, { weight: 5, color: '#007bff' }).addTo(routeLayer.current);
      
      setRouteInfo({ 
        distance: (distance_meters/1000).toFixed(2), 
        time: Math.round(predicted_time_min), 
        stops: waypoints.length 
      });
    } catch (e) { 
      setError("Error calculando la ruta."); 
      console.error("Error en findOptimalRoute:", e);
    }
    setLoading(false);
  };

  const handleDispatchRoute = async () => {
    // VALIDACIÓN: Verificar que haya un vehículo seleccionado
    if (!selectedVehiculo) {
      alert("⚠️ Por favor selecciona un vehículo antes de despachar la ruta.");
      return;
    }

    // VALIDACIÓN: Verificar que hay pedidos en la ruta
    if (waypoints.length === 0) {
      alert("⚠️ No hay pedidos en la ruta.");
      return;
    }

    // VALIDACIÓN: Verificar que hay información de ruta
    if (!routeInfo) {
      alert("⚠️ Primero calcula la ruta antes de despachar.");
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
    
    console.log("🚀 Enviando datos de despacho:", payload);
    
    try {
      const res = await rutasAPI.dispatch(payload);
      console.log("✅ Respuesta COMPLETA del servidor:", res);
      console.log("📋 Datos recibidos:", res.data);
      console.log("📋 ¿Tiene ruta_id?:", res.data?.data?.ruta_id);
      
      if (res.success) {
        // ✅ CORRECCIÓN: Buscar en res.data.data.ruta_id en lugar de res.data.ruta_id
        if (res.data && res.data.data && res.data.data.ruta_id) {
          setCurrentRouteId(res.data.data.ruta_id);
          console.log(`✅ Ruta ID establecida: ${res.data.data.ruta_id}`);
          
          alert(`✅ Ruta despachada con el vehículo: ${selectedVehiculo.placa}`);
          setIsRouteActive(true);
          timerRef.current = setInterval(() => setElapsedTime(prev => prev + 1), 1000);
        } else {
          console.error('❌ Error: ruta_id no viene en la respuesta:', res.data);
          alert('❌ Error: No se recibió el ID de la ruta del servidor.');
        }
      } else {
        alert(`❌ Error: ${res.message || 'No se pudo despachar la ruta'}`);
      }
    } catch (error) {
      console.error('❌ Error despachando ruta:', error);
      const errorMessage = error.response?.data?.message || error.message || "Error desconocido al despachar la ruta.";
      setError(errorMessage);
      alert(`❌ Error: ${errorMessage}`);
    }
  };

  const handleMarkAsDelivered = (pedidoId) => {
    setWaypoints(prev => prev.map(wp => wp.pedido.id === pedidoId ? { ...wp, completed: true } : wp));
  };
  
  const handleFinishRoute = async () => {
    // VERIFICAR que currentRouteId tenga un valor válido
    if (!currentRouteId || currentRouteId === 'undefined') {
      console.error('❌ Error: currentRouteId no está definido:', currentRouteId);
      alert('❌ Error: No se puede finalizar la ruta. ID de ruta no válido.');
      return;
    }

    if (timerRef.current) {
      clearInterval(timerRef.current);
    }
    
    console.log(`🚀 Finalizando ruta ID: ${currentRouteId}`);
    
    try {
      const res = await rutasAPI.complete(currentRouteId);
      console.log("✅ Respuesta del servidor al finalizar ruta:", res);
      
      if (res.success) {
        alert(`✅ Ruta finalizada. ${res.data?.pedidos_actualizados || 0} pedidos entregados.`);
        clearTrip();
      } else {
        alert(`❌ Error: ${res.message || 'No se pudo finalizar la ruta'}`);
      }
    } catch (error) { 
      console.error('❌ Error finalizando ruta:', error);
      const errorMessage = error.response?.data?.message || error.message || "Error desconocido al finalizar la ruta.";
      setError(errorMessage);
      alert(`❌ Error: ${errorMessage}`);
    }
  };

  const clearTrip = async () => {
    setWaypoints([]);
    setRouteInfo(null);
    setError(null);
    setIsRouteActive(false);
    setElapsedTime(0);
    setCurrentRouteId(null);
    if (routeLayer.current) {
      routeLayer.current.clearLayers();
    }
    
    // Pequeño delay para mejor experiencia de usuario
    setTimeout(() => {
      fetchPedidos();
      fetchVehiculos();
      console.log("🔄 Pantalla reiniciada después de finalizar ruta");
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

  // NUEVO: Handler para cambio de vehículo
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
        </div>
      )}

      {/* NUEVO: Panel de selección de vehículos */}
      {!isRouteActive && (
        <div className="vehicle-panel">
          <h4>🚚 Asignar Vehículo</h4>
          <select 
            className="vehicle-select" 
            value={selectedVehiculo?.id || ''} 
            onChange={handleVehiculoChange}
          >
            <option value="">-- Seleccionar Vehículo --</option>
            {vehiculos.map(v => (
              <option key={v.id} value={v.id}>
                {v.placa} - {v.marca} {v.modelo}
              </option>
            ))}
          </select>

          {selectedVehiculo && (
            <div className="vehicle-info">
              <p><strong>Placa:</strong> {selectedVehiculo.placa}</p>
              <p><strong>Marca:</strong> {selectedVehiculo.marca}</p>
              <p><strong>Modelo:</strong> {selectedVehiculo.modelo}</p>
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
              <h4>Entregas Pendientes:</h4>
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
      
      {error && <div style={{position:"absolute", bottom:10, left:10, background:"#dc3545", color:"white", padding:"10px 15px", borderRadius:"6px"}}>{error}</div>}
      {loading && <div style={{position:"absolute", top: '50%', left: '50%', transform: 'translate(-50%, -50%)', background: 'white', padding: '20px', borderRadius: '10px'}}>Calculando...</div>}
    </div>
  );
};

export default MapView;