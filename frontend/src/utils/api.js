import axios from 'axios';

// Cambia esta IP si accedes desde otro dispositivo o red
const API_URL = 'http://localhost:8080/api';

const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Interceptor para agregar el token de autenticación (cuando lo implementemos)
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('authToken');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);


export const authAPI = {
  login: (credentials) => api.post('/login', credentials),
  changePassword: (data) => api.post('/change-password', data),
  getUsers: () => api.get('/users'),
  createUser: (data) => api.post('/users', data),
  toggleUser: (id) => api.post(`/users/${id}/toggle`),
  deleteUser: (id) => api.delete(`/users/${id}`),
};

export const dashboardAPI = {
  getData: (username) => api.post('/dashboard', { username }),
  getRoutes: () => api.get('/routes'),
};

export const proveedoresAPI = {
  list: () => api.get('/proveedores'),
  get: (id) => api.get(`/proveedores/${id}`),
  create: (data) => api.post('/proveedores', data),
  update: (id, data) => api.put(`/proveedores/${id}`, data),
  delete: (id) => api.delete(`/proveedores/${id}`),
};

export const ordenesAPI = {
  list: () => api.get('/ordenes-compra'),
  get: (id) => api.get(`/ordenes-compra/${id}`),
  create: (data) => api.post('/ordenes-compra', data),
  update: (id, data) => api.put(`/ordenes-compra/${id}`, data),
  delete: (id) => api.delete(`/ordenes-compra/${id}`),
};

export const finanzasAPI = {
  listCuentasPagar: () => api.get('/cuentas-pagar'),
  getCuentaPagar: (id) => api.get(`/cuentas-pagar/${id}`),
  createCuentaPagar: (data) => api.post('/cuentas-pagar', data),
  updateCuentaPagar: (id, data) => api.put(`/cuentas-pagar/${id}`, data),
  deleteCuentaPagar: (id) => api.delete(`/cuentas-pagar/${id}`),
};

export const movimientosAPI = {
  list: () => api.get('/movimientos-pago'),
  create: (data) => api.post('/movimientos-pago', data),
};

export const inventarioAPI = {
  list: () => api.get('/inventario'),
  get: (id) => api.get(`/inventario/${id}`),
  create: (data) => api.post('/inventario', data),
  update: (id, data) => api.put(`/inventario/${id}`, data),
  delete: (id) => api.delete(`/inventario/${id}`),
};

export const cotizacionesAPI = {
  list: () => api.get('/cotizaciones'),
  get: (id) => api.get(`/cotizaciones/${id}`),
  create: (data) => api.post('/cotizaciones', data),
  update: (id, data) => api.put(`/cotizaciones/${id}`, data),
  delete: (id) => api.delete(`/cotizaciones/${id}`),
};

export const pedidosAPI = {
  list: () => api.get('/pedidos'),
  get: (id) => api.get(`/pedidos/${id}`),
  create: (data) => api.post('/pedidos', data),
  update: (id, data) => api.put(`/pedidos/${id}`, data),
  delete: (id) => api.delete(`/pedidos/${id}`),
};

export default api;