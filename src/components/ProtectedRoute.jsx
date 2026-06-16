// src/components/ProtectedRoute.jsx
import { Navigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export const ProtectedRoute = ({ children, allowedRoles = [] }) => {
  const { user, loading, role } = useAuth();

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        Cargando sesión...
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (allowedRoles.length > 0 && !allowedRoles.includes(role)) {
    return <Navigate to="/unauthorized" replace />;
  }

  return children;
};
