import React from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import AccessDenied from './AccessDenied';

const ProtectedRoute = ({ allowedRoles }) => {
  const { auth } = useAuth();

  // 1. Si no está autenticado, lo enviamos al login
  if (!auth.isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  // 2. Si se especifican roles y el usuario no tiene el rol permitido, mostramos "Acceso Denegado"
  // Si allowedRoles no se proporciona, cualquier usuario autenticado puede acceder.
  if (allowedRoles && !allowedRoles.includes(auth.role)) {
    return <AccessDenied />;
  }

  // 3. Si todo está correcto, renderiza el componente de la ruta (Dashboard, MapView, etc.)
  return <Outlet />;
};

export default ProtectedRoute;