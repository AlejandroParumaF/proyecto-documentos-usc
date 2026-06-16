import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "./context/AuthContext";
import { LoginPage } from "./pages/LoginPage";
import { AdminPage } from "./pages/AdminPage";
import { EditorPage } from "./pages/EditorPage";
import { RevisorPage } from "./pages/RevisorPage";
import { UnauthorizedPage } from "./pages/UnauthorizedPage";
import { ProtectedRoute } from "./components/ProtectedRoute";
import { UpdatePasswordPage } from "./pages/UpdatePasswordPage";
import { DocumentoEditorPage } from "./features/documentos/DocumentoEditorPage";

function AppRoutes() {
  const { user, role, loading } = useAuth();

  const getDefaultRoute = () => {
    if (loading) return <div>Cargando...</div>;
    if (!user) return <Navigate to="/login" replace />;
    switch (role) {
      case "admin":
        return <Navigate to="/admin" replace />;
      case "editor":
        return <Navigate to="/editor" replace />;
      case "revisor":
        return <Navigate to="/revisor" replace />;
      default:
        return <Navigate to="/login" replace />;
    }
  };

  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/" element={getDefaultRoute()} />
      <Route
        path="/admin"
        element={
          <ProtectedRoute allowedRoles={["admin"]}>
            <AdminPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/editor"
        element={
          <ProtectedRoute allowedRoles={["editor"]}>
            <EditorPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/revisor"
        element={
          <ProtectedRoute allowedRoles={["revisor"]}>
            <RevisorPage />
          </ProtectedRoute>
        }
      />
      <Route path="/unauthorized" element={<UnauthorizedPage />} />
      <Route path="/update-password" element={<UpdatePasswordPage />} />
      <Route
        path="/editor/documento/:id"
        element={
          <ProtectedRoute allowedRoles={["admin", "editor", "revisor"]}>
            <DocumentoEditorPage />
          </ProtectedRoute>
        }
      />
    </Routes>
  );
}

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
