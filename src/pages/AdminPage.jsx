// src/pages/AdminPage.jsx
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { supabase } from "../lib/supabase";
import {
  UserPlusIcon,
  XMarkIcon,
  TrashIcon,
  PencilIcon,
  ArrowLeftOnRectangleIcon,
  UserCircleIcon,
  EnvelopeIcon,
  UserIcon,
  AcademicCapIcon,
  DocumentTextIcon,
  UsersIcon,
  ClockIcon,
  CheckBadgeIcon,
  MagnifyingGlassIcon,
} from "@heroicons/react/24/outline";

export const AdminPage = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [activeTab, setActiveTab] = useState("usuarios");

  // Filtros
  const [filtroUsuarios, setFiltroUsuarios] = useState("");
  const [filtroDocumentos, setFiltroDocumentos] = useState("");

  // Estados para gestión de usuarios
  const [showAddModal, setShowAddModal] = useState(false);
  const [inviting, setInviting] = useState(false);
  const [newUser, setNewUser] = useState({
    email: "",
    nombre: "",
    apellido: "",
    rol: "editor",
  });
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);
  const [editNombre, setEditNombre] = useState("");
  const [editApellido, setEditApellido] = useState("");
  const [editRol, setEditRol] = useState("");
  const [updating, setUpdating] = useState(false);

  // Estados para documentos y logs
  const [documentos, setDocumentos] = useState([]);
  const [loadingDocs, setLoadingDocs] = useState(false);
  const [showLogsModal, setShowLogsModal] = useState(false);
  const [logsData, setLogsData] = useState([]);
  const [loadingLogs, setLoadingLogs] = useState(false);

  const adminNombre = user?.user_metadata?.nombre || "Admin";
  const adminApellido = user?.user_metadata?.apellido || "";
  const adminEmail = user?.email || "";

  // ---------- Usuarios ----------
  const loadUsers = async () => {
    setLoading(true);
    setError("");
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const token = session?.access_token;
      if (!token) throw new Error("No hay sesión activa");
      const response = await fetch(
        "https://fcjrqdmdwfkzqoygioes.supabase.co/functions/v1/list-users",
        { headers: { Authorization: `Bearer ${token}` } },
      );
      const result = await response.json();
      if (!response.ok)
        throw new Error(result.error || "Error al cargar usuarios");
      setUsers(result.users);
    } catch (err) {
      console.error(err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadUsers();
  }, []);

  const handleInvite = async (e) => {
    e.preventDefault();
    setInviting(true);
    setError("");
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const token = session?.access_token;
      const response = await fetch(
        "https://fcjrqdmdwfkzqoygioes.supabase.co/functions/v1/invite-user",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(newUser),
        },
      );
      const result = await response.json();
      if (!response.ok) throw new Error(result.error);
      setShowAddModal(false);
      setNewUser({ email: "", nombre: "", apellido: "", rol: "editor" });
      loadUsers();
      alert(`Invitación enviada a ${newUser.email}`);
    } catch (err) {
      setError(err.message);
    } finally {
      setInviting(false);
    }
  };

  const handleDeleteUser = async (userId, userEmail) => {
    if (!window.confirm(`¿Eliminar usuario ${userEmail}?`)) return;
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const token = session?.access_token;
      const response = await fetch(
        "https://fcjrqdmdwfkzqoygioes.supabase.co/functions/v1/delete-user",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ userId }),
        },
      );
      const result = await response.json();
      if (!response.ok) throw new Error(result.error);
      loadUsers();
      alert("Usuario eliminado");
    } catch (err) {
      setError(err.message);
    }
  };

  const handleUpdateUser = async () => {
    if (!selectedUser) return;
    setUpdating(true);
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const token = session?.access_token;
      const response = await fetch(
        "https://fcjrqdmdwfkzqoygioes.supabase.co/functions/v1/update-user-rol",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            userId: selectedUser.id,
            nombre: editNombre,
            apellido: editApellido,
            rol: editRol,
          }),
        },
      );
      const result = await response.json();
      if (!response.ok) throw new Error(result.error);
      setShowEditModal(false);
      setSelectedUser(null);
      loadUsers();
      alert("Datos actualizados");
    } catch (err) {
      setError(err.message);
    } finally {
      setUpdating(false);
    }
  };

  const getRoleBadgeClass = (rol) => {
    switch (rol) {
      case "admin":
        return "bg-red-100 text-red-800 ring-red-600/20";
      case "editor":
        return "bg-blue-100 text-blue-800 ring-blue-600/20";
      case "revisor":
        return "bg-green-100 text-green-800 ring-green-600/20";
      default:
        return "bg-gray-100 text-gray-800 ring-gray-600/20";
    }
  };

  // ---------- Documentos ----------
  const cargarDocumentos = async () => {
    setLoadingDocs(true);
    try {
      const { data: docs, error: docsError } = await supabase
        .from("documentos")
        .select("id, titulo, usuario_id, created_at, updated_at")
        .order("updated_at", { ascending: false });
      if (docsError) throw docsError;

      const {
        data: { session },
      } = await supabase.auth.getSession();
      const token = session?.access_token;
      let usersMap = new Map();
      try {
        const response = await fetch(
          "https://fcjrqdmdwfkzqoygioes.supabase.co/functions/v1/list-users",
          { headers: { Authorization: `Bearer ${token}` } },
        );
        const result = await response.json();
        (result.users || []).forEach((user) => {
          usersMap.set(user.id, {
            nombre: user.nombre,
            apellido: user.apellido,
            email: user.email,
          });
        });
      } catch (err) {
        console.error("Error al cargar usuarios:", err);
      }

      const docsConDetalles = await Promise.all(
        docs.map(async (doc) => {
          const { count: totalSecciones } = await supabase
            .from("secciones")
            .select("*", { count: "exact", head: true })
            .eq("documento_id", doc.id);

          const { count: aprobadas } = await supabase
            .from("secciones")
            .select("*", { count: "exact", head: true })
            .eq("documento_id", doc.id)
            .eq("aprobado_revisor", true);

          const creador = usersMap.get(doc.usuario_id) || {
            nombre: "Desconocido",
            apellido: "",
            email: doc.usuario_id,
          };
          return {
            ...doc,
            totalSecciones: totalSecciones || 0,
            aprobadas: aprobadas || 0,
            creadorNombre:
              `${creador.nombre} ${creador.apellido}`.trim() || creador.email,
          };
        }),
      );
      setDocumentos(docsConDetalles);
    } catch (err) {
      console.error(err);
      setError("Error al cargar documentos: " + err.message);
    } finally {
      setLoadingDocs(false);
    }
  };

  const cargarLogsDocumento = async (documentoId) => {
    setLoadingLogs(true);
    try {
      const { data, error } = await supabase
        .from("logs")
        .select("*")
        .eq("documento_id", documentoId)
        .order("created_at", { ascending: false });
      if (error) throw error;

      if (!data || data.length === 0) {
        setLogsData([]);
        setShowLogsModal(true);
        return;
      }

      const userIds = [...new Set(data.map((log) => log.usuario_id))];
      let userMap = new Map();
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const token = session?.access_token;
      try {
        const response = await fetch(
          "https://fcjrqdmdwfkzqoygioes.supabase.co/functions/v1/get-user-info",
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${token}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ userIds }),
          },
        );
        const result = await response.json();
        if (result.users) {
          result.users.forEach((user) => {
            userMap.set(user.id, {
              email: user.email,
              nombre: user.nombre,
              apellido: user.apellido,
            });
          });
        }
      } catch (err) {
        console.error("Error al obtener usuarios para logs:", err);
      }

      const logsConNombre = data.map((log) => {
        const userInfo = userMap.get(log.usuario_id);
        const nombreMostrar = userInfo
          ? `${userInfo.nombre} ${userInfo.apellido}`.trim() || userInfo.email
          : log.usuario_id.slice(0, 8) + "...";
        return { ...log, usuario_nombre: nombreMostrar };
      });
      setLogsData(logsConNombre);
      setShowLogsModal(true);
    } catch (err) {
      console.error(err);
      alert("Error al cargar logs: " + err.message);
    } finally {
      setLoadingLogs(false);
    }
  };

  const verDocumento = (doc) => {
    navigate(`/editor/documento/${doc.id}?readonly=true`);
  };

  useEffect(() => {
    if (activeTab === "documentos") {
      cargarDocumentos();
    }
  }, [activeTab]);

  // Filtrar usuarios por nombre, apellido o email
  const usuariosFiltrados = users.filter((u) => {
    const search = filtroUsuarios.toLowerCase();
    return (
      (u.nombre && u.nombre.toLowerCase().includes(search)) ||
      (u.apellido && u.apellido.toLowerCase().includes(search)) ||
      (u.email && u.email.toLowerCase().includes(search))
    );
  });

  // Filtrar documentos por título o creador
  const documentosFiltrados = documentos.filter((doc) => {
    const search = filtroDocumentos.toLowerCase();
    return (
      doc.titulo.toLowerCase().includes(search) ||
      doc.creadorNombre.toLowerCase().includes(search)
    );
  });

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      {/* Barra superior */}
      <div className="bg-white/80 backdrop-blur-sm shadow-sm border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex flex-col sm:flex-row justify-between items-center gap-4">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-indigo-600 flex items-center justify-center shadow-md">
              <AcademicCapIcon className="h-6 w-6 text-white" />
            </div>
            <h1 className="text-2xl font-bold bg-gradient-to-r from-indigo-800 to-blue-800 bg-clip-text text-transparent">
              Panel de Administrador
            </h1>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-right">
              <p className="text-sm font-medium text-gray-700">
                {adminNombre} {adminApellido}
              </p>
              <p className="text-xs text-gray-500">{adminEmail}</p>
            </div>
            <button
              onClick={logout}
              className="flex items-center gap-2 bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg transition-all shadow-sm hover:shadow cursor-pointer"
            >
              <ArrowLeftOnRectangleIcon className="h-5 w-5" />
              <span className="hidden sm:inline">Cerrar sesión</span>
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
        {error && (
          <div className="mb-6 p-4 bg-red-50 border-l-4 border-red-500 rounded-lg shadow-sm text-red-700">
            <p className="text-sm">{error}</p>
          </div>
        )}

        {/* Pestañas */}
        <div className="mb-6 border-b border-gray-200">
          <nav className="flex space-x-8" aria-label="Tabs">
            <button
              onClick={() => setActiveTab("usuarios")}
              className={`
                flex items-center gap-2 py-3 px-1 border-b-2 text-sm font-medium transition-all cursor-pointer
                ${
                  activeTab === "usuarios"
                    ? "border-indigo-600 text-indigo-700"
                    : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
                }
              `}
            >
              <UsersIcon className="h-5 w-5" />
              Usuarios
            </button>
            <button
              onClick={() => setActiveTab("documentos")}
              className={`
                flex items-center gap-2 py-3 px-1 border-b-2 text-sm font-medium transition-all cursor-pointer
                ${
                  activeTab === "documentos"
                    ? "border-indigo-600 text-indigo-700"
                    : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
                }
              `}
            >
              <DocumentTextIcon className="h-5 w-5" />
              Documentos
            </button>
          </nav>
        </div>

        {/* Contenido Usuarios */}
        {activeTab === "usuarios" && (
          <div className="bg-white rounded-2xl shadow-xl overflow-hidden">
            <div className="px-6 py-5 border-b border-gray-100 bg-gray-50/50 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
              <div>
                <h2 className="text-lg font-semibold text-gray-800 flex items-center gap-2">
                  <UserCircleIcon className="h-5 w-5 text-indigo-500" />
                  Usuarios registrados
                </h2>
                <p className="text-sm text-gray-500 mt-1">
                  Gestiona los usuarios y sus roles
                </p>
              </div>
              <div className="flex gap-3">
                <div className="relative">
                  <MagnifyingGlassIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Buscar por nombre o email..."
                    value={filtroUsuarios}
                    onChange={(e) => setFiltroUsuarios(e.target.value)}
                    className="pl-9 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none text-sm w-64"
                  />
                </div>
                <button
                  onClick={() => setShowAddModal(true)}
                  className="inline-flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-xl shadow-sm transition-all cursor-pointer"
                >
                  <UserPlusIcon className="h-5 w-5" />
                  <span>Nuevo usuario</span>
                </button>
              </div>
            </div>

            {loading ? (
              <div className="p-12 text-center">
                <div className="inline-block animate-spin rounded-full h-8 w-8 border-4 border-indigo-600 border-t-transparent"></div>
                <p className="mt-2 text-gray-500">Cargando usuarios...</p>
              </div>
            ) : usuariosFiltrados.length === 0 ? (
              <div className="p-12 text-center text-gray-500">
                {filtroUsuarios
                  ? "No se encontraron usuarios coincidentes."
                  : "No hay usuarios registrados"}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Usuario
                      </th>
                      <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Email
                      </th>
                      <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Rol
                      </th>
                      <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Registro
                      </th>
                      <th className="px-6 py-4 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Acciones
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-100">
                    {usuariosFiltrados.map((u) => (
                      <tr key={u.id} className="hover:bg-gray-50 transition">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center gap-3">
                            <div className="h-9 w-9 rounded-full bg-indigo-100 flex items-center justify-center">
                              <UserIcon className="h-5 w-5 text-indigo-600" />
                            </div>
                            <div>
                              <p className="text-sm font-medium text-gray-900">
                                {u.nombre} {u.apellido}
                              </p>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center gap-1">
                            <EnvelopeIcon className="h-4 w-4 text-gray-400" />
                            <span className="text-sm text-gray-600">
                              {u.email}
                            </span>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span
                            className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ring-1 ring-inset ${getRoleBadgeClass(u.rol)}`}
                          >
                            {u.rol === "admin"
                              ? "Administrador"
                              : u.rol === "editor"
                                ? "Editor"
                                : "Revisor"}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {new Date(u.created_at).toLocaleDateString()}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                          <div className="flex justify-end gap-3">
                            {u.id !== user?.id && (
                              <button
                                onClick={() => {
                                  setSelectedUser(u);
                                  setEditNombre(u.nombre || "");
                                  setEditApellido(u.apellido || "");
                                  setEditRol(u.rol);
                                  setShowEditModal(true);
                                }}
                                className="text-indigo-600 hover:text-indigo-900 transition cursor-pointer"
                                title="Editar"
                              >
                                <PencilIcon className="h-5 w-5" />
                              </button>
                            )}
                            {u.id !== user?.id && (
                              <button
                                onClick={() => handleDeleteUser(u.id, u.email)}
                                className="text-red-600 hover:text-red-900 transition cursor-pointer"
                                title="Eliminar"
                              >
                                <TrashIcon className="h-5 w-5" />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* Contenido Documentos */}
        {activeTab === "documentos" && (
          <div className="bg-white rounded-2xl shadow-xl overflow-hidden">
            <div className="px-6 py-5 border-b border-gray-100 bg-gray-50/50 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
              <div>
                <h2 className="text-lg font-semibold text-gray-800 flex items-center gap-2">
                  <DocumentTextIcon className="h-5 w-5 text-indigo-500" />
                  Todos los documentos
                </h2>
                <p className="text-sm text-gray-500 mt-1">
                  Listado completo de documentos del sistema
                </p>
              </div>
              <div className="relative">
                <MagnifyingGlassIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="Buscar por título o creador..."
                  value={filtroDocumentos}
                  onChange={(e) => setFiltroDocumentos(e.target.value)}
                  className="pl-9 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none text-sm w-72"
                />
              </div>
            </div>
            {loadingDocs ? (
              <div className="p-12 text-center">
                <div className="inline-block animate-spin rounded-full h-8 w-8 border-4 border-indigo-600 border-t-transparent"></div>
                <p className="mt-2 text-gray-500">Cargando documentos...</p>
              </div>
            ) : documentosFiltrados.length === 0 ? (
              <div className="p-12 text-center text-gray-500">
                {filtroDocumentos
                  ? "No se encontraron documentos coincidentes."
                  : "No hay documentos registrados"}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Título
                      </th>
                      <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Creador
                      </th>
                      <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Última modificación
                      </th>
                      <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Secciones aprobadas
                      </th>
                      <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Acciones
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-100">
                    {documentosFiltrados.map((doc) => (
                      <tr key={doc.id} className="hover:bg-gray-50 transition">
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                          {doc.titulo}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                          {doc.creadorNombre}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {new Date(doc.updated_at).toLocaleString()}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center gap-1">
                            <CheckBadgeIcon className="h-4 w-4 text-green-600" />
                            <span className="text-sm text-gray-700">
                              {doc.aprobadas}/{doc.totalSecciones}
                            </span>
                            <span className="text-xs text-gray-500">
                              aprobadas
                            </span>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                          <div className="flex gap-3">
                            <button
                              onClick={() => verDocumento(doc)}
                              className="text-blue-600 hover:text-blue-900 transition cursor-pointer"
                              title="Ver documento"
                            >
                              <DocumentTextIcon className="h-5 w-5" />
                            </button>
                            <button
                              onClick={() => cargarLogsDocumento(doc.id)}
                              className="text-purple-600 hover:text-purple-900 transition cursor-pointer"
                              title="Ver logs"
                            >
                              <ClockIcon className="h-5 w-5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Modales (sin cambios) */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex items-center justify-center min-h-screen p-4 text-center">
            <div
              className="fixed inset-0 bg-black bg-opacity-40 transition-opacity"
              onClick={() => setShowAddModal(false)}
            ></div>
            <div className="relative bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 text-left transform transition-all">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-xl font-semibold text-gray-900">
                  Invitar nuevo usuario
                </h3>
                <button
                  onClick={() => setShowAddModal(false)}
                  className="text-gray-400 hover:text-gray-600 cursor-pointer"
                >
                  <XMarkIcon className="h-6 w-6" />
                </button>
              </div>
              <form onSubmit={handleInvite} className="space-y-5">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Correo electrónico
                  </label>
                  <input
                    type="email"
                    value={newUser.email}
                    onChange={(e) =>
                      setNewUser({ ...newUser, email: e.target.value })
                    }
                    required
                    className="w-full border border-gray-300 rounded-xl p-2.5 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition"
                    placeholder="usuario@universidad.edu"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Nombre
                  </label>
                  <input
                    type="text"
                    value={newUser.nombre}
                    onChange={(e) =>
                      setNewUser({ ...newUser, nombre: e.target.value })
                    }
                    required
                    className="w-full border border-gray-300 rounded-xl p-2.5 focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Apellido
                  </label>
                  <input
                    type="text"
                    value={newUser.apellido}
                    onChange={(e) =>
                      setNewUser({ ...newUser, apellido: e.target.value })
                    }
                    required
                    className="w-full border border-gray-300 rounded-xl p-2.5 focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Rol
                  </label>
                  <select
                    value={newUser.rol}
                    onChange={(e) =>
                      setNewUser({ ...newUser, rol: e.target.value })
                    }
                    className="w-full border border-gray-300 rounded-xl p-2.5 focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="editor">Editor</option>
                    <option value="revisor">Revisor</option>
                    <option value="admin">Administrador</option>
                  </select>
                </div>
                <button
                  type="submit"
                  disabled={inviting}
                  className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-medium py-2.5 rounded-xl transition shadow-sm disabled:opacity-50 cursor-pointer"
                >
                  {inviting ? "Enviando..." : "Enviar invitación"}
                </button>
              </form>
            </div>
          </div>
        </div>
      )}

      {showEditModal && selectedUser && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex items-center justify-center min-h-screen p-4 text-center">
            <div
              className="fixed inset-0 bg-black bg-opacity-40 transition-opacity"
              onClick={() => setShowEditModal(false)}
            ></div>
            <div className="relative bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 text-left">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-xl font-semibold text-gray-900">
                  Editar usuario
                </h3>
                <button
                  onClick={() => setShowEditModal(false)}
                  className="text-gray-400 hover:text-gray-600 cursor-pointer"
                >
                  <XMarkIcon className="h-6 w-6" />
                </button>
              </div>
              <p className="text-sm text-gray-500 mb-4">{selectedUser.email}</p>
              <div className="space-y-5">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Nombre
                  </label>
                  <input
                    type="text"
                    value={editNombre}
                    onChange={(e) => setEditNombre(e.target.value)}
                    className="w-full border border-gray-300 rounded-xl p-2.5 focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Apellido
                  </label>
                  <input
                    type="text"
                    value={editApellido}
                    onChange={(e) => setEditApellido(e.target.value)}
                    className="w-full border border-gray-300 rounded-xl p-2.5 focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Rol
                  </label>
                  <select
                    value={editRol}
                    onChange={(e) => setEditRol(e.target.value)}
                    className="w-full border border-gray-300 rounded-xl p-2.5 focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="admin">Administrador</option>
                    <option value="editor">Editor</option>
                    <option value="revisor">Revisor</option>
                  </select>
                </div>
                <button
                  onClick={handleUpdateUser}
                  disabled={updating}
                  className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-medium py-2.5 rounded-xl transition shadow-sm disabled:opacity-50 cursor-pointer"
                >
                  {updating ? "Guardando..." : "Guardar cambios"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal Logs */}
      {showLogsModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex items-center justify-center min-h-screen p-4 text-center">
            <div
              className="fixed inset-0 bg-black bg-opacity-40 transition-opacity"
              onClick={() => setShowLogsModal(false)}
            ></div>
            <div className="relative bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col">
              <div className="flex justify-between items-center p-4 border-b">
                <h3 className="text-xl font-semibold text-gray-900">
                  Logs del documento
                </h3>
                <button
                  onClick={() => setShowLogsModal(false)}
                  className="text-gray-400 hover:text-gray-600 cursor-pointer"
                >
                  <XMarkIcon className="h-6 w-6" />
                </button>
              </div>
              <div className="flex-1 overflow-y-auto p-4">
                {loadingLogs ? (
                  <div className="p-8 text-center">
                    <div className="inline-block animate-spin rounded-full h-8 w-8 border-4 border-indigo-600 border-t-transparent"></div>
                    <p className="mt-2 text-gray-500">Cargando logs...</p>
                  </div>
                ) : logsData.length === 0 ? (
                  <p className="text-gray-500 text-center">
                    No hay logs para este documento.
                  </p>
                ) : (
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                          Fecha
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                          Usuario
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                          Acción
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                          Detalle
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-100">
                      {logsData.map((log) => (
                        <tr key={log.id} className="hover:bg-gray-50">
                          <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">
                            {new Date(log.created_at).toLocaleString()}
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-700">
                            {log.usuario_nombre}
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap text-sm">
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-indigo-100 text-indigo-800">
                              {log.accion}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-600 max-w-xs truncate">
                            {log.detalle ? JSON.stringify(log.detalle) : "-"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
