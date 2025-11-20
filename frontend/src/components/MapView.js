import React, { useEffect, useRef, useState, useCallback } from 'react';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import axios from 'axios';

const API_BASE_URL = 'http://localhost:8080';

const MapViewStyles = () => (
  <style>{`
    .leaflet-custom-icon { display: flex; justify-content: center; align-items: center; color: white; font-weight: bold; font-size: 14px; font-family: sans-serif; border-radius: 50%; border: 2px solid #fff; box-shadow: 0 3px 8px rgba(0,0,0,0.5); }
    .start-marker { background-color: #dc3545; }
    .waypoint-marker { background-color: #007bff; }
    .map-controls { position: absolute; top: 10px; left: 10px; background: rgba(255, 255, 255, 0.95); padding: 10px; border-radius: 8px; z-index: 1000; display: flex; gap: 10px; }
    .btn { padding: 10px 15px; border: none; border-radius: 5px; cursor: pointer; font-weight: bold; transition: background-color 0.2s; }
    .btn:disabled { background-color: #ccc; cursor: not-allowed; }
    .btn-primary { background: #007bff; color: white; }
    .btn-primary:hover:not(:disabled) { background: #0056b3; }
    .btn-active { background: #28a745; color: white; }
    .btn-active:hover:not(:disabled) { background: #218838; }
    .btn-secondary { background: #6c757d; color: white; }
    .btn-secondary:hover:not(:disabled) { background: #5a6268; }
    .btn-danger { background: #dc3545; color: white; }
    .btn-danger:hover:not(:disabled) { background: #c82333; }
    .route-info-panel { position: absolute; top: 10px; right: 10px; background: rgba(255, 255, 255, 0.95); backdrop-filter: blur(10px); padding: 15px; border-radius: 10px; box-shadow: 0 4px 15px rgba(0,0,0,0.2); min-width: 280px; z-index: 1000; }
    .route-info-panel h3 { margin: 0 0 15px 0; font-size: 16px; color: #333; border-bottom: 2px solid #4CAF50; padding-bottom: 8px; }
    .info-row { display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #eee; }
    .info-row:last-child { border-bottom: none; }
    .info-label { font-weight: 500; color: #666; }
    .info-value { font-weight: bold; color: #2196F3; }
    .map-error { position: absolute; bottom: 20px; left: 50%; transform: translateX(-50%); background: #f44336; color: white; padding: 15px 25px; border-radius: 5px; box-shadow: 0 4px 10px rgba(0,0,0,0.2); z-index: 1000; }
    .map-loading { position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); background: rgba(255, 255, 255, 0.95); padding: 30px; border-radius: 10px; box-shadow: 0 4px 15px rgba(0,0,0,0.2); text-align: center; z-index: 1000; }
    .spinner { border: 4px solid #f3f3f3; border-top: 4px solid #2196F3; border-radius: 50%; width: 40px; height: 40px; animation: spin 1s linear infinite; margin: 0 auto 15px; }
    @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }

    /* NUEVO: Botón inferior derecho */
    .add-more-btn {
      position: absolute;
      bottom: 20px;
      right: 20px;
      background: #17a2b8;
      color: white;
      padding: 12px 20px;
      border-radius: 8px;
      font-weight: bold;
      cursor: pointer;
      box-shadow: 0 4px 10px rgba(0,0,0,0.3);
      z-index: 1001;
      transition: background 0.2s;
    }
    .add-more-btn:hover {
      background: #138496;
    }
  `}</style>
);

const getColorForPercentage = (p) => {
  const red = Math.round(255 * (1 - p));
  const blue = Math.round(255 * p);
  return `rgb(${red}, 0, ${blue})`;
};

const MapView = ({ initialCoord = null }) => {
  const mapRef = useRef(null);
  const mapInstance = useRef(null);
  const markersLayer = useRef(null);
  const routeLayer = useRef(null);
  
  const [waypoints, setWaypoints] = useState([]);
  const [isAddingPoints, setIsAddingPoints] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [routeInfo, setRouteInfo] = useState(null);

  const [pendingPedidos, setPendingPedidos] = useState([]);
  const [pedidoAddMode, setPedidoAddMode] = useState(null); // pedido id for which we're adding address
  const [addressAddedByPedido, setAddressAddedByPedido] = useState({});

  const handleMapClick = useCallback((e) => {
    if (isAddingPoints) {
      setWaypoints(prevWaypoints => [...prevWaypoints, e.latlng]);
      if (pedidoAddMode) {
        // mark that this pedido has an address added (local UI state)
        setAddressAddedByPedido(prev => ({ ...prev, [pedidoAddMode]: true }));
        // exit add mode for that pedido
        setPedidoAddMode(null);
        setIsAddingPoints(false);
      }
    }
  }, [isAddingPoints, pedidoAddMode]);

  useEffect(() => {
    if (mapInstance.current) return;
    const startCoord = initialCoord || [-16.5, -68.189];
    mapInstance.current = L.map(mapRef.current).setView(startCoord, 13);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(mapInstance.current);
    markersLayer.current = L.layerGroup().addTo(mapInstance.current);
    routeLayer.current = L.layerGroup().addTo(mapInstance.current);

    if (initialCoord) {
      const latlng = L.latLng(initialCoord[0], initialCoord[1]);
      setWaypoints([latlng]);
    }

    return () => {
      if (mapInstance.current) {
        mapInstance.current.remove();
        mapInstance.current = null;
      }
    };
  }, [initialCoord]);

  useEffect(() => {
    const map = mapInstance.current;
    if (!map) return;
    map.on('click', handleMapClick);
    return () => {
      map.off('click', handleMapClick);
    };
  }, [handleMapClick]);

  useEffect(() => {
    if (!markersLayer.current) return;
    markersLayer.current.clearLayers();
    waypoints.forEach((point, index) => {
      let icon;
      if (index === 0) {
        icon = L.divIcon({
          className: 'leaflet-custom-icon start-marker',
          html: `INICIO`,
          iconSize: [60, 60],
          iconAnchor: [30, 30],
        });
      } else {
        icon = L.divIcon({
          className: 'leaflet-custom-icon waypoint-marker',
          html: `P${index}`,
          iconSize: [35, 35],
          iconAnchor: [17, 17],
        });
      }
      L.marker(point, { icon }).addTo(markersLayer.current);
    });
  }, [waypoints]);

  // Cargar pedidos pendientes y manejar redirección desde creación de pedido
  useEffect(() => {
    fetchPendingPedidos();
    const open = localStorage.getItem('openMapPedido');
    if (open) {
      try {
        const obj = JSON.parse(open);
        localStorage.removeItem('openMapPedido');
        // abrir modo agregar dirección para ese pedido
        setTimeout(() => setPedidoAddMode(obj.pedidoId), 600);
      } catch (e) { console.error(e); }
    }
  }, []);

  const fetchPendingPedidos = async () => {
    try {
      const r = await axios.get(`${API_BASE_URL}/api/pedidos`);
      if (r.data && r.data.pedidos) {
        const pendientes = r.data.pedidos.filter(p => p.estado === 'pendiente');
        setPendingPedidos(pendientes);
      }
    } catch (e) { console.error('Error cargando pedidos', e); }
  };

  const clearTrip = () => {
    if (initialCoord) {
      setWaypoints([L.latLng(initialCoord[0], initialCoord[1])]);
    } else {
      setWaypoints([]);
    }
    routeLayer.current?.clearLayers();
    setRouteInfo(null);
    setError(null);
  };

  const handleStartAddAddress = (pedidoId) => {
    setPedidoAddMode(pedidoId);
    setIsAddingPoints(true);
    alert('Modo: agregue la dirección haciendo clic en el mapa.');
  };

  const handleMarkDelivered = async (pedidoId) => {
    if (!addressAddedByPedido[pedidoId]) return;
    try {
      await axios.put(`${API_BASE_URL}/api/pedidos/${pedidoId}`, { estado: 'completado' });
      fetchPendingPedidos();
      setAddressAddedByPedido(prev => ({ ...prev, [pedidoId]: false }));
      alert('Pedido marcado como entregado');
    } catch (e) { console.error('Error marcando entregado', e); alert('Error marcando pedido'); }
  };

  const findOptimalRoute = async () => {
    if (waypoints.length < 2) {
      setError("Por favor agrega al menos dos puntos para calcular una ruta.");
      return;
    }
    setLoading(true);
    setError(null);
    setRouteInfo(null);
    setIsAddingPoints(false);

    const startTime = performance.now();
    const waypointsPayload = waypoints.map(wp => [wp.lat, wp.lng]);

    try {
      const response = await axios.post(`${API_BASE_URL}/api/find-route`, { waypoints: waypointsPayload });

      const latency = Math.round(performance.now() - startTime);
      if (!response.data.success) throw new Error(response.data.message || 'Error en la respuesta del servidor');
      
      const routeCoords = response.data.route.coordinates;
      if (!routeCoords || routeCoords.length === 0) throw new Error('No se encontraron coordenadas para la ruta');

      routeLayer.current?.clearLayers();

      const totalSegments = routeCoords.length - 1;
      for (let i = 0; i < totalSegments; i++) {
        const segmentCoords = [routeCoords[i], routeCoords[i + 1]];
        const progress = i / totalSegments;
        const segmentColor = getColorForPercentage(progress);

        L.polyline(segmentCoords, {
          color: segmentColor,
          weight: 5,
          opacity: 0.9,
        }).addTo(routeLayer.current);
      }

      const routeBounds = L.latLngBounds(routeCoords);
      mapInstance.current.fitBounds(routeBounds, { padding: [50, 50] });
      
      const distanceKm = (response.data.route.distance_meters / 1000).toFixed(2);
      const timeMin = Math.round(response.data.route.predicted_time_min);
      setRouteInfo({ distance: distanceKm, time: timeMin, latency, stops: waypoints.length });

    } catch (err) {
      console.error(err);
      const serverMessage = err.response?.data?.message;
      setError(serverMessage || err.message || 'Error al encontrar la ruta');
    } finally {
      setLoading(false);
    }
  };

  const toggleAddPointsMode = () => setIsAddingPoints(!isAddingPoints);

  // NUEVO: Función para volver a agregar puntos tras calcular una ruta
  const handleAddMorePoints = () => {
    setIsAddingPoints(true);
  };

  return (
    <div style={{ position: 'relative', height: '100%', width: '100%' }}>
      <MapViewStyles />
      <div ref={mapRef} style={{ height: '100%', width: '100%', cursor: isAddingPoints ? 'crosshair' : 'grab' }}></div>

      <div className="map-controls">
        <button className={`btn ${isAddingPoints ? 'btn-active' : 'btn-primary'}`} onClick={toggleAddPointsMode}>
          {isAddingPoints ? 'Dejar de Agregar' : 'Agregar Punto'}
        </button>
        <button className="btn btn-secondary" onClick={findOptimalRoute} disabled={waypoints.length < 2 || loading}>
          Calcular Ruta
        </button>
        <button className="btn btn-danger" onClick={clearTrip} disabled={loading}>
          Limpiar
        </button>
      </div>

      {routeInfo && (
        <div className="route-info-panel">
          <h3>📍 Información del Viaje</h3>
          <div className="info-row"><span className="info-label">Paradas Totales:</span><span className="info-value">{routeInfo.stops}</span></div>
          <div className="info-row"><span className="info-label">Distancia:</span><span className="info-value">{routeInfo.distance} km</span></div>
          <div className="info-row"><span className="info-label">⏱️ Tiempo Estimado:</span><span className="info-value">{routeInfo.time} min</span></div>
          <div className="info-row"><span className="info-label">📡 Latencia Total:</span><span className="info-value">{routeInfo.latency} ms</span></div>
        </div>
      )}

      {error && (<div className="map-error"><p>❌ {error}</p></div>)}
      {loading && (<div className="map-loading"><div className="spinner"></div><p>🔍 Buscando la mejor ruta...</p></div>)}
    </div>
  );
};

export default MapView;
