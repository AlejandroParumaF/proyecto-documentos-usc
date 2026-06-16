// src/pages/EditorPage.jsx
import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { supabase } from "../lib/supabase";
import {
  PlusIcon,
  PencilIcon,
  FolderIcon,
  ArrowLeftOnRectangleIcon,
  AcademicCapIcon,
  XMarkIcon,
  ShareIcon,
  TrashIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon,
} from "@heroicons/react/24/outline";
import { ShareModal } from "../components/ShareModal";
import { NotificationBell } from "../components/NotificationBell";

export const EditorPage = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  // Estados para programas y documentos propios
  const [programas, setProgramas] = useState([]);
  const [loadingProgramas, setLoadingProgramas] = useState(true);
  const [expanded, setExpanded] = useState({});
  const [documentosPorPrograma, setDocumentosPorPrograma] = useState({});

  // Secciones principales: documentos propios / documentos compartidos
  const [seccionActiva, setSeccionActiva] = useState("mis-documentos");
  const [documentosCompartidos, setDocumentosCompartidos] = useState([]);
  const [loadingCompartidos, setLoadingCompartidos] = useState(true);
  const [expandedCompartidos, setExpandedCompartidos] = useState({});

  // Estados para el modal de compartir
  const [showShareModal, setShowShareModal] = useState(false);
  const [currentShareDoc, setCurrentShareDoc] = useState(null);
  const [searchEmail, setSearchEmail] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [selectedUserId, setSelectedUserId] = useState(null);
  const [newPermiso, setNewPermiso] = useState("lectura");
  const [loadingShare, setLoadingShare] = useState(false);
  const [sharedUsers, setSharedUsers] = useState([]);

  // Modal nuevo programa
  const [showNewProgramaModal, setShowNewProgramaModal] = useState(false);
  const [newProgramaName, setNewProgramaName] = useState("");
  const [newProgramaModalidad, setNewProgramaModalidad] = useState("pregrado");
  const [creatingPrograma, setCreatingPrograma] = useState(false);

  const editorNombre = user?.user_metadata?.nombre || "Editor";
  const editorApellido = user?.user_metadata?.apellido || "";
  const editorEmail = user?.email || "";

  const estadisticasVacias = {
    total: 0,
    aprobadas: 0,
    porCorregir: 0,
    pendientes: 0,
  };

  // ---------- Cargar programas del usuario ----------
  const cargarProgramas = async () => {
    if (!user?.id) return;

    setLoadingProgramas(true);

    const { data, error } = await supabase
      .from("programas")
      .select("id, nombre, modalidad, created_at, updated_at")
      .eq("usuario_id", user.id)
      .order("created_at", { ascending: false });

    if (error) {
      console.error(error);
      setProgramas([]);
    } else {
      setProgramas(data || []);
    }

    setLoadingProgramas(false);
  };

  const obtenerEstadisticasDocumentos = async (docs = []) => {
    const docIds = docs.map((doc) => doc.id);

    if (docIds.length === 0) return {};

    const { data: secciones, error } = await supabase
      .from("secciones")
      .select("documento_id, estado_revision")
      .in("documento_id", docIds);

    if (error) {
      console.error(error);
      return {};
    }

    return (secciones || []).reduce((acc, sec) => {
      if (!acc[sec.documento_id]) {
        acc[sec.documento_id] = {
          total: 0,
          aprobadas: 0,
          porCorregir: 0,
          pendientes: 0,
        };
      }

      acc[sec.documento_id].total += 1;

      if (sec.estado_revision === "aprobado") {
        acc[sec.documento_id].aprobadas += 1;
      }

      if (sec.estado_revision === "correcciones") {
        acc[sec.documento_id].porCorregir += 1;
      }

      if (sec.estado_revision === "pendiente") {
        acc[sec.documento_id].pendientes += 1;
      }

      return acc;
    }, {});
  };

  // ---------- Cargar documentos de un programa específico ----------
  const cargarDocumentosPrograma = async (programaId, force = false) => {
    if (!force && documentosPorPrograma[programaId]) return;
    if (!user?.id) return;

    const { data: documentos, error } = await supabase
      .from("documentos")
      .select("id, titulo, updated_at, tipo_documento, usuario_id")
      .eq("programa_id", programaId)
      .eq("usuario_id", user.id)
      .order("tipo_documento", { ascending: false })
      .order("created_at", { ascending: true });

    if (error) {
      console.error(error);
      return;
    }

    const docs = documentos || [];
    const estadisticasPorDocumento = await obtenerEstadisticasDocumentos(docs);

    const documentosConEstadisticas = docs.map((doc) => ({
      ...doc,
      estadisticas: estadisticasPorDocumento[doc.id] || estadisticasVacias,
    }));

    setDocumentosPorPrograma((prev) => ({
      ...prev,
      [programaId]: documentosConEstadisticas,
    }));
  };

  const cargarDocumentosCompartidos = async () => {
    if (!user?.id) return;

    setLoadingCompartidos(true);

    try {
      const { data: shares, error: sharesError } = await supabase
        .from("compartidos")
        .select("documento_id, permiso")
        .eq("usuario_id", user.id);

      if (sharesError) throw sharesError;

      if (!shares || shares.length === 0) {
        setDocumentosCompartidos([]);
        return;
      }

      const permisosPorDocumento = new Map(
        shares.map((share) => [share.documento_id, share.permiso]),
      );

      const documentoIds = shares.map((share) => share.documento_id);

      const { data: documentos, error: docsError } = await supabase
        .from("documentos")
        .select(
          `
            id,
            titulo,
            updated_at,
            tipo_documento,
            usuario_id,
            programa_id
          `,
        )
        .in("id", documentoIds)
        .order("updated_at", { ascending: false });

      if (docsError) throw docsError;

      const docs = documentos || [];
      const programaIds = [
        ...new Set(docs.map((doc) => doc.programa_id).filter(Boolean)),
      ];

      let programasPorId = new Map();

      if (programaIds.length > 0) {
        const { data: programasData, error: programasError } = await supabase
          .from("programas")
          .select("id, nombre, modalidad")
          .in("id", programaIds);

        if (programasError) {
          console.error(
            "Error cargando programas de compartidos:",
            programasError,
          );
        } else {
          programasPorId = new Map(
            (programasData || []).map((programa) => [programa.id, programa]),
          );
        }
      }

      const estadisticasPorDocumento =
        await obtenerEstadisticasDocumentos(docs);

      const docsFormateados = docs.map((doc) => ({
        ...doc,
        programas: programasPorId.get(doc.programa_id) || null,
        permiso_compartido: permisosPorDocumento.get(doc.id),
        estadisticas: estadisticasPorDocumento[doc.id] || estadisticasVacias,
      }));

      setDocumentosCompartidos(docsFormateados);

      // Dejar abiertas por defecto las carpetas compartidas para que
      // el usuario vea inmediatamente qué documentos recibió en cada programa.
      setExpandedCompartidos((prev) => {
        const next = { ...prev };

        docsFormateados.forEach((doc) => {
          const programaId = doc.programa_id || "sin-programa";

          if (next[programaId] === undefined) {
            next[programaId] = true;
          }
        });

        return next;
      });
    } catch (err) {
      console.error("Error cargando documentos compartidos:", err);
      setDocumentosCompartidos([]);
    } finally {
      setLoadingCompartidos(false);
    }
  };

  useEffect(() => {
    if (!user) return;

    cargarProgramas();
    cargarDocumentosCompartidos();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const toggleExpand = (programaId) => {
    if (!expanded[programaId]) {
      cargarDocumentosPrograma(programaId);
    }

    setExpanded((prev) => ({ ...prev, [programaId]: !prev[programaId] }));
  };

  const toggleExpandCompartido = (programaId) => {
    setExpandedCompartidos((prev) => ({
      ...prev,
      [programaId]: !prev[programaId],
    }));
  };

  // ---------- Crear programa ----------
  const crearPrograma = async (nombre, modalidad) => {
    if (!nombre.trim()) throw new Error("El nombre es obligatorio");

    const { data, error } = await supabase.rpc(
      "crear_programa_con_maestro_default",
      {
        p_nombre: nombre.trim(),
        p_modalidad: modalidad,
      },
    );

    if (error) throw error;

    await cargarProgramas();

    return data?.[0];
  };

  const handleCrearPrograma = async () => {
    if (!newProgramaName.trim()) return;

    setCreatingPrograma(true);

    try {
      await crearPrograma(newProgramaName, newProgramaModalidad);

      setNewProgramaName("");
      setNewProgramaModalidad("pregrado");
      setShowNewProgramaModal(false);
    } catch (err) {
      alert(err.message);
    } finally {
      setCreatingPrograma(false);
    }
  };

  const eliminarPrograma = async (programaId) => {
    if (!confirm("¿Eliminar el programa? Se borrarán todos sus documentos.")) {
      return;
    }

    const { error } = await supabase
      .from("programas")
      .delete()
      .eq("id", programaId)
      .eq("usuario_id", user.id);

    if (error) {
      alert("Error al eliminar programa: " + error.message);
    } else {
      setDocumentosPorPrograma((prev) => {
        const newState = { ...prev };
        delete newState[programaId];
        return newState;
      });

      await cargarProgramas();
    }
  };

  // ---------- Crear documento de curso ----------
  const crearDocumentoCurso = async (programaId, titulo) => {
    const { data, error } = await supabase.rpc(
      "crear_curso_con_plantilla_default",
      {
        p_programa_id: programaId,
        p_titulo: titulo.trim(),
      },
    );

    if (error) throw error;

    return data?.[0];
  };

  const handleCrearCurso = async (programaId) => {
    const titulo = prompt("Nombre del curso:");

    if (!titulo?.trim()) return;

    try {
      await crearDocumentoCurso(programaId, titulo);
      await cargarDocumentosPrograma(programaId, true);
    } catch (err) {
      alert("Error al crear curso: " + err.message);
    }
  };

  const eliminarDocumento = async (documentoId, programaId) => {
    if (!confirm("¿Eliminar este documento?")) return;

    const { error } = await supabase
      .from("documentos")
      .delete()
      .eq("id", documentoId)
      .eq("usuario_id", user.id);

    if (error) {
      alert("Error al eliminar documento: " + error.message);
    } else {
      await cargarDocumentosPrograma(programaId, true);
    }
  };

  // ---------- Lógica de compartir ----------
  const loadSharedUsersForDoc = async (documentoId) => {
    const { data: shares, error } = await supabase
      .from("compartidos")
      .select("usuario_id, permiso")
      .eq("documento_id", documentoId);

    if (error) return;

    if (!shares || shares.length === 0) {
      setSharedUsers([]);
      return;
    }

    const userIds = shares.map((s) => s.usuario_id);
    const usersMap = new Map();

    try {
      const token = (await supabase.auth.getSession()).data.session
        ?.access_token;

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
    } catch (err) {
      console.error("Error al obtener info de usuarios para compartir", err);
    }

    const formatted = shares.map((share) => {
      const info = usersMap.get(share.usuario_id) || {
        email: share.usuario_id,
        nombre: "",
        apellido: "",
      };

      return {
        usuario_id: share.usuario_id,
        permiso: share.permiso,
        info: {
          email: info.email,
          nombre: info.nombre,
          apellido: info.apellido,
        },
      };
    });

    setSharedUsers(formatted);
  };

  const searchUsers = useCallback(async (query) => {
    const queryLimpio = query.trim().toLowerCase();

    if (queryLimpio.length < 3) {
      setSearchResults([]);
      setSelectedUserId(null);
      return;
    }

    const token = (await supabase.auth.getSession()).data.session?.access_token;

    try {
      const res = await fetch(
        `https://fcjrqdmdwfkzqoygioes.supabase.co/functions/v1/buscar-usuarios?email=${encodeURIComponent(queryLimpio)}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        },
      );

      if (!res.ok) {
        console.error("Error buscar-usuarios:", res.status, await res.text());
        setSearchResults([]);
        setSelectedUserId(null);
        return;
      }

      const data = await res.json();
      const users = data.users || [];

      setSearchResults(users);

      const exactMatch = users.find(
        (u) => u.email?.trim().toLowerCase() === queryLimpio,
      );

      setSelectedUserId(exactMatch ? exactMatch.id : null);
    } catch (err) {
      console.error("Error en searchUsers:", err);
      setSearchResults([]);
      setSelectedUserId(null);
    }
  }, []);

  useEffect(() => {
    if (!showShareModal) return;

    const query = searchEmail.trim();

    if (query.length < 3) {
      setSearchResults([]);
      setSelectedUserId(null);
      return;
    }

    const timer = setTimeout(() => {
      searchUsers(query);
    }, 350);

    return () => clearTimeout(timer);
  }, [searchEmail, showShareModal, searchUsers]);

  const buscarUsuarioPorEmail = async (email) => {
    const emailLimpio = email.trim().toLowerCase();

    if (!emailLimpio) return null;

    const token = (await supabase.auth.getSession()).data.session?.access_token;

    try {
      const res = await fetch(
        `https://fcjrqdmdwfkzqoygioes.supabase.co/functions/v1/buscar-usuarios?email=${encodeURIComponent(emailLimpio)}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        },
      );

      if (!res.ok) {
        console.error("Error buscando usuario:", res.status, await res.text());
        return null;
      }

      const data = await res.json();
      const users = data.users || [];

      return (
        users.find((u) => u.email?.trim().toLowerCase() === emailLimpio) || null
      );
    } catch (err) {
      console.error("Error en buscarUsuarioPorEmail:", err);
      return null;
    }
  };

  const selectUser = (userSelected) => {
    setSearchEmail(userSelected.email);
    setSelectedUserId(userSelected.id);
    setSearchResults([]);
  };

  const handleShare = async (usuarioId, permisoSeleccionado) => {
    if (!currentShareDoc) return;

    setLoadingShare(true);

    const token = (await supabase.auth.getSession()).data.session?.access_token;

    try {
      const res = await fetch(
        "https://fcjrqdmdwfkzqoygioes.supabase.co/functions/v1/compartir-documento",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            documentoId: currentShareDoc.id,
            usuarioId,
            permiso: permisoSeleccionado,
          }),
        },
      );

      if (res.ok) {
        await loadSharedUsersForDoc(currentShareDoc.id);
        setSearchEmail("");
        setSearchResults([]);
        setSelectedUserId(null);
        alert("Documento compartido correctamente");
      } else {
        const err = await res.json();
        alert(err.error || "Error al compartir");
      }
    } catch (err) {
      console.error(err);
      alert("Error de red al compartir");
    } finally {
      setLoadingShare(false);
    }
  };

  const handleAddShare = async () => {
    const email = searchEmail.trim().toLowerCase();

    if (!email) {
      alert("Ingresa un email válido");
      return;
    }

    if (selectedUserId) {
      await handleShare(selectedUserId, newPermiso);
      return;
    }

    const exactMatch = searchResults.find(
      (u) => u.email?.trim().toLowerCase() === email,
    );

    if (exactMatch) {
      await handleShare(exactMatch.id, newPermiso);
      return;
    }

    const usuarioEncontrado = await buscarUsuarioPorEmail(email);

    if (usuarioEncontrado) {
      await handleShare(usuarioEncontrado.id, newPermiso);
      return;
    }

    alert("Usuario no encontrado. Verifica que el correo esté registrado.");
  };

  const removeShare = async (usuarioId) => {
    if (!currentShareDoc) return;
    if (!confirm("¿Revocar acceso?")) return;

    await supabase
      .from("compartidos")
      .delete()
      .eq("documento_id", currentShareDoc.id)
      .eq("usuario_id", usuarioId);

    await loadSharedUsersForDoc(currentShareDoc.id);
  };

  const openShareModal = async (doc) => {
    setCurrentShareDoc(doc);
    await loadSharedUsersForDoc(doc.id);
    setShowShareModal(true);
    setSearchEmail("");
    setSearchResults([]);
    setSelectedUserId(null);
  };

  const getModalidadBadge = (modalidad) => {
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

  const getTipoDocumentoBadge = (tipo) => {
    if (tipo === "maestro") {
      return (
        <span className="bg-purple-100 text-purple-800 px-2 py-0.5 rounded-full text-xs">
          Maestro
        </span>
      );
    }

    return (
      <span className="bg-blue-100 text-blue-800 px-2 py-0.5 rounded-full text-xs">
        Curso
      </span>
    );
  };

  const getPermisoBadge = (permiso) => {
    if (permiso === "escritura") {
      return (
        <span className="bg-green-100 text-green-800 px-2 py-0.5 rounded-full text-xs">
          Escritura
        </span>
      );
    }

    return (
      <span className="bg-gray-100 text-gray-800 px-2 py-0.5 rounded-full text-xs">
        Lectura
      </span>
    );
  };

  const renderEstadisticas = (doc) => (
    <>
      <td className="px-4 py-3 whitespace-nowrap text-sm">
        <div className="inline-flex items-center gap-2 rounded-full bg-green-50 px-3 py-1 text-green-700 border border-green-100">
          <span className="text-xs font-semibold">
            {doc.estadisticas?.aprobadas || 0}
            {" / "}
            {doc.estadisticas?.total || 0}
          </span>
          <CheckCircleIcon className="h-4 w-4 text-green-600" />
        </div>
      </td>

      <td className="px-4 py-3 whitespace-nowrap text-sm">
        <div className="inline-flex items-center gap-2 rounded-full bg-orange-50 px-3 py-1 text-orange-700 border border-orange-100">
          <span className="text-xs font-semibold">
            {doc.estadisticas?.porCorregir || 0}
          </span>
          <ExclamationTriangleIcon className="h-4 w-4 text-orange-600" />
        </div>
      </td>
    </>
  );

  const programasCompartidosAgrupados = Object.values(
    documentosCompartidos.reduce((acc, doc) => {
      const programaId = doc.programa_id || "sin-programa";

      if (!acc[programaId]) {
        acc[programaId] = {
          id: programaId,
          nombre: doc.programas?.nombre || "Sin programa",
          modalidad: doc.programas?.modalidad || null,
          documentos: [],
        };
      }

      acc[programaId].documentos.push(doc);
      return acc;
    }, {}),
  ).sort((a, b) => a.nombre.localeCompare(b.nombre, "es"));

  // ---------- Render ----------
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      <div className="bg-white/80 backdrop-blur-sm shadow-sm border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex flex-col sm:flex-row justify-between items-center gap-4">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-indigo-600 flex items-center justify-center shadow-md">
              <AcademicCapIcon className="h-6 w-6 text-white" />
            </div>
            <h1 className="text-2xl font-bold bg-gradient-to-r from-indigo-800 to-blue-800 bg-clip-text text-transparent">
              Panel de Editor
            </h1>
          </div>

          <div className="flex items-center gap-4">
            <NotificationBell />

            <div className="text-right">
              <p className="text-sm font-medium text-gray-700">
                {editorNombre} {editorApellido}
              </p>
              <p className="text-xs text-gray-500">{editorEmail}</p>
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
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
          <div className="inline-flex rounded-xl bg-white p-1 shadow-sm border border-gray-200 w-fit">
            <button
              onClick={() => setSeccionActiva("mis-documentos")}
              className={`px-4 py-2 rounded-lg text-sm font-semibold transition cursor-pointer ${
                seccionActiva === "mis-documentos"
                  ? "bg-indigo-600 text-white shadow-sm"
                  : "text-gray-600 hover:bg-gray-100"
              }`}
            >
              Mis documentos
            </button>

            <button
              onClick={() => setSeccionActiva("compartidos")}
              className={`px-4 py-2 rounded-lg text-sm font-semibold transition cursor-pointer ${
                seccionActiva === "compartidos"
                  ? "bg-indigo-600 text-white shadow-sm"
                  : "text-gray-600 hover:bg-gray-100"
              }`}
            >
              Compartidos
            </button>
          </div>

          {seccionActiva === "mis-documentos" && (
            <button
              onClick={() => setShowNewProgramaModal(true)}
              className="inline-flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-xl shadow-sm transition-all cursor-pointer"
            >
              <PlusIcon className="h-5 w-5" />
              <span>Nuevo programa</span>
            </button>
          )}
        </div>

        {seccionActiva === "mis-documentos" && (
          <>
            {loadingProgramas ? (
              <div className="p-12 text-center">
                <div className="inline-block animate-spin rounded-full h-8 w-8 border-4 border-indigo-600 border-t-transparent"></div>
                <p className="mt-2 text-gray-500">Cargando programas...</p>
              </div>
            ) : programas.length === 0 ? (
              <div className="bg-white rounded-2xl shadow-xl overflow-hidden p-12 text-center text-gray-500">
                No tienes programas. Crea uno nuevo.
              </div>
            ) : (
              <div className="space-y-4">
                {programas.map((prog) => (
                  <div
                    key={prog.id}
                    className="bg-white rounded-2xl shadow-xl overflow-hidden"
                  >
                    <div
                      className="flex justify-between items-center p-5 cursor-pointer hover:bg-gray-50 transition"
                      onClick={() => toggleExpand(prog.id)}
                    >
                      <div className="flex items-center gap-3">
                        <FolderIcon className="h-7 w-7 text-yellow-500" />

                        <div className="flex items-center gap-2 flex-wrap">
                          <h2 className="text-xl font-semibold text-gray-800">
                            {prog.nombre}
                          </h2>
                          {getModalidadBadge(prog.modalidad)}
                        </div>
                      </div>

                      <div className="flex gap-2">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleCrearCurso(prog.id);
                          }}
                          className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-700 hover:shadow-md transition-all cursor-pointer"
                        >
                          <PlusIcon className="h-5 w-5" />
                          Añadir curso
                        </button>

                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            eliminarPrograma(prog.id);
                          }}
                          className="text-red-600 hover:text-red-800 transition cursor-pointer"
                          title="Eliminar programa"
                        >
                          <TrashIcon className="h-5 w-5" />
                        </button>
                      </div>
                    </div>

                    {expanded[prog.id] && documentosPorPrograma[prog.id] && (
                      <div className="border-t border-gray-100 p-5 bg-gray-50/50">
                        <div className="overflow-x-auto">
                          <table className="min-w-full divide-y divide-gray-200">
                            <thead className="bg-gray-50">
                              <tr>
                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                                  Documento
                                </th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                                  Tipo
                                </th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                                  Última modificación
                                </th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                                  Aprobadas
                                </th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                                  Por corregir
                                </th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                                  Acciones
                                </th>
                              </tr>
                            </thead>

                            <tbody className="bg-white divide-y divide-gray-100">
                              {documentosPorPrograma[prog.id].map((doc) => (
                                <tr
                                  key={doc.id}
                                  className="hover:bg-gray-50 transition"
                                >
                                  <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-gray-900">
                                    {doc.titulo}
                                  </td>

                                  <td className="px-4 py-3 whitespace-nowrap text-sm">
                                    {getTipoDocumentoBadge(doc.tipo_documento)}
                                  </td>

                                  <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">
                                    {new Date(doc.updated_at).toLocaleString()}
                                  </td>

                                  {renderEstadisticas(doc)}

                                  <td className="px-4 py-3 whitespace-nowrap text-sm font-medium">
                                    <div className="flex gap-3">
                                      <button
                                        onClick={() =>
                                          navigate(
                                            `/editor/documento/${doc.id}`,
                                          )
                                        }
                                        className="text-indigo-600 hover:text-indigo-900 transition cursor-pointer"
                                        title="Editar"
                                      >
                                        <PencilIcon className="h-5 w-5" />
                                      </button>

                                      <button
                                        onClick={() => openShareModal(doc)}
                                        className="text-green-600 hover:text-green-900 transition cursor-pointer"
                                        title="Compartir"
                                      >
                                        <ShareIcon className="h-5 w-5" />
                                      </button>

                                      {doc.tipo_documento !== "maestro" && (
                                        <button
                                          onClick={() =>
                                            eliminarDocumento(doc.id, prog.id)
                                          }
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
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {seccionActiva === "compartidos" && (
          <>
            {loadingCompartidos ? (
              <div className="p-12 text-center">
                <div className="inline-block animate-spin rounded-full h-8 w-8 border-4 border-indigo-600 border-t-transparent"></div>
                <p className="mt-2 text-gray-500">
                  Cargando documentos compartidos...
                </p>
              </div>
            ) : documentosCompartidos.length === 0 ? (
              <div className="bg-white rounded-2xl shadow-xl overflow-hidden p-12 text-center text-gray-500">
                No tienes documentos compartidos.
              </div>
            ) : (
              <div className="space-y-4">
                {programasCompartidosAgrupados.map((programa) => (
                  <div
                    key={programa.id}
                    className="bg-white rounded-2xl shadow-xl overflow-hidden"
                  >
                    <div
                      className="flex justify-between items-center p-5 cursor-pointer hover:bg-gray-50 transition"
                      onClick={() => toggleExpandCompartido(programa.id)}
                    >
                      <div className="flex items-center gap-3">
                        <FolderIcon className="h-7 w-7 text-yellow-500" />

                        <div className="flex items-center gap-2 flex-wrap">
                          <h2 className="text-xl font-semibold text-gray-800">
                            {programa.nombre}
                          </h2>

                          {programa.modalidad &&
                            getModalidadBadge(programa.modalidad)}
                        </div>
                      </div>

                      <div className="flex gap-2">
                        <span className="inline-flex items-center rounded-full bg-gray-100 px-3 py-1 text-xs font-semibold text-gray-600 border border-gray-200">
                          {programa.documentos.length} documento
                          {programa.documentos.length === 1 ? "" : "s"}
                        </span>
                      </div>
                    </div>

                    {expandedCompartidos[programa.id] && (
                      <div className="border-t border-gray-100 p-5 bg-gray-50/50">
                        <div className="overflow-x-auto">
                          <table className="min-w-full divide-y divide-gray-200">
                            <thead className="bg-gray-50">
                              <tr>
                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                                  Documento
                                </th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                                  Tipo
                                </th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                                  Última modificación
                                </th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                                  Aprobadas
                                </th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                                  Por corregir
                                </th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                                  Permiso
                                </th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                                  Acciones
                                </th>
                              </tr>
                            </thead>

                            <tbody className="bg-white divide-y divide-gray-100">
                              {programa.documentos.map((doc) => (
                                <tr
                                  key={doc.id}
                                  className="hover:bg-gray-50 transition"
                                >
                                  <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-gray-900">
                                    {doc.titulo}
                                  </td>

                                  <td className="px-4 py-3 whitespace-nowrap text-sm">
                                    {getTipoDocumentoBadge(doc.tipo_documento)}
                                  </td>

                                  <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">
                                    {new Date(doc.updated_at).toLocaleString()}
                                  </td>

                                  {renderEstadisticas(doc)}

                                  <td className="px-4 py-3 whitespace-nowrap text-sm">
                                    {getPermisoBadge(doc.permiso_compartido)}
                                  </td>

                                  <td className="px-4 py-3 whitespace-nowrap text-sm font-medium">
                                    <button
                                      onClick={() =>
                                        navigate(`/editor/documento/${doc.id}`)
                                      }
                                      className="inline-flex items-center gap-2 text-indigo-600 hover:text-indigo-900 transition cursor-pointer"
                                      title="Abrir documento"
                                    >
                                      <PencilIcon className="h-5 w-5" />
                                      Abrir
                                    </button>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>

      {showShareModal && currentShareDoc && (
        <ShareModal
          onClose={() => setShowShareModal(false)}
          titulo={currentShareDoc.titulo}
          searchEmail={searchEmail}
          setSearchEmail={(value) => {
            setSearchEmail(value);
            setSelectedUserId(null);
          }}
          searchResults={searchResults}
          onSelectUser={selectUser}
          newPermiso={newPermiso}
          setNewPermiso={setNewPermiso}
          onAddShare={handleAddShare}
          sharedUsers={sharedUsers}
          onShareChange={handleShare}
          onRemoveShare={removeShare}
          loadingShare={loadingShare}
        />
      )}

      {showNewProgramaModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex items-center justify-center min-h-screen p-4 text-center">
            <div
              className="fixed inset-0 bg-black bg-opacity-40 transition-opacity"
              onClick={() => setShowNewProgramaModal(false)}
            ></div>

            <div className="relative bg-white rounded-2xl shadow-2xl max-w-md w-full p-6">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-xl font-semibold text-gray-900">
                  Nuevo programa
                </h3>

                <button
                  onClick={() => setShowNewProgramaModal(false)}
                  className="text-gray-400 hover:text-gray-600 cursor-pointer"
                >
                  <XMarkIcon className="h-6 w-6" />
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Nombre del programa *
                  </label>
                  <input
                    type="text"
                    value={newProgramaName}
                    onChange={(e) => setNewProgramaName(e.target.value)}
                    className="w-full border border-gray-300 rounded-xl p-2 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                    placeholder="Ej: Ingeniería de Software"
                    autoFocus
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Modalidad *
                  </label>

                  <select
                    value={newProgramaModalidad}
                    onChange={(e) => setNewProgramaModalidad(e.target.value)}
                    className="w-full border border-gray-300 rounded-xl p-2 bg-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                  >
                    <option value="pregrado">Pregrado</option>
                    <option value="posgrado">Posgrado</option>
                  </select>
                </div>

                <div className="flex justify-end gap-2">
                  <button
                    onClick={() => setShowNewProgramaModal(false)}
                    className="px-4 py-2 border border-gray-300 rounded-xl text-gray-700 hover:bg-gray-50 cursor-pointer"
                  >
                    Cancelar
                  </button>

                  <button
                    onClick={handleCrearPrograma}
                    disabled={creatingPrograma}
                    className="px-4 py-2 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 disabled:opacity-50 cursor-pointer"
                  >
                    {creatingPrograma
                      ? "Creando programa y plantilla..."
                      : "Crear programa"}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
