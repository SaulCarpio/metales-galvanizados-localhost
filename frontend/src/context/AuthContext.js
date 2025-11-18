import React, { createContext, useState, useContext, useEffect } from 'react';

// Crear el Contexto
export const AuthContext = createContext(null);

// --- CORRECCIÓN CLAVE ---
// Exportamos el hook personalizado para que otros archivos puedan importarlo
export const useAuth = () => {
  return useContext(AuthContext);
};

// Crear el Proveedor del Contexto
export const AuthProvider = ({ children }) => {
  const [auth, setAuth] = useState({
    isAuthenticated: localStorage.getItem('isAuthenticated') === 'true',
    username: localStorage.getItem('username'),
    role: localStorage.getItem('role'),
  });

  // Función para iniciar sesión que actualiza el estado y localStorage
  const login = (username, role) => {
    localStorage.setItem('isAuthenticated', 'true');
    localStorage.setItem('username', username);
    localStorage.setItem('role', role);
    setAuth({ isAuthenticated: true, username, role });
  };

  // Función para cerrar sesión (sin navegación)
  const logout = () => {
    localStorage.clear();
    setAuth({ isAuthenticated: false, username: null, role: null });
    // La navegación se manejará en el componente que llama a logout
  };
  
  // Efecto para escuchar cambios en localStorage
  useEffect(() => {
    const handleStorageChange = () => {
      setAuth({
        isAuthenticated: localStorage.getItem('isAuthenticated') === 'true',
        username: localStorage.getItem('username'),
        role: localStorage.getItem('role'),
      });
    };
    window.addEventListener('storage', handleStorageChange);
    return () => {
      window.removeEventListener('storage', handleStorageChange);
    };
  }, []);

  const value = {
    auth,
    login,
    logout,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};