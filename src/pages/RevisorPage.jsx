// src/pages/RevisorPage.jsx
import { useState, useEffect } from "react";
import { useAuth } from "../context/AuthContext";
import { supabase } from "../lib/supabase";
import { useNavigate } from "react-router-dom";
import {
  EyeIcon,
  CheckBadgeIcon,
  ChatBubbleLeftRightIcon,
  ClockIcon,
  AcademicCapIcon,
  ArrowLeftOnRectangleIcon,
  DocumentTextIcon,
  MagnifyingGlassIcon,
  FolderIcon,
  ChevronDownIcon,
  ChevronRightIcon,
} from "@heroicons/react/24/outline";
import { NotificationBell } from "../components/NotificationBell";

export const RevisorPage = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const [activeTab, setActiveTab] = useState("pendientes");
  const [documentosPendientes, setDocumentosPendientes] = useState([]);
  const [todosDocumentos, setTodosDocumentos] = useState([]);
  const [expandedProgramasTodos, setExpandedProgramasTodos] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Estados para busqueda
  const [searchPendientes, setSearchPendientes] = useState("");
  const [searchTodos, setSearchTodos] = useState("");

  const revisorNombre = user?.user_metadata?.nombre || "Revisor";
  const revisorApellido = user?.user_metadata?.apellido || "";
  const revisorEmail = user?.email || "";

  const obtenerUsuariosMap = async (docs = []) => {
    const userIds = [...new Set(docs.map((d) => d.usuario_id).filter(Boolean))];
    const usersMap = new Map();

    if (userIds.length === 0) return usersMap;

    const token = (await supabase.auth.getSession()).data.session?.access_token;

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
      result.users.forEach((u) => {
        usersMap.set(u.id, {
          email: u.email,
          nombre: u.nombre,
          apellido: u.apellido,
        });
      });
    }

    return usersMap;
  };

  const obtenerProgramasMap = async (docs = []) => {
    const programaIds = [
      ...new Set(docs.map((d) => d.programa_id).filter(Boolean)),
    ];
    const programasMap = new Map();

    if (programaIds.length === 0) return programasMap;

    const { data: programas, error: programasError } = await supabase
      .from("programas")
      .select("id, nombre, modalidad")
      .in("id", programaIds);

    if (programasError) {
      console.error("Error cargando programas para revisor:", programasError);
      return programasMap;
    }

    (programas || []).forEach((programa) => {
      programasMap.set(programa.id, programa);
    });

    return programasMap;
  };

  const obtenerMetricasDocumento = async (docId) => {
    const [totalSecciones, aprobadas, pendientes, comentariosPend] =
      await Promise.all([
        supabase
          .from("secciones")
          .select("*", { count: "exact", head: true })
          .eq("documento_id", docId),
        supabase
          .from("secciones")
          .select("*", { count: "exact", head: true })
          .eq("documento_id", docId)
          .eq("aprobado_revisor", true),
        supabase
          .from("secciones")
          .select("*", { count: "exact", head: true })
          .eq("documento_id", docId)
          .eq("estado_revision", "pendiente"),
        supabase
          .from("comentarios")
          .select("*", { count: "exact", head: true })
          .eq("documento_id", docId)
          .eq("resuelto", false),
      ]);

    return {
      totalSecciones: totalSecciones.count || 0,
      aprobadas: aprobadas.count || 0,
      pendientes: pendientes.count || 0,
      comentariosPendientes: comentariosPend.count || 0,
    };
  };

  const completarDocumentosConDatos = async (docs = [], shares = []) => {
    const usersMap = await obtenerUsuariosMap(docs);
    const programasMap = await obtenerProgramasMap(docs);

    const permisoMap = new Map();
    shares?.forEach((s) => permisoMap.set(s.documento_id, s.permiso));

    return Promise.all(
      docs.map(async (doc) => {
        const metricas = await obtenerMetricasDocumento(doc.id);

        const creadorInfo = usersMap.get(doc.usuario_id) || {
          email: doc.usuario_id,
          nombre: "",
          apellido: "",
        };

        const creadorNombre =
          `${creadorInfo.nombre} ${creadorInfo.apellido}`.trim() ||
          creadorInfo.email;

        const programa = doc.programa_id
          ? programasMap.get(doc.programa_id)
          : null;

        const permisoRaw =
          permisoMap.get(doc.id) ||
          (doc.usuario_id === user.id ? "dueño" : "lectura");

        return {
          ...doc,
          ...metricas,
          creador: creadorNombre,
          creadorEmail: creadorInfo.email,
          programaNombre:
            programa?.nombre ||
            (doc.programa_id ? "Programa no disponible" : "Sin programa"),
          programaModalidad: programa?.modalidad || null,
          permiso:
            permisoRaw === "escritura"
              ? "Edición"
              : permisoRaw === "dueño"
                ? "Dueño"
                : "Revisión",
        };
      }),
    );
  };

  // Cargar documentos que tienen secciones pendientes
  const cargarDocumentosPendientes = async () => {
    if (!user?.id) return;

    setLoading(true);
    setError("");

    try {
      // Primero obtener todos los documentos a los que el revisor tiene acceso
      const { data: shares, error: shareError } = await supabase
        .from("compartidos")
        .select("documento_id, permiso")
        .eq("usuario_id", user.id);

      if (shareError) throw shareError;

      let docIds = shares?.map((s) => s.documento_id) || [];

      // Si el revisor creó documentos, también los incluimos
      const { data: ownDocs, error: ownError } = await supabase
        .from("documentos")
        .select("id")
        .eq("usuario_id", user.id);

      if (!ownError && ownDocs) {
        docIds = [...docIds, ...ownDocs.map((d) => d.id)];
      }

      docIds = [...new Set(docIds)];

      if (docIds.length === 0) {
        setDocumentosPendientes([]);
        return;
      }

      // Obtener datos de los documentos, incluyendo programa_id para mostrar programa
      const { data: docs, error: docsError } = await supabase
        .from("documentos")
        .select(
          "id, titulo, updated_at, usuario_id, programa_id, tipo_documento",
        )
        .in("id", docIds)
        .order("updated_at", { ascending: false });

      if (docsError) throw docsError;

      const docsConMetricas = await completarDocumentosConDatos(
        docs || [],
        shares || [],
      );

      // Solo documentos con al menos una seccion pendiente
      const pendientes = docsConMetricas.filter((d) => d.pendientes > 0);
      setDocumentosPendientes(pendientes);
    } catch (err) {
      console.error(err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Cargar todos los documentos a los que el revisor tiene acceso
  const cargarTodosDocumentos = async () => {
    if (!user?.id) return;

    setLoading(true);
    setError("");

    try {
      const { data: shares, error: shareError } = await supabase
        .from("compartidos")
        .select("documento_id, permiso")
        .eq("usuario_id", user.id);

      if (shareError) throw shareError;

      let docIds = shares?.map((s) => s.documento_id) || [];

      const { data: ownDocs, error: ownError } = await supabase
        .from("documentos")
        .select("id")
        .eq("usuario_id", user.id);

      if (!ownError && ownDocs) {
        docIds = [...docIds, ...ownDocs.map((d) => d.id)];
      }

      docIds = [...new Set(docIds)];

      if (docIds.length === 0) {
        setTodosDocumentos([]);
        return;
      }

      const { data: docs, error: docsError } = await supabase
        .from("documentos")
        .select(
          "id, titulo, updated_at, usuario_id, programa_id, tipo_documento",
        )
        .in("id", docIds)
        .order("updated_at", { ascending: false });

      if (docsError) throw docsError;

      const docsConMetricas = await completarDocumentosConDatos(
        docs || [],
        shares || [],
      );
      setTodosDocumentos(docsConMetricas);
    } catch (err) {
      console.error(err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!user?.id) return;

    if (activeTab === "pendientes") {
      cargarDocumentosPendientes();
    } else {
      cargarTodosDocumentos();
    }
  }, [activeTab, user?.id]);

  const normalizarTexto = (valor = "") => String(valor).toLowerCase();

  // Filtros: por titulo, creador, programa o email
  const filteredPendientes = documentosPendientes.filter((doc) => {
    const query = normalizarTexto(searchPendientes);

    return (
      normalizarTexto(doc.titulo).includes(query) ||
      normalizarTexto(doc.creador).includes(query) ||
      normalizarTexto(doc.creadorEmail).includes(query) ||
      normalizarTexto(doc.programaNombre).includes(query)
    );
  });

  const filteredTodos = todosDocumentos.filter((doc) => {
    const query = normalizarTexto(searchTodos);

    return (
      normalizarTexto(doc.titulo).includes(query) ||
      normalizarTexto(doc.creador).includes(query) ||
      normalizarTexto(doc.creadorEmail).includes(query) ||
      normalizarTexto(doc.programaNombre).includes(query)
    );
  });

  const getModalidadBadge = (modalidad) => {
    if (!modalidad) return null;

    if (modalidad === "posgrado") {
      return (
        <span className="inline-flex items-center rounded-full bg-purple-100 px-2.5 py-0.5 text-xs font-semibold text-purple-700 border border-purple-200">
          Posgrado
        </span>
      );
    }

    return (
      <span className="inline-flex items-center rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-semibold text-emerald-700 border border-emerald-200">
        Pregrado
      </span>
    );
  };

  const agruparDocumentosPorPrograma = (docs = []) => {
    const gruposMap = new Map();

    docs.forEach((doc) => {
      const key = doc.programa_id || "sin-programa";

      if (!gruposMap.has(key)) {
        gruposMap.set(key, {
          id: key,
          nombre: doc.programaNombre || "Sin programa",
          modalidad: doc.programaModalidad || null,
          documentos: [],
        });
      }

      gruposMap.get(key).documentos.push(doc);
    });

    return Array.from(gruposMap.values()).sort((a, b) =>
      a.nombre.localeCompare(b.nombre),
    );
  };

  const gruposTodos = agruparDocumentosPorPrograma(filteredTodos);

  const isProgramaTodosExpanded = (programaId) =>
    expandedProgramasTodos[programaId] ?? true;

  const toggleProgramaTodos = (programaId) => {
    setExpandedProgramasTodos((prev) => ({
      ...prev,
      [programaId]: !(prev[programaId] ?? true),
    }));
  };

  const renderTablaDocumentosTodos = (documentos) => (
    <div className="overflow-x-auto">
      <table className="min-w-full divide-y divide-gray-200">
        <thead className="bg-gray-50">
          <tr>
            <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Titulo
            </th>
            <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Creador
            </th>
            <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Permiso
            </th>
            <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Secciones aprobadas
            </th>
            <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Pendientes
            </th>
            <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Comentarios pendientes
            </th>
            <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Ultima modificacion
            </th>
            <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Acciones
            </th>
          </tr>
        </thead>

        <tbody className="bg-white divide-y divide-gray-100">
          {documentos.map((doc) => (
            <tr key={doc.id} className="hover:bg-gray-50 transition">
              <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                {doc.titulo}
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                {doc.creador}
              </td>
              <td className="px-6 py-4 whitespace-nowrap">
                <span
                  className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                    doc.permiso === "Edición"
                      ? "bg-green-100 text-green-800"
                      : doc.permiso === "Dueño"
                        ? "bg-purple-100 text-purple-800"
                        : "bg-yellow-100 text-yellow-800"
                  }`}
                >
                  {doc.permiso}
                </span>
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                {doc.aprobadas}/{doc.totalSecciones}
              </td>
              <td className="px-6 py-4 whitespace-nowrap">
                {doc.pendientes > 0 ? (
                  <span className="text-amber-600 font-medium">
                    {doc.pendientes}
                  </span>
                ) : (
                  <span className="text-gray-400">0</span>
                )}
              </td>
              <td className="px-6 py-4 whitespace-nowrap">
                <div className="flex items-center gap-1">
                  <ChatBubbleLeftRightIcon className="h-4 w-4 text-amber-500" />
                  <span className="text-sm text-gray-700">
                    {doc.comentariosPendientes}
                  </span>
                </div>
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                {new Date(doc.updated_at).toLocaleString()}
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                <button
                  onClick={() => navigate(`/editor/documento/${doc.id}`)}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white px-3 py-1.5 rounded-md text-sm flex items-center gap-1 cursor-pointer"
                >
                  <EyeIcon className="h-4 w-4" /> Revisar
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );

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
              Panel de Revisor
            </h1>
          </div>
          <div className="flex items-center gap-4">
            <NotificationBell />

            <div className="text-right">
              <p className="text-sm font-medium text-gray-700">
                {revisorNombre} {revisorApellido}
              </p>
              <p className="text-xs text-gray-500">{revisorEmail}</p>
            </div>
            <button
              onClick={logout}
              className="flex items-center gap-2 bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg transition-all shadow-sm hover:shadow cursor-pointer"
            >
              <ArrowLeftOnRectangleIcon className="h-5 w-5" />
              <span className="hidden sm:inline">Cerrar sesion</span>
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
              onClick={() => setActiveTab("pendientes")}
              className={`
                flex items-center gap-2 py-3 px-1 border-b-2 text-sm font-medium transition-all cursor-pointer
                ${
                  activeTab === "pendientes"
                    ? "border-indigo-600 text-indigo-700"
                    : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
                }
              `}
            >
              <ClockIcon className="h-5 w-5" />
              Documentos que necesitan revision
            </button>
            <button
              onClick={() => setActiveTab("todos")}
              className={`
                flex items-center gap-2 py-3 px-1 border-b-2 text-sm font-medium transition-all cursor-pointer
                ${
                  activeTab === "todos"
                    ? "border-indigo-600 text-indigo-700"
                    : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
                }
              `}
            >
              <DocumentTextIcon className="h-5 w-5" />
              Todos los documentos
            </button>
          </nav>
        </div>

        {/* Pestaña: Documentos que necesitan revision */}
        {activeTab === "pendientes" && (
          <div className="bg-white rounded-2xl shadow-xl overflow-hidden">
            <div className="px-6 py-5 border-b border-gray-100 bg-gray-50/50 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
              <div>
                <h2 className="text-lg font-semibold text-gray-800 flex items-center gap-2">
                  <ClockIcon className="h-5 w-5 text-amber-500" />
                  Documentos con secciones pendientes
                </h2>
                <p className="text-sm text-gray-500 mt-1">
                  Documentos que tienen al menos una seccion marcada como
                  pendiente por el editor
                </p>
              </div>
              <div className="relative">
                <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="Buscar por titulo, creador o programa..."
                  value={searchPendientes}
                  onChange={(e) => setSearchPendientes(e.target.value)}
                  className="pl-9 pr-4 py-2 border border-gray-300 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
                />
              </div>
            </div>

            {loading ? (
              <div className="p-12 text-center">
                <div className="inline-block animate-spin rounded-full h-8 w-8 border-4 border-indigo-600 border-t-transparent"></div>
                <p className="mt-2 text-gray-500">Cargando documentos...</p>
              </div>
            ) : filteredPendientes.length === 0 ? (
              <div className="p-12 text-center text-gray-500">
                {searchPendientes
                  ? "No se encontraron documentos coincidentes."
                  : "No hay documentos que requieran revision en este momento."}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Documento
                      </th>
                      <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Programa
                      </th>
                      <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Creador
                      </th>
                      <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Secciones
                      </th>
                      <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Comentarios pendientes
                      </th>
                      <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Ultima modificacion
                      </th>
                      <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Acciones
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-100">
                    {filteredPendientes.map((doc) => (
                      <tr key={doc.id} className="hover:bg-gray-50 transition">
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                          {doc.titulo}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                          <div className="flex items-center gap-2">
                            <span>{doc.programaNombre}</span>
                            {getModalidadBadge(doc.programaModalidad)}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                          {doc.creador}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center gap-3">
                            <span
                              className="text-sm text-gray-700"
                              title="Aprobadas/Total"
                            >
                              <CheckBadgeIcon className="h-4 w-4 text-green-600 inline mr-1" />
                              {doc.aprobadas}/{doc.totalSecciones}
                            </span>
                            <span
                              className="text-sm text-amber-600"
                              title="Pendientes"
                            >
                              <ClockIcon className="h-4 w-4 inline mr-1" />
                              {doc.pendientes}
                            </span>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center gap-1">
                            <ChatBubbleLeftRightIcon className="h-4 w-4 text-amber-500" />
                            <span className="text-sm text-gray-700">
                              {doc.comentariosPendientes}
                            </span>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {new Date(doc.updated_at).toLocaleString()}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                          <button
                            onClick={() =>
                              navigate(`/editor/documento/${doc.id}`)
                            }
                            className="bg-indigo-600 hover:bg-indigo-700 text-white px-3 py-1.5 rounded-md text-sm flex items-center gap-1 cursor-pointer"
                          >
                            <EyeIcon className="h-4 w-4" /> Revisar
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* Pestaña: Todos los documentos */}
        {activeTab === "todos" && (
          <div className="space-y-4">
            <div className="bg-white rounded-2xl shadow-xl overflow-hidden">
              <div className="px-6 py-5 border-b border-gray-100 bg-gray-50/50 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                  <h2 className="text-lg font-semibold text-gray-800 flex items-center gap-2">
                    <DocumentTextIcon className="h-5 w-5 text-indigo-500" />
                    Todos los documentos
                  </h2>
                  <p className="text-sm text-gray-500 mt-1">
                    Todos los documentos a los que tienes acceso, agrupados por
                    programa
                  </p>
                </div>
                <div className="relative">
                  <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Buscar por titulo, creador o programa..."
                    value={searchTodos}
                    onChange={(e) => setSearchTodos(e.target.value)}
                    className="pl-9 pr-4 py-2 border border-gray-300 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
                  />
                </div>
              </div>
            </div>

            {loading ? (
              <div className="bg-white rounded-2xl shadow-xl overflow-hidden p-12 text-center">
                <div className="inline-block animate-spin rounded-full h-8 w-8 border-4 border-indigo-600 border-t-transparent"></div>
                <p className="mt-2 text-gray-500">Cargando documentos...</p>
              </div>
            ) : filteredTodos.length === 0 ? (
              <div className="bg-white rounded-2xl shadow-xl overflow-hidden p-12 text-center text-gray-500">
                {searchTodos
                  ? "No se encontraron documentos coincidentes."
                  : "No hay documentos disponibles."}
              </div>
            ) : (
              <div className="space-y-4">
                {gruposTodos.map((grupo) => {
                  const isExpanded = isProgramaTodosExpanded(grupo.id);

                  return (
                    <div
                      key={grupo.id}
                      className="bg-white rounded-2xl shadow-xl overflow-hidden"
                    >
                      <button
                        type="button"
                        onClick={() => toggleProgramaTodos(grupo.id)}
                        className="w-full px-5 py-4 flex items-center justify-between gap-4 border-b border-gray-100 hover:bg-gray-50 transition text-left cursor-pointer"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <FolderIcon className="h-7 w-7 text-yellow-500 flex-shrink-0" />

                          <div className="min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <h2 className="text-xl font-semibold text-gray-800 truncate">
                                {grupo.nombre}
                              </h2>
                              {getModalidadBadge(grupo.modalidad)}
                            </div>
                            <p className="text-sm text-gray-500">
                              {grupo.documentos.length} documento
                              {grupo.documentos.length === 1 ? "" : "s"}{" "}
                              disponible
                              {grupo.documentos.length === 1 ? "" : "s"}
                            </p>
                          </div>
                        </div>

                        {isExpanded ? (
                          <ChevronDownIcon className="h-5 w-5 text-gray-500 flex-shrink-0" />
                        ) : (
                          <ChevronRightIcon className="h-5 w-5 text-gray-500 flex-shrink-0" />
                        )}
                      </button>

                      {isExpanded && (
                        <div className="p-5 bg-gray-50/50">
                          {renderTablaDocumentosTodos(grupo.documentos)}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
