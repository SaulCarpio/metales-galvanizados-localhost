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

export default api;