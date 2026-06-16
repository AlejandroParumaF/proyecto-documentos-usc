// src/features/documentos/DocumentoEditorPage.jsx

import { useEffect, useState, useRef } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { supabase } from "../../lib/supabase";
import { registrarLog } from "../../lib/logs";
import html2canvas from "html2canvas";
import jsPDF from "jspdf";
import html2pdf from "html2pdf.js";
import {
  PlusIcon,
  XMarkIcon,
  AcademicCapIcon,
} from "@heroicons/react/24/outline";
import { PanelAnexos } from "../../components/PanelAnexos";
import { ShareModal } from "../../components/ShareModal";

// Hooks personalizados
import { useDocumento } from "./hooks/useDocumento";
import { useSecciones } from "./hooks/useSecciones";
import { useAutoguardado } from "./hooks/useAutoguardado";
import { useVersiones } from "./hooks/useVersiones";
import { useCompartir } from "./hooks/useCompartir";

// Componentes hijos
import { DocumentoHeader } from "./components/DocumentoHeader";
import { SeccionesSidebar } from "./components/SeccionesSidebar";
import { EditorArea } from "./components/EditorArea";
import { VersionsModal } from "./components/VersionsModal";

const HEADER_IMAGE_URL =
  "https://fcjrqdmdwfkzqoygioes.supabase.co/storage/v1/object/public/images/usc_header.png";
const DEFAULT_MARGEN_LATERAL_CM = 3;

export const DocumentoEditorPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user, role } = useAuth();
  const [searchParams] = useSearchParams();
  const readonlyParam = searchParams.get("readonly") === "true";
  const isNew = id === "nuevo";

  // Estados locales (sin cambios)
  const [plantillas, setPlantillas] = useState([]);
  const [mostrarSelectorPlantilla, setMostrarSelectorPlantilla] =
    useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [lastSavedContent, setLastSavedContent] = useState("");
  const [showLogsModal, setShowLogsModal] = useState(false);
  const [logsData, setLogsData] = useState([]);
  const [loadingLogs, setLoadingLogs] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState(null);
  const [showSaveTemplateModal, setShowSaveTemplateModal] = useState(false);
  const [templateName, setTemplateName] = useState("");
  const [templateDescription, setTemplateDescription] = useState("");
  const [savingTemplate, setSavingTemplate] = useState(false);
  const isDeleting = useRef(false);

  // ---------- Hooks (sin cambios) ----------
  const {
    documento,
    setDocumento,
    secciones,
    setSecciones,
    seccionActiva,
    setSeccionActiva,
    permiso,
    loading,
    loadingContenido,
    error: docError,
    cargarContenidoSeccion,
    cargarTodasLasSeccionesConContenido,
  } = useDocumento(id, user, readonlyParam);

  const {
    editandoTituloSeccion,
    setEditandoTituloSeccion,
    nuevoTitulo,
    setNuevoTitulo,
    agregarSeccion,
    eliminarSeccion,
    duplicarSeccion,
    actualizarTituloSeccion,
    guardarContenidoSeccion,
    marcarPendiente,
    desmarcarPendiente,
    marcarCorrecciones,
    aprobarSeccion,
  } = useSecciones(
    id,
    permiso,
    role,
    isNew,
    readonlyParam,
    setSecciones,
    setSeccionActiva,
    setLastSavedContent,
    seccionActiva,
  );

  const { autoSaveStatus, handleContentChange, cleanup } = useAutoguardado(
    id,
    permiso,
    isNew,
    readonlyParam,
    seccionActiva,
    setSecciones,
    setSeccionActiva,
    lastSavedContent,
    setLastSavedContent,
  );

  const {
    showVersionsModal,
    setShowVersionsModal,
    versiones,
    cargandoVersiones,
    guardarVersion,
    cargarVersiones,
    restaurarVersion,
    eliminarVersion,
  } = useVersiones(id, permiso, isNew, readonlyParam, secciones);

  const {
    showShareModal,
    setShowShareModal,
    sharedUsers,
    searchEmail,
    setSearchEmail,
    searchResults,
    buscarUsuarioPorEmail,
    newPermiso,
    setNewPermiso,
    loadingShare,
    handleShare,
    removeShare,
    onChangePermiso,
  } = useCompartir(id, permiso, isNew, readonlyParam);

  const margenLateralCm = Number.isFinite(Number(documento?.margen_lateral_cm))
    ? Number(documento.margen_lateral_cm)
    : DEFAULT_MARGEN_LATERAL_CM;

  // ---------- Funciones auxiliares (sin cambios, excepto exportación PDF) ----------
  const logAccion = async (accion, seccionId = null, detalle = {}) => {
    if (!isNew && id && !readonlyParam) {
      await registrarLog(id, seccionId, accion, detalle);
    }
  };

  const guardarTituloDocumento = async (nuevoTitulo) => {
    if (isNew || readonlyParam) return;
    if (documento.titulo === nuevoTitulo) return;
    await supabase
      .from("documentos")
      .update({ titulo: nuevoTitulo, updated_at: new Date().toISOString() })
      .eq("id", id);
  };

  const cambiarSeccion = async (nuevaSeccion) => {
    if (!nuevaSeccion) return;

    if (seccionActiva && !readonlyParam) {
      if (seccionActiva.contenido !== lastSavedContent) {
        await guardarContenidoSeccion(
          seccionActiva,
          seccionActiva.contenido,
          true,
        );

        await logAccion("editar_contenido", seccionActiva.id, {
          titulo: seccionActiva.titulo,
          longitud: seccionActiva.contenido?.length || 0,
        });
      }
    }

    sessionStorage.setItem(`seccion_activa_${id}`, nuevaSeccion.id);

    const seccionConContenido = await cargarContenidoSeccion(nuevaSeccion);

    setSeccionActiva(seccionConContenido);
    setLastSavedContent(seccionConContenido?.contenido || "");
  };

  const handleGoBack = async () => {
    if (seccionActiva && !readonlyParam) {
      if (seccionActiva.contenido !== lastSavedContent) {
        await guardarContenidoSeccion(
          seccionActiva,
          seccionActiva.contenido,
          true,
        );
        await logAccion("editar_contenido", seccionActiva.id, {
          titulo: seccionActiva.titulo,
          longitud: seccionActiva.contenido?.length || 0,
        });
      }
    }
    if (role === "revisor") navigate("/revisor");
    else if (role === "editor") navigate("/editor");
    else if (role === "admin") navigate("/admin");
    else navigate("/");
  };

  const handleAprobar = () => {
    if (seccionActiva) aprobarSeccion(seccionActiva.id);
  };
  const handleSolicitarCorrecciones = () => {
    if (seccionActiva) marcarCorrecciones(seccionActiva.id);
  };
  const handleMarcarPendiente = () => {
    if (seccionActiva) marcarPendiente(seccionActiva.id);
  };

  const handleTogglePendienteSidebar = (seccionId, setPending) => {
    if (setPending) marcarPendiente(seccionId);
    else desmarcarPendiente(seccionId);
  };

  const filePickerCallback = (callback, value, meta) => {
    if (meta.filetype === "image") {
      const input = document.createElement("input");
      input.setAttribute("type", "file");
      input.setAttribute("accept", "image/*");
      input.onchange = () => {
        const file = input.files[0];
        if (file) {
          const reader = new FileReader();
          reader.onload = (e) => callback(e.target.result, { alt: file.name });
          reader.readAsDataURL(file);
        }
      };
      input.click();
    }
  };

  const crearDocumentoConPlantilla = async (plantillaId, tituloDocumento) => {
    if (!tituloDocumento?.trim()) {
      setError("El nombre del documento es obligatorio");
      return;
    }
    setSaving(true);
    try {
      const now = new Date().toISOString();
      const { data: newDoc, error: docError } = await supabase
        .from("documentos")
        .insert({
          titulo: tituloDocumento.trim(),
          usuario_id: user.id,
          created_at: now,
          updated_at: now,
        })
        .select()
        .single();
      if (docError) throw docError;
      if (plantillaId) {
        const { data: seccionesPlantilla } = await supabase
          .from("plantilla_secciones")
          .select("*")
          .eq("plantilla_id", plantillaId)
          .order("orden", { ascending: true });
        if (seccionesPlantilla?.length) {
          const nuevasSecciones = seccionesPlantilla.map((ps, idx) => ({
            documento_id: newDoc.id,
            titulo: ps.titulo,
            contenido: ps.contenido || "",
            orden: idx,
            estado_revision: null,
            aprobado_revisor: false,
          }));
          await supabase.from("secciones").insert(nuevasSecciones);
        }
      }
      await registrarLog(newDoc.id, null, "crear_documento", {
        titulo: tituloDocumento.trim(),
      });
      navigate(`/editor/documento/${newDoc.id}`);
    } catch (err) {
      console.error(err);
      setError("Error al crear el documento");
      setSaving(false);
    }
  };

  const cargarLogsDocumento = async () => {
    if (!id) return;
    setLoadingLogs(true);
    try {
      const { data, error } = await supabase
        .from("logs")
        .select("*")
        .eq("documento_id", id)
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

  const selectUser = (user) => {
    setSearchEmail(user.email);
    setSelectedUserId(user.id);
    setSearchResults([]);
  };
  const handleAddShare = async () => {
    const email = searchEmail.trim().toLowerCase();

    if (!email) {
      alert("Ingresa un email válido");
      return;
    }

    if (selectedUserId) {
      await handleShare(selectedUserId, newPermiso);
      setSelectedUserId(null);
      setSearchEmail("");
      setSearchResults([]);
      return;
    }

    const exactMatch = searchResults.find(
      (u) => u.email?.trim().toLowerCase() === email,
    );

    if (exactMatch) {
      await handleShare(exactMatch.id, newPermiso);
      setSelectedUserId(null);
      setSearchEmail("");
      setSearchResults([]);
      return;
    }

    const usuarioEncontrado = await buscarUsuarioPorEmail(email);

    if (usuarioEncontrado) {
      await handleShare(usuarioEncontrado.id, newPermiso);
      setSelectedUserId(null);
      setSearchEmail("");
      setSearchResults([]);
      return;
    }

    alert("Usuario no encontrado. Verifica que el correo esté registrado.");
  };

  const reemplazarSaltosPagina = (html) => {
    if (!html) return "";
    return html.replace(
      /<!-- pagebreak -->/g,
      '<div class="page-break"></div>',
    );
  };

  const normalizarParentId = (parentId) => parentId || null;

  const ordenarSeccionesJerarquicamente = (lista = []) => {
    const mapa = new Map();
    const raices = [];

    lista.forEach((sec) => {
      mapa.set(sec.id, {
        ...sec,
        children: [],
      });
    });

    mapa.forEach((sec) => {
      const parentId = normalizarParentId(sec.parent_id);

      if (parentId && mapa.has(parentId)) {
        mapa.get(parentId).children.push(sec);
      } else {
        raices.push(sec);
      }
    });

    const ordenar = (items) => {
      items.sort((a, b) => (a.orden ?? 0) - (b.orden ?? 0));
      items.forEach((item) => ordenar(item.children || []));
    };

    ordenar(raices);

    const aplanar = (items) =>
      items.flatMap((item) => [item, ...aplanar(item.children || [])]);

    return aplanar(raices).map(({ children, ...sec }) => sec);
  };

  const calcularNivelSeccion = (seccion, mapaSecciones) => {
    let nivel = 0;
    let parentId = seccion.parent_id || null;

    while (parentId && mapaSecciones.has(parentId)) {
      nivel += 1;
      parentId = mapaSecciones.get(parentId)?.parent_id || null;
    }

    return nivel;
  };

  const guardarSeccionActivaSiHayCambios = async () => {
    if (!seccionActiva || readonlyParam) return;

    if (seccionActiva.contenido !== lastSavedContent) {
      await guardarContenidoSeccion(
        seccionActiva,
        seccionActiva.contenido || "",
        true,
      );

      await logAccion("editar_contenido", seccionActiva.id, {
        titulo: seccionActiva.titulo,
        longitud: seccionActiva.contenido?.length || 0,
      });
    }
  };

  const obtenerSeccionesCompletas = async () => {
    await guardarSeccionActivaSiHayCambios();

    const { data, error } = await supabase
      .from("secciones")
      .select(
        "id, titulo, contenido, orden, parent_id, nivel, aprobado_revisor, estado_revision",
      )
      .eq("documento_id", id)
      .order("orden", { ascending: true });

    if (error) throw error;

    const seccionesCompletas = (data || []).map((sec) => {
      if (sec.id === seccionActiva?.id) {
        return {
          ...sec,
          contenido: seccionActiva.contenido || sec.contenido || "",
          contenidoCargado: true,
        };
      }

      return {
        ...sec,
        contenido: sec.contenido || "",
        contenidoCargado: true,
      };
    });

    const seccionesOrdenadas =
      ordenarSeccionesJerarquicamente(seccionesCompletas);

    setSecciones(seccionesOrdenadas);

    return seccionesOrdenadas;
  };

  const guardarVersionCompleta = async () => {
    try {
      const seccionesCompletas = await obtenerSeccionesCompletas();
      await guardarVersion(seccionesCompletas);
    } catch (err) {
      console.error(err);
      alert("Error al preparar el documento completo para guardar versión.");
    }
  };

  const exportarDocx = async () => {
    try {
      const seccionesCompletas = await obtenerSeccionesCompletas();

      const contenidoModificado = seccionesCompletas
        .map((s) => reemplazarSaltosPagina(s.contenido || ""))
        .join('<div style="margin-bottom: 30px;"></div>');

      const docHtml = `<!DOCTYPE html>
      <html>
      <head><meta charset="UTF-8"><title>${documento?.titulo || "documento"}</title>
      <style>
        body {
  font-family: 'Arial', sans-serif;
  font-size: 12pt;
  margin-top: 2.5cm;
  margin-bottom: 2.5cm;
  margin-left: ${margenLateralCm}cm;
  margin-right: ${margenLateralCm}cm;
  padding: 0;
  background: white;
}
        .page-break { page-break-before: always; }
        img { max-width: 100%; height: auto; }
        table { width: 100%; border-collapse: collapse; margin: 10px 0; }
        th, td { border: 1px solid #ccc; padding: 8px; }
        h1, h2, h3, h4, h5, h6 { margin-top: 20px; margin-bottom: 10px; }
      </style></head>
      <body>${contenidoModificado}</body></html>`;

      const blob = new Blob([docHtml], { type: "application/msword" });
      const link = document.createElement("a");

      link.href = URL.createObjectURL(blob);
      link.download = `${documento?.titulo || "documento"}.doc`;

      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      URL.revokeObjectURL(link.href);
    } catch (err) {
      console.error(err);
      alert("Error al exportar DOCX.");
    }
  };

  const reordenarSecciones = async (nuevoOrden, parentId = null) => {
    setSecciones(nuevoOrden);

    try {
      const seccionesMismoNivel = nuevoOrden
        .filter((sec) => (sec.parent_id || null) === (parentId || null))
        .sort((a, b) => (a.orden ?? 0) - (b.orden ?? 0));

      for (let i = 0; i < seccionesMismoNivel.length; i++) {
        const seccion = seccionesMismoNivel[i];

        await supabase
          .from("secciones")
          .update({
            orden: i,
            updated_at: new Date().toISOString(),
          })
          .eq("id", seccion.id);
      }

      await logAccion("reordenar_secciones", null, {
        parent_id: parentId,
        nuevo_orden: seccionesMismoNivel.map((s) => ({
          id: s.id,
          titulo: s.titulo,
          orden: s.orden,
          parent_id: s.parent_id || null,
        })),
      });
    } catch (err) {
      console.error(err);

      const { data } = await supabase
        .from("secciones")
        .select(
          "id, titulo, contenido, orden, parent_id, nivel, aprobado_revisor, estado_revision",
        )
        .eq("documento_id", id)
        .order("orden", { ascending: true });

      if (data) setSecciones(data);

      alert(
        "Error al reordenar secciones. Se ha restaurado el orden original.",
      );
    }
  };

  const guardarComoPlantilla = () => {
    if (role !== "admin") {
      alert("Solo los administradores pueden crear plantillas del sistema.");
      return;
    }
    setTemplateName(documento?.titulo || "Plantilla sin título");
    setTemplateDescription("");
    setShowSaveTemplateModal(true);
  };

  const crearPlantillaDesdeDocumento = async () => {
    if (!templateName.trim()) {
      alert("El nombre de la plantilla es obligatorio");
      return;
    }
    setSavingTemplate(true);
    try {
      const { data: existing } = await supabase
        .from("plantillas")
        .select("id")
        .eq("nombre", templateName.trim())
        .maybeSingle();
      if (existing) {
        alert("Ya existe una plantilla con ese nombre. Usa otro nombre.");
        setSavingTemplate(false);
        return;
      }

      const margenPlantillaCm = Number.isFinite(
        Number(documento?.margen_lateral_cm),
      )
        ? Math.min(Math.max(Number(documento.margen_lateral_cm), 0.5), 6)
        : 3;
      const { data: plantilla, error: plantillaError } = await supabase
        .from("plantillas")
        .insert({
          nombre: templateName.trim(),
          descripcion: templateDescription.trim() || null,
          margen_lateral_cm: margenPlantillaCm,
        })
        .select()
        .single();
      if (plantillaError) throw plantillaError;
      const seccionesCompletas = await obtenerSeccionesCompletas();

      const mapaSecciones = new Map(
        seccionesCompletas.map((sec) => [sec.id, sec]),
      );

      const calcularNivelSeccion = (seccion) => {
        let nivel = 0;
        let parentId = seccion.parent_id || null;

        while (parentId && mapaSecciones.has(parentId)) {
          nivel += 1;
          parentId = mapaSecciones.get(parentId)?.parent_id || null;
        }

        return nivel;
      };

      const seccionesParaInsertar = seccionesCompletas.map((sec) => ({
        plantilla_id: plantilla.id,
        titulo: sec.titulo,
        contenido: sec.contenido || "",
        orden: sec.orden ?? 0,
        seccion_original_id: sec.id,
        parent_seccion_original_id: sec.parent_id || null,
        nivel: calcularNivelSeccion(sec),
      }));
      const { error: seccionesError } = await supabase
        .from("plantilla_secciones")
        .insert(seccionesParaInsertar);
      if (seccionesError) throw seccionesError;
      alert("Plantilla guardada exitosamente.");
      setShowSaveTemplateModal(false);
      setTemplateName("");
      setTemplateDescription("");
    } catch (err) {
      console.error(err);
      alert("Error al guardar la plantilla: " + err.message);
    } finally {
      setSavingTemplate(false);
    }
  };

  // Eliminar sección con tecla Supr
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (
        (e.key === "Delete" || e.key === "Supr") &&
        seccionActiva &&
        !readonlyParam &&
        (permiso === "dueño" || permiso === "escritura")
      ) {
        e.preventDefault();
        if (isDeleting.current) return;
        isDeleting.current = true;
        eliminarSeccion(
          seccionActiva,
          secciones,
          setSecciones,
          seccionActiva,
          setSeccionActiva,
        );
        setTimeout(() => {
          isDeleting.current = false;
        }, 100);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [
    seccionActiva,
    readonlyParam,
    permiso,
    eliminarSeccion,
    secciones,
    setSecciones,
    setSeccionActiva,
  ]);

  useEffect(() => {
    if (seccionActiva?.id && !isNew) {
      sessionStorage.setItem(`seccion_activa_${id}`, seccionActiva.id);
    }
  }, [seccionActiva?.id, id, isNew]);

  const handleGoBackConLimpieza = () => {
    sessionStorage.removeItem(`seccion_activa_${id}`);
    handleGoBack();
  };

  useEffect(() => {
    if (isNew) {
      const cargarPlantillas = async () => {
        const { data, error } = await supabase
          .from("plantillas")
          .select("*")
          .order("nombre");
        if (error) console.error(error);
        else setPlantillas(data || []);
      };
      cargarPlantillas();
      setMostrarSelectorPlantilla(true);
    }
  }, [isNew]);

  useEffect(() => cleanup, [cleanup]);

  const escribirPantallaCargaPDF = (ventana) => {
    ventana.document.open();
    ventana.document.write(`
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="UTF-8" />
        <title>Preparando PDF...</title>
        <style>
          html,
          body {
            margin: 0;
            padding: 0;
            width: 100%;
            height: 100%;
            font-family: Arial, sans-serif;
            background: #f3f4f6;
          }

          .loading-wrapper {
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 24px;
          }

          .loading-card {
            background: white;
            border-radius: 16px;
            padding: 32px;
            max-width: 420px;
            width: 100%;
            text-align: center;
            box-shadow: 0 20px 40px rgba(15, 23, 42, 0.12);
          }

          .spinner {
            width: 44px;
            height: 44px;
            border: 4px solid #e5e7eb;
            border-top-color: #2563eb;
            border-radius: 9999px;
            margin: 0 auto 18px;
            animation: spin 0.9s linear infinite;
          }

          h1 {
            font-size: 20px;
            color: #111827;
            margin: 0 0 8px;
          }

          p {
            color: #6b7280;
            margin: 0;
            font-size: 14px;
            line-height: 1.5;
          }

          @keyframes spin {
            to {
              transform: rotate(360deg);
            }
          }
        </style>
      </head>

      <body>
        <div class="loading-wrapper">
          <div class="loading-card">
            <div class="spinner"></div>
            <h1>Preparando PDF...</h1>
            <p>Estamos cargando todas las secciones y preparando el documento para imprimir.</p>
          </div>
        </div>
      </body>
    </html>
  `);
    ventana.document.close();
  };

  const escribirPantallaErrorPDF = (
    ventana,
    mensaje = "No se pudo generar el PDF.",
  ) => {
    ventana.document.open();
    ventana.document.write(`
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="UTF-8" />
        <title>Error al generar PDF</title>
        <style>
          body {
            margin: 0;
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
            font-family: Arial, sans-serif;
            background: #f3f4f6;
            color: #111827;
          }

          .card {
            background: white;
            border-radius: 16px;
            padding: 32px;
            max-width: 420px;
            box-shadow: 0 20px 40px rgba(15, 23, 42, 0.12);
            text-align: center;
          }

          h1 {
            color: #dc2626;
            font-size: 20px;
            margin: 0 0 8px;
          }

          p {
            color: #6b7280;
            font-size: 14px;
            line-height: 1.5;
          }

          button {
            margin-top: 18px;
            background: #2563eb;
            color: white;
            border: none;
            border-radius: 8px;
            padding: 10px 16px;
            cursor: pointer;
          }
        </style>
      </head>

      <body>
        <div class="card">
          <h1>Error al generar PDF</h1>
          <p>${mensaje}</p>
          <button onclick="window.close()">Cerrar</button>
        </div>
      </body>
    </html>
  `);
    ventana.document.close();
  };

  //////////////////////////////////////////////////////

  const normalizarContenidoParaPDF = (html = "") => {
    const contenedor = document.createElement("div");
    contenedor.innerHTML = html;

    contenedor.querySelectorAll("table").forEach((table) => {
      table.removeAttribute("width");
      table.removeAttribute("height");
      table.removeAttribute("cellspacing");
      table.removeAttribute("cellpadding");

      table.classList.add("tabla-pdf-ajustada");

      table.style.width = "100%";
      table.style.maxWidth = "100%";
      table.style.minWidth = "0";
      table.style.tableLayout = "fixed";
      table.style.borderCollapse = "collapse";
      table.style.boxSizing = "border-box";
      table.style.transform = "none";
    });

    // Word suele pegar colgroup/col con anchos fijos enormes.
    // Quitarlos evita que fuercen el ancho total de la tabla.
    contenedor.querySelectorAll("colgroup").forEach((colgroup) => {
      colgroup.remove();
    });

    contenedor.querySelectorAll("th, td").forEach((cell) => {
      const backgroundColor =
        cell.style.backgroundColor ||
        cell.style.background ||
        cell.getAttribute("bgcolor") ||
        "";

      const color = cell.style.color || "";

      cell.removeAttribute("width");
      cell.removeAttribute("height");

      cell.style.width = "auto";
      cell.style.maxWidth = "100%";
      cell.style.minWidth = "0";
      cell.style.boxSizing = "border-box";
      cell.style.overflowWrap = "anywhere";
      cell.style.wordBreak = "break-word";
      cell.style.whiteSpace = "normal";

      // Importante para conservar fondos aplicados en TinyMCE o pegados desde Word.
      if (backgroundColor) {
        cell.style.backgroundColor = backgroundColor;
      }

      if (color) {
        cell.style.color = color;
      }

      cell.style.webkitPrintColorAdjust = "exact";
      cell.style.printColorAdjust = "exact";
    });

    contenedor.querySelectorAll("p, div, span, li, a").forEach((el) => {
      el.style.maxWidth = "100%";
      el.style.overflowWrap = "anywhere";
      el.style.wordBreak = "break-word";
    });

    contenedor.querySelectorAll("img").forEach((img) => {
      img.removeAttribute("width");
      img.removeAttribute("height");

      img.style.maxWidth = "100%";
      img.style.height = "auto";
    });

    return contenedor.innerHTML;
  };

  /////////////////////////////////////////////////////

  const generarPDF = async () => {
    const ventana = window.open("/test", "_blank");

    if (!ventana) {
      alert(
        "El navegador bloqueó la ventana emergente. Permite pop-ups para exportar el PDF.",
      );
      return;
    }

    escribirPantallaCargaPDF(ventana);

    const margenPDFCm = Number.isFinite(Number(margenLateralCm))
      ? Math.min(Math.max(Number(margenLateralCm), 0.5), 6)
      : 3;

    const normalizarContenidoParaPDF = (html = "") => {
      const contenedor = document.createElement("div");
      contenedor.innerHTML = html;

      contenedor.querySelectorAll("table").forEach((table) => {
        table.removeAttribute("width");
        table.removeAttribute("height");
        table.removeAttribute("cellspacing");
        table.removeAttribute("cellpadding");

        table.classList.add("tabla-pdf-ajustada");

        table.style.width = "100%";
        table.style.maxWidth = "100%";
        table.style.minWidth = "0";
        table.style.tableLayout = "fixed";
        table.style.borderCollapse = "collapse";
        table.style.boxSizing = "border-box";
        table.style.transform = "none";
      });

      contenedor.querySelectorAll("colgroup").forEach((colgroup) => {
        colgroup.remove();
      });

      contenedor.querySelectorAll("col").forEach((col) => {
        col.remove();
      });

      contenedor.querySelectorAll("th, td").forEach((cell) => {
        cell.removeAttribute("width");
        cell.removeAttribute("height");

        cell.style.width = "auto";
        cell.style.maxWidth = "100%";
        cell.style.minWidth = "0";
        cell.style.boxSizing = "border-box";
        cell.style.overflowWrap = "anywhere";
        cell.style.wordBreak = "break-word";
        cell.style.whiteSpace = "normal";
      });

      contenedor.querySelectorAll("p, div, span, li, a").forEach((el) => {
        el.style.maxWidth = "100%";
        el.style.overflowWrap = "anywhere";
        el.style.wordBreak = "break-word";
      });

      contenedor.querySelectorAll("img").forEach((img) => {
        img.removeAttribute("width");
        img.removeAttribute("height");

        img.style.maxWidth = "100%";
        img.style.height = "auto";
      });

      return contenedor.innerHTML;
    };

    try {
      const seccionesCompletas = await obtenerSeccionesCompletas();

      const contenido = seccionesCompletas
        .map(
          (s, idx) => `
          <div
            style="
              page-break-before: ${idx === 0 ? "auto" : "always"};
            "
          >
            ${normalizarContenidoParaPDF(
              reemplazarSaltosPagina(s.contenido || ""),
            )}
          </div>
        `,
        )
        .join("");

      ventana.document.open();

      ventana.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="UTF-8">
          <title>${documento?.titulo || "Documento"}</title>

          <style>
            @page {
              size: letter;
              margin-top: 0.01cm;
              margin-right: 0;
              margin-left: 0;
              margin-bottom: 2cm;
            }

            html,
            body {
              margin: 0;
              padding: 0;
              width: 100%;
              max-width: 100%;
              overflow-x: hidden;
            }

            body {
              font-family: Arial, sans-serif;
              font-size: 10pt;
              line-height: 1.3;
              background: white;
            }

            .pdf-toolbar {
              position: sticky;
              top: 0;
              z-index: 9999;
              background: #f9fafb;
              border-bottom: 1px solid #e5e7eb;
              padding: 12px 16px;
              display: flex;
              justify-content: space-between;
              align-items: center;
              gap: 12px;
              font-family: Arial, sans-serif;
            }

            .pdf-toolbar-info {
              display: flex;
              flex-direction: column;
              gap: 2px;
            }

            .pdf-toolbar-title {
              font-size: 14px;
              font-weight: 700;
              color: #111827;
            }

            .pdf-toolbar-subtitle {
              font-size: 12px;
              color: #6b7280;
            }

            .pdf-toolbar-actions {
              display: flex;
              gap: 8px;
              align-items: center;
            }

            .pdf-toolbar button {
              border: none;
              border-radius: 8px;
              padding: 10px 14px;
              font-size: 14px;
              cursor: pointer;
              transition: opacity 0.2s ease;
            }

            .pdf-toolbar button:disabled {
              opacity: 0.55;
              cursor: not-allowed;
            }

            .print-button {
              background: #2563eb;
              color: white;
              box-shadow: 0 8px 20px rgba(37, 99, 235, 0.25);
            }

            .close-button {
              background: #e5e7eb;
              color: #374151;
            }

            .pdf-document {
              width: 100%;
              max-width: 100%;
              border-collapse: collapse;
              table-layout: fixed;
            }

            .pdf-document > thead {
              display: table-header-group;
            }

            .pdf-document > thead > tr > td,
            .pdf-document > tbody > tr > td,
            .pdf-document > thead > tr > th,
            .pdf-document > tbody > tr > th {
              border: none;
              padding: 0;
            }

            .header-image {
              width: 100%;
              display: block;
              max-width: none;
            }

            .page-content {
              padding-top: 0.2cm;
              padding-left: ${margenPDFCm}cm;
              padding-right: ${margenPDFCm}cm;
              padding-bottom: 2.5cm;
              width: 100%;
              max-width: 100%;
              box-sizing: border-box;
              overflow-x: hidden;
              overflow-wrap: anywhere;
              word-break: break-word;
            }

            .page-content * {
              max-width: 100% !important;
              box-sizing: border-box !important;
            }

            .page-content p,
            .page-content li,
            .page-content div,
            .page-content span,
            .page-content a,
            .page-content td,
            .page-content th {
              overflow-wrap: anywhere !important;
              word-break: break-word !important;
            }

            .page-content a {
              color: #2563eb;
              text-decoration: underline;
              overflow-wrap: anywhere !important;
              word-break: break-all !important;
            }

            .page-content p {
              margin: 0;
              page-break-inside: avoid;
            }

            .page-content img {
              max-width: 100% !important;
              height: auto !important;
            }

            .page-content table,
            .page-content .tabla-pdf-ajustada {
              width: 100% !important;
              max-width: 100% !important;
              min-width: 0 !important;
              border-collapse: collapse !important;
              table-layout: fixed !important;
              box-sizing: border-box !important;
              transform: none !important;
            }

            .page-content table thead {
              display: table-row-group !important;
            }

            .page-content table th,
.page-content table td {
  border: 1px solid #ccc !important;
  padding: 8px !important;
  max-width: 100% !important;
  min-width: 0 !important;
  width: auto !important;
  box-sizing: border-box !important;
  overflow-wrap: anywhere !important;
  word-break: break-word !important;
  white-space: normal !important;
  -webkit-print-color-adjust: exact !important;
  print-color-adjust: exact !important;
}}

            .page-content table tr {
              page-break-inside: avoid;
            }

            .page-break {
              page-break-before: always;
            }

            @media print {
              .pdf-toolbar {
                display: none !important;
              }

              html,
              body {
                width: 100%;
                max-width: 100%;
                overflow-x: hidden;
              }

              .page-content {
                overflow: hidden;
              }
            }
          </style>
        </head>

        <body>
          <div class="pdf-toolbar">
            <div class="pdf-toolbar-info">
              <span class="pdf-toolbar-title">PDF listo</span>
              <span id="pdf-status" class="pdf-toolbar-subtitle">
                Cargando imágenes del documento...
              </span>
            </div>

            <div class="pdf-toolbar-actions">
              <button
                id="print-button"
                class="print-button"
                type="button"
                disabled
              >
                Imprimir / Guardar PDF
              </button>

              <button
                class="close-button"
                type="button"
                onclick="window.close()"
              >
                Cerrar
              </button>
            </div>
          </div>

          <table class="pdf-document">
            <thead>
              <tr>
                <td>
                  <img
                    src="${HEADER_IMAGE_URL}"
                    alt="Encabezado"
                    class="header-image"
                  />
                </td>
              </tr>
            </thead>

            <tbody>
              <tr>
                <td>
                  <div class="page-content">
                    ${contenido}
                  </div>
                </td>
              </tr>
            </tbody>
          </table>

          <script>
            (function () {
              const printButton = document.getElementById("print-button");
              const status = document.getElementById("pdf-status");

              const normalizarTablas = () => {
                const tablas = Array.from(
                  document.querySelectorAll(".page-content table")
                );

                tablas.forEach((table) => {
                  table.removeAttribute("width");
                  table.removeAttribute("height");
                  table.style.width = "100%";
                  table.style.maxWidth = "100%";
                  table.style.minWidth = "0";
                  table.style.tableLayout = "fixed";
                  table.style.borderCollapse = "collapse";
                  table.style.boxSizing = "border-box";
                  table.style.transform = "none";
                });

                const colgroups = Array.from(
                  document.querySelectorAll(".page-content colgroup, .page-content col")
                );

                colgroups.forEach((el) => el.remove());

                const celdas = Array.from(
                  document.querySelectorAll(".page-content th, .page-content td")
                );

                celdas.forEach((cell) => {
  const backgroundColor =
    cell.style.backgroundColor ||
    cell.style.background ||
    cell.getAttribute("bgcolor") ||
    "";

  const color = cell.style.color || "";

  cell.removeAttribute("width");
  cell.removeAttribute("height");

  cell.style.width = "auto";
  cell.style.maxWidth = "100%";
  cell.style.minWidth = "0";
  cell.style.boxSizing = "border-box";
  cell.style.overflowWrap = "anywhere";
  cell.style.wordBreak = "break-word";
  cell.style.whiteSpace = "normal";

  if (backgroundColor) {
    cell.style.backgroundColor = backgroundColor;
  }

  if (color) {
    cell.style.color = color;
  }

  cell.style.webkitPrintColorAdjust = "exact";
  cell.style.printColorAdjust = "exact";
});
              };

              const habilitarImpresion = () => {
                normalizarTablas();

                if (printButton) {
                  printButton.disabled = false;
                }

                if (status) {
                  status.textContent =
                    "Documento preparado. Puedes imprimir o guardar como PDF.";
                }
              };

              const esperarImagenes = () => {
                const imagenes = Array.from(document.querySelectorAll("img"));

                if (imagenes.length === 0) {
                  habilitarImpresion();
                  return;
                }

                let pendientes = imagenes.length;
                let finalizado = false;

                const terminar = () => {
                  if (finalizado) return;

                  finalizado = true;
                  habilitarImpresion();
                };

                const marcarLista = () => {
                  if (finalizado) return;

                  pendientes -= 1;

                  if (pendientes <= 0) {
                    terminar();
                  }
                };

                setTimeout(terminar, 8000);

                imagenes.forEach((img) => {
                  if (img.complete) {
                    marcarLista();
                  } else {
                    img.addEventListener("load", marcarLista, { once: true });
                    img.addEventListener("error", marcarLista, { once: true });
                  }
                });
              };

              if (printButton) {
                printButton.addEventListener("click", () => {
                  normalizarTablas();

                  let cierreProgramado = false;

                  const cerrarPestana = () => {
                    if (cierreProgramado) return;

                    cierreProgramado = true;

                    setTimeout(() => {
                      try {
                        window.close();
                      } catch (err) {
                        console.error("No se pudo cerrar la pestaña:", err);
                      }
                    }, 500);
                  };

                  window.onafterprint = cerrarPestana;
                  window.addEventListener("afterprint", cerrarPestana, {
                    once: true,
                  });

                  window.focus();
                  window.print();

                  setTimeout(() => {
                    cerrarPestana();
                  }, 3000);
                });
              }

              if (document.readyState === "complete") {
                esperarImagenes();
              } else {
                window.addEventListener("load", esperarImagenes, {
                  once: true,
                });
              }
            })();
          </script>
        </body>
      </html>
    `);

      ventana.document.close();
      ventana.focus();
    } catch (err) {
      console.error(err);

      escribirPantallaErrorPDF(
        ventana,
        "Ocurrió un problema al cargar las secciones del documento.",
      );
    }
  };

  //////////////////////////////////////////////////////

  const actualizarMargenLateral = async (nuevoMargen) => {
    if (readonlyParam || permiso === "lectura") return;

    const numero = Number(String(nuevoMargen).replace(",", "."));

    if (!Number.isFinite(numero) || numero < 0.5 || numero > 6) {
      alert("Ingresa un margen válido entre 0.5 y 6 cm.");
      return;
    }

    const margenNormalizado = Number(numero.toFixed(2));

    setDocumento((prev) => ({
      ...prev,
      margen_lateral_cm: margenNormalizado,
    }));

    try {
      const { error } = await supabase
        .from("documentos")
        .update({
          margen_lateral_cm: margenNormalizado,
          updated_at: new Date().toISOString(),
        })
        .eq("id", id);

      if (error) throw error;

      await logAccion("actualizar_margen_lateral", null, {
        margen_lateral_cm: margenNormalizado,
      });
    } catch (err) {
      console.error(err);
      alert("Error al guardar el margen lateral.");
    }
  };

  // Render condicionales
  if (loading)
    return <div className="p-8 text-center">Cargando documento...</div>;
  if (docError)
    return <div className="p-8 text-center text-red-600">{docError}</div>;

  if (isNew && mostrarSelectorPlantilla) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
        <div className="bg-white rounded-xl shadow-xl max-w-4xl w-full p-6">
          <h2 className="text-2xl font-bold text-gray-800">
            Crear nuevo documento
          </h2>
          <p className="text-gray-500 mb-6">Selecciona una plantilla</p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {plantillas.map((p) => (
              <div
                key={p.id}
                onClick={() => {
                  setMostrarSelectorPlantilla(false);
                  const tituloDoc = prompt(
                    "Ingrese el título del documento",
                    p.nombre,
                  );
                  if (tituloDoc?.trim())
                    crearDocumentoConPlantilla(p.id, tituloDoc);
                  else setMostrarSelectorPlantilla(true);
                }}
                className="border rounded-lg p-4 hover:shadow-md cursor-pointer"
              >
                <h3 className="font-semibold text-lg">{p.nombre}</h3>
                <p className="text-gray-500 text-sm">{p.descripcion}</p>
              </div>
            ))}
            <div
              onClick={() => {
                setMostrarSelectorPlantilla(false);
                const tituloDoc = prompt(
                  "Ingrese el título del documento",
                  "Documento vacío",
                );
                if (tituloDoc?.trim())
                  crearDocumentoConPlantilla(null, tituloDoc);
                else setMostrarSelectorPlantilla(true);
              }}
              className="border border-dashed rounded-lg p-4 hover:shadow-md cursor-pointer flex flex-col items-center justify-center"
            >
              <PlusIcon className="h-8 w-8 text-gray-500 mb-2" />
              <h3 className="font-semibold text-gray-700">Documento vacío</h3>
              <p className="text-gray-400 text-sm">
                Sin secciones predefinidas
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }
  if (isNew) return <div className="p-8 text-center">Creando documento...</div>;

  const soloLectura = readonlyParam || permiso === "lectura";
  const esRevisorSolo =
    !readonlyParam &&
    role === "revisor" &&
    permiso !== "dueño" &&
    permiso !== "escritura";
  const permisoTexto =
    permiso === "dueño"
      ? "Dueño"
      : permiso === "escritura"
        ? "Edición"
        : "Revisión";

  return (
    <div className="h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex flex-col overflow-hidden">
      {!readonlyParam && permiso !== "dueño" && (
        <div className="fixed top-20 right-4 z-20 bg-gray-800 text-white text-xs px-2 py-1 rounded-full shadow">
          Permiso: {permisoTexto}
        </div>
      )}

      <DocumentoHeader
        titulo={documento?.titulo || ""}
        onTituloChange={(tit) => setDocumento({ ...documento, titulo: tit })}
        onGuardarTitulo={guardarTituloDocumento}
        onGoBack={handleGoBackConLimpieza}
        autoSaveStatus={autoSaveStatus}
        permiso={permiso}
        readonlyParam={readonlyParam}
        role={role}
        onGuardarVersion={guardarVersionCompleta}
        onCargarVersiones={cargarVersiones}
        onExportPDF={generarPDF}
        onExportDOCX={exportarDocx}
        onCompartir={() => setShowShareModal(true)}
        onVerLogs={cargarLogsDocumento}
        onGuardarPlantilla={guardarComoPlantilla}
      />

      <div className="flex-1 flex overflow-hidden">
        <SeccionesSidebar
          secciones={secciones}
          seccionActiva={seccionActiva}
          permiso={permiso}
          readonlyParam={readonlyParam}
          onAgregarSeccion={() =>
            agregarSeccion(secciones, setSecciones, setSeccionActiva, null)
          }
          onAgregarSubseccion={(secPadre) =>
            agregarSeccion(
              secciones,
              setSecciones,
              setSeccionActiva,
              secPadre.id,
            )
          }
          onSeleccionarSeccion={cambiarSeccion}
          onEliminarSeccion={(sec) =>
            eliminarSeccion(
              sec,
              secciones,
              setSecciones,
              seccionActiva,
              setSeccionActiva,
            )
          }
          onDuplicarSeccion={(sec) =>
            duplicarSeccion(sec, secciones, setSecciones, setSeccionActiva)
          }
          onActualizarTitulo={(idSeccion, nuevo) =>
            actualizarTituloSeccion(idSeccion, nuevo)
          }
          editandoTituloSeccion={editandoTituloSeccion}
          setEditandoTituloSeccion={setEditandoTituloSeccion}
          nuevoTitulo={nuevoTitulo}
          setNuevoTitulo={setNuevoTitulo}
          onMarcarPendiente={handleTogglePendienteSidebar}
          onReorder={reordenarSecciones}
        />
        <div className="flex-1 p-6 bg-gray-100 flex justify-center overflow-hidden">
          {loadingContenido ? (
            <div className="bg-white rounded-lg shadow p-8 text-center text-gray-500 h-fit">
              Cargando contenido de la sección...
            </div>
          ) : (
            <EditorArea
              seccionActiva={seccionActiva}
              soloLectura={soloLectura}
              esRevisorSolo={esRevisorSolo}
              role={role}
              permiso={permiso}
              user={user}
              documentoId={id}
              margenLateralCm={margenLateralCm}
              onCambiarMargenLateral={actualizarMargenLateral}
              onAprobar={handleAprobar}
              onSolicitarCorrecciones={handleSolicitarCorrecciones}
              onMarcarPendiente={handleMarcarPendiente}
              onContentChange={handleContentChange}
              filePickerCallback={filePickerCallback}
            />
          )}
        </div>
        {seccionActiva && (
          <PanelAnexos
            seccionId={seccionActiva.id}
            permiso={permiso}
            documentoId={id}
          />
        )}
      </div>

      {/* Modales (Share, Versions, Logs, Guardar plantilla) - sin cambios, mismos que antes */}
      {showShareModal && (
        <ShareModal
          onClose={() => setShowShareModal(false)}
          titulo={documento?.titulo || "Documento"}
          searchEmail={searchEmail}
          setSearchEmail={setSearchEmail}
          searchResults={searchResults}
          onSelectUser={selectUser}
          newPermiso={newPermiso}
          setNewPermiso={setNewPermiso}
          onAddShare={handleAddShare}
          sharedUsers={sharedUsers}
          onShareChange={onChangePermiso}
          onRemoveShare={removeShare}
          loadingShare={loadingShare}
        />
      )}

      {showVersionsModal && (
        <VersionsModal
          onClose={() => setShowVersionsModal(false)}
          versiones={versiones}
          cargandoVersiones={cargandoVersiones}
          permiso={permiso}
          readonlyParam={readonlyParam}
          onRestaurar={restaurarVersion}
          onEliminar={eliminarVersion}
        />
      )}

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

      {showSaveTemplateModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex items-center justify-center min-h-screen p-4 text-center">
            <div
              className="fixed inset-0 bg-black bg-opacity-40 transition-opacity"
              onClick={() => setShowSaveTemplateModal(false)}
            ></div>
            <div className="relative bg-white rounded-2xl shadow-2xl max-w-md w-full p-6">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-xl font-semibold text-gray-900">
                  Guardar como plantilla
                </h3>
                <button
                  onClick={() => setShowSaveTemplateModal(false)}
                  className="text-gray-400 hover:text-gray-600 cursor-pointer"
                >
                  <XMarkIcon className="h-6 w-6" />
                </button>
              </div>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Nombre de la plantilla *
                  </label>
                  <input
                    type="text"
                    value={templateName}
                    onChange={(e) => setTemplateName(e.target.value)}
                    className="w-full border border-gray-300 rounded-xl p-2 focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Descripción (opcional)
                  </label>
                  <textarea
                    value={templateDescription}
                    onChange={(e) => setTemplateDescription(e.target.value)}
                    rows="2"
                    className="w-full border border-gray-300 rounded-xl p-2 focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div className="flex justify-end gap-2">
                  <button
                    onClick={() => setShowSaveTemplateModal(false)}
                    className="px-4 py-2 border border-gray-300 rounded-xl text-gray-700 hover:bg-gray-50 cursor-pointer"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={crearPlantillaDesdeDocumento}
                    disabled={savingTemplate}
                    className="px-4 py-2 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 disabled:opacity-50 cursor-pointer"
                  >
                    {savingTemplate ? "Guardando..." : "Guardar plantilla"}
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
