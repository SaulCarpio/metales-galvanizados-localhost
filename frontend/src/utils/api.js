  import axios from 'axios';

  const API_URL = 'http://localhost:8080/api';

  const api = axios.create({
    baseURL: API_URL,
    headers: {
      'Content-Type': 'application/json',
    },
    timeout: 15000,
  });

  // Interceptor para requests
  api.interceptors.request.use(
    (config) => {
      const token = localStorage.getItem('authToken');
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
      console.log(`📤 API Request: ${config.method.toUpperCase()} ${config.url}`);
      return config;
    },
    (error) => {
      return Promise.reject(error);
    }
  );

  // Interceptor para responses
  api.interceptors.response.use(
    (response) => {
      console.log(`✅ API Response: ${response.config.url}`, response.data);
      return response;
    },
    (error) => {
      if (error.response) {
        console.error('❌ API Error:', {
          status: error.response.status,
          url: error.config?.url,
          data: error.response.data
        });
        
        if (error.response.status === 401) {
          localStorage.clear();
          window.location.href = '/login';
        }
      } else if (error.request) {
        console.error('❌ Network Error:', error.request);
      } else {
        console.error('❌ Request Error:', error.message);
      }
      
      return Promise.reject(error);
    }
  );

  const handleFileResponse = (response) => {
    return {
      success: true,
      data: response.data
    };
  };

  // CORRECCIÓN: Función para manejar respuestas exitosas
  const handleResponse = (response) => {
    return {
      success: true,
      data: response.data,
      message: response.data?.message || "Operación exitosa"
    };
  };

  // CORRECCIÓN: Función para manejar errores de forma consistente
  const handleError = (error) => {
    return {
      success: false,
      data: null,
      error: error.response?.data || null,
      message: error.response?.data?.message || error.message
    };
  };


  // APIs con manejo correcto de errores
  export const authAPI = {
    login: (credentials) => 
      api.post('/login', credentials).then(handleResponse).catch(handleError),
    
    changePassword: (data) => 
      api.post('/change-password', data).then(handleResponse).catch(handleError),
    
    getUsers: () => 
      api.get('/users').then(handleResponse).catch(handleError),
    
    createUser: (data) => 
      api.post('/users', data).then(handleResponse).catch(handleError),
    
    toggleUser: (id) => 
      api.post(`/users/${id}/toggle`).then(handleResponse).catch(handleError),
    
    deleteUser: (id) => 
      api.delete(`/users/${id}`).then(handleResponse).catch(handleError),
  };

  export const dashboardAPI = {
    getData: (username) => 
      api.post('/dashboard', { username }).then(handleResponse).catch(handleError),
    
    getRoutes: () => 
      api.get('/routes').then(handleResponse).catch(handleError),
  };

  export const proveedoresAPI = {
    list: () => 
      api.get('/proveedores').then(handleResponse).catch(handleError),
    
    get: (id) => 
      api.get(`/proveedores/${id}`).then(handleResponse).catch(handleError),
    
    create: (data) => 
      api.post('/proveedores', data).then(handleResponse).catch(handleError),
    
    update: (id, data) => 
      api.put(`/proveedores/${id}`, data).then(handleResponse).catch(handleError),
    
    delete: (id) => 
      api.delete(`/proveedores/${id}`).then(handleResponse).catch(handleError),
  };

  export const ordenesAPI = {
    list: () => 
      api.get('/ordenes-compra').then(handleResponse).catch(handleError),
    
    get: (id) => 
      api.get(`/ordenes-compra/${id}`).then(handleResponse).catch(handleError),
    
    create: (data) => 
      api.post('/ordenes-compra', data).then(handleResponse).catch(handleError),
    
    update: (id, data) => 
      api.put(`/ordenes-compra/${id}`, data).then(handleResponse).catch(handleError),
    
    delete: (id) => 
      api.delete(`/ordenes-compra/${id}`).then(handleResponse).catch(handleError),
  };

  export const finanzasAPI = {
    listCuentasPagar: () => 
      api.get('/cuentas-pagar').then(handleResponse).catch(handleError),
    
    getCuentaPagar: (id) => 
      api.get(`/cuentas-pagar/${id}`).then(handleResponse).catch(handleError),
    
    createCuentaPagar: (data) => 
      api.post('/cuentas-pagar', data).then(handleResponse).catch(handleError),
    
    updateCuentaPagar: (id, data) => 
      api.put(`/cuentas-pagar/${id}`, data).then(handleResponse).catch(handleError),
    
    deleteCuentaPagar: (id) => 
      api.delete(`/cuentas-pagar/${id}`).then(handleResponse).catch(handleError),
  };

  export const movimientosAPI = {
    list: () => 
      api.get('/movimientos-pago').then(handleResponse).catch(handleError),
    
    create: (data) => 
      api.post('/movimientos-pago', data).then(handleResponse).catch(handleError),
  };

  export const inventarioAPI = {
    list: () => 
      api.get('/inventario').then(handleResponse).catch(handleError),
    
    get: (id) => 
      api.get(`/inventario/${id}`).then(handleResponse).catch(handleError),
    
    create: (data) => 
      api.post('/inventario', data).then(handleResponse).catch(handleError),
    
    update: (id, data) => 
      api.put(`/inventario/${id}`, data).then(handleResponse).catch(handleError),
    
    delete: (id) => 
      api.delete(`/inventario/${id}`).then(handleResponse).catch(handleError),
  };

  export const cotizacionesAPI = {
    list: () => 
      api.get('/cotizaciones').then(handleResponse).catch(handleError),
    
    get: (id) => 
      api.get(`/cotizaciones/${id}`).then(handleResponse).catch(handleError),
    
    create: (data) => 
      api.post('/cotizaciones', data).then(handleResponse).catch(handleError),
    
    update: (id, data) => 
      api.put(`/cotizaciones/${id}`, data).then(handleResponse).catch(handleError),
    
    delete: (id) => 
      api.delete(`/cotizaciones/${id}`).then(handleResponse).catch(handleError),
      
    getPDF: (id) => 
      api.get(`/cotizaciones/${id}/pdf`, { responseType: 'blob' })
        .then(handleFileResponse)
        .catch(handleError),
  };

  export const pedidosAPI = {
    list: () => 
      api.get('/pedidos').then(handleResponse).catch(handleError),
    
    get: (id) => 
      api.get(`/pedidos/${id}`).then(handleResponse).catch(handleError),
    
    create: (data) => 
      api.post('/pedidos', data).then(handleResponse).catch(handleError),
    
    update: (id, data) => 
      api.put(`/pedidos/${id}`, data).then(handleResponse).catch(handleError),
    
    delete: (id) => 
      api.delete(`/pedidos/${id}`).then(handleResponse).catch(handleError),

    // NUEVO: Asignar vehículo a pedido
    asignarVehiculo: (pedidoId, vehiculoId) =>
    api.post(`/pedidos/${pedidoId}/asignar-vehiculo`, { vehiculo_id: vehiculoId })
      .then(handleResponse)
      .catch(handleError),
  };

  export const productosAPI = {
    list: () => 
      api.get('/productos').then(handleResponse).catch(handleError),
    
    get: (id) => 
      api.get(`/productos/${id}`).then(handleResponse).catch(handleError),
    
    create: (data) => 
      api.post('/productos', data).then(handleResponse).catch(handleError),
    
    update: (id, data) => 
      api.put(`/productos/${id}`, data).then(handleResponse).catch(handleError),
    
    delete: (id) => 
      api.delete(`/productos/${id}`).then(handleResponse).catch(handleError),
  };

  export const clientesAPI = {
    list: () => 
      api.get('/clientes').then(handleResponse).catch(handleError),
    
    get: (id) => 
      api.get(`/clientes/${id}`).then(handleResponse).catch(handleError),
    
    create: (data) => 
      api.post('/clientes', data).then(handleResponse).catch(handleError),
    
    update: (id, data) => 
      api.put(`/clientes/${id}`, data).then(handleResponse).catch(handleError),
    
    delete: (id) => 
      api.delete(`/clientes/${id}`).then(handleResponse).catch(handleError),
  };

  export const vehiculosAPI = {
    list: () => 
      api.get('/vehiculos').then(handleResponse).catch(handleError),
    
    get: (id) => 
      api.get(`/vehiculos/${id}`).then(handleResponse).catch(handleError),
    
    create: (data) => 
      api.post('/vehiculos', data).then(handleResponse).catch(handleError),
    
    update: (id, data) => 
      api.put(`/vehiculos/${id}`, data).then(handleResponse).catch(handleError),
    
    delete: (id) => 
      api.delete(`/vehiculos/${id}`).then(handleResponse).catch(handleError),
  };

  export const kpisAPI = {
    getLogisticsKpis: () => 
      api.get('/kpis/logistics').then(handleResponse).catch(handleError),
  };

  export const importacionesAPI = {
    list: () => 
      api.get('/importaciones').then(handleResponse).catch(handleError),
    
    create: (data) => 
      api.post('/importaciones', data).then(handleResponse).catch(handleError),
    
    update: (id, data) => 
      api.put(`/importaciones/${id}`, data).then(handleResponse).catch(handleError),
  };

  export const rutasAPI = {
    dispatch: (data) => 
      api.post('/dispatch-route', data).then(handleResponse).catch(handleError),
    
    complete: (id) =>
      api.post(`/rutas/${id}/complete`, {}).then(handleResponse).catch(handleError),
  };

  export default api;