// src/features/documentos/hooks/useSecciones.js
import { useState } from "react";
import { supabase } from "../../../lib/supabase";
import { registrarLog } from "../../../lib/logs";

export const useSecciones = (
  documentoId,
  permiso,
  role,
  isNew,
  readonlyParam,
  setSecciones,
  setSeccionActiva,
  setLastSavedContent,
  seccionActiva,
) => {
  const [editandoTituloSeccion, setEditandoTituloSeccion] = useState(null);
  const [nuevoTitulo, setNuevoTitulo] = useState("");
  const [guardandoTitulo, setGuardandoTitulo] = useState(false);

  const logAccion = async (accion, seccionId, detalle) => {
    if (!isNew && documentoId && !readonlyParam) {
      await registrarLog(documentoId, seccionId, accion, detalle);
    }
  };

  const normalizarParentId = (parentId) => parentId || null;

  const obtenerIdsDescendientes = (seccionId, secciones) => {
    const idsParaEliminar = new Set([seccionId]);
    let huboCambios = true;

    while (huboCambios) {
      huboCambios = false;

      secciones.forEach((sec) => {
        if (
          sec.parent_id &&
          idsParaEliminar.has(sec.parent_id) &&
          !idsParaEliminar.has(sec.id)
        ) {
          idsParaEliminar.add(sec.id);
          huboCambios = true;
        }
      });
    }

    return idsParaEliminar;
  };

  // Función genérica para cambiar estado de revisión
  const actualizarEstadoRevision = async (seccionId, nuevoEstado) => {
    if (readonlyParam) return;
    const esEditor =
      !readonlyParam && (permiso === "dueño" || permiso === "escritura");
    const esRevisor = role === "revisor";
    if (nuevoEstado === "pendiente" && !esEditor) return;
    if (nuevoEstado === null && !esEditor) return;
    if (
      (nuevoEstado === "correcciones" || nuevoEstado === "aprobado") &&
      !esRevisor
    )
      return;

    try {
      const updateData = {
        estado_revision: nuevoEstado,
        aprobado_revisor: nuevoEstado === "aprobado",
        updated_at: new Date().toISOString(),
      };
      await supabase.from("secciones").update(updateData).eq("id", seccionId);
      setSecciones((prev) =>
        prev.map((s) => (s.id === seccionId ? { ...s, ...updateData } : s)),
      );
      if (seccionActiva && seccionActiva.id === seccionId) {
        setSeccionActiva((prev) => ({ ...prev, ...updateData }));
      }
      await logAccion(`cambiar_estado_revision_${nuevoEstado}`, seccionId, {
        estado: nuevoEstado,
      });
    } catch (err) {
      console.error(err);
    }
  };

  const marcarPendiente = (seccionId) =>
    actualizarEstadoRevision(seccionId, "pendiente");
  const desmarcarPendiente = (seccionId) =>
    actualizarEstadoRevision(seccionId, null);
  const marcarCorrecciones = (seccionId) =>
    actualizarEstadoRevision(seccionId, "correcciones");
  const aprobarSeccion = (seccionId) =>
    actualizarEstadoRevision(seccionId, "aprobado");

  // Funciones CRUD existentes
  const agregarSeccion = async (
    secciones,
    setSecciones,
    setSeccionActiva,
    parentId = null,
  ) => {
    if (readonlyParam || (permiso !== "dueño" && permiso !== "escritura"))
      return;

    const padre = parentId ? secciones.find((s) => s.id === parentId) : null;

    const hermanas = secciones.filter(
      (s) => (s.parent_id || null) === (parentId || null),
    );

    const nuevoOrden = hermanas.length;
    const nuevoNivel = padre ? (padre.nivel ?? 0) + 1 : 0;
    const tituloTemp = padre
      ? `Subsección ${nuevoOrden + 1}`
      : `Sección ${nuevoOrden + 1}`;

    const { data, error } = await supabase
      .from("secciones")
      .insert({
        documento_id: documentoId,
        titulo: tituloTemp,
        contenido: "",
        orden: nuevoOrden,
        parent_id: parentId,
        nivel: nuevoNivel,
        estado_revision: null,
        aprobado_revisor: false,
      })
      .select()
      .single();

    if (error) return;

    setSecciones([...secciones, data]);
    setSeccionActiva(data);
    setLastSavedContent("");

    await logAccion("crear_seccion", data.id, {
      titulo: tituloTemp,
      parent_id: parentId,
      nivel: nuevoNivel,
    });
  };

  //////////////////////////////////////////////

  const eliminarSeccion = async (
    seccion,
    secciones,
    setSecciones,
    seccionActiva,
    setSeccionActiva,
  ) => {
    if (readonlyParam || permiso !== "dueño") return;

    const idsParaEliminar = obtenerIdsDescendientes(seccion.id, secciones);
    const idsArray = Array.from(idsParaEliminar);
    const cantidadSubsecciones = idsArray.length - 1;

    const mensaje =
      cantidadSubsecciones > 0
        ? `¿Eliminar la sección "${seccion.titulo}" y sus ${cantidadSubsecciones} subsección(es)?`
        : `¿Eliminar la sección "${seccion.titulo}"?`;

    if (!confirm(mensaje)) return;

    try {
      await logAccion("eliminar_seccion", seccion.id, {
        titulo: seccion.titulo,
        secciones_eliminadas: idsArray,
      });

      const { data: anexosSecciones } = await supabase
        .from("anexos")
        .select("url")
        .in("seccion_id", idsArray);

      if (anexosSecciones?.length) {
        const paths = anexosSecciones
          .map((anexo) => anexo.url.split("/public/anexos/")[1])
          .filter(Boolean);

        if (paths.length > 0) {
          await supabase.storage.from("anexos").remove(paths);
        }

        await supabase.from("anexos").delete().in("seccion_id", idsArray);
      }

      const { error } = await supabase
        .from("secciones")
        .delete()
        .in("id", idsArray);

      if (error) throw error;

      let nuevas = secciones.filter((s) => !idsParaEliminar.has(s.id));

      const parentEliminado = normalizarParentId(seccion.parent_id);

      const hermanas = nuevas
        .filter((s) => normalizarParentId(s.parent_id) === parentEliminado)
        .sort((a, b) => (a.orden ?? 0) - (b.orden ?? 0));

      const hermanasReordenadas = hermanas.map((s, index) => ({
        ...s,
        orden: index,
      }));

      nuevas = nuevas.map((sec) => {
        const actualizada = hermanasReordenadas.find((h) => h.id === sec.id);
        return actualizada || sec;
      });

      setSecciones(nuevas);

      const seccionActivaFueEliminada =
        seccionActiva && idsParaEliminar.has(seccionActiva.id);

      if (seccionActivaFueEliminada) {
        const nuevaActiva =
          nuevas.find(
            (s) => normalizarParentId(s.parent_id) === parentEliminado,
          ) ||
          nuevas[0] ||
          null;

        setSeccionActiva(nuevaActiva);
        setLastSavedContent(nuevaActiva?.contenido || "");
      }

      for (const hermana of hermanasReordenadas) {
        await supabase
          .from("secciones")
          .update({
            orden: hermana.orden,
            updated_at: new Date().toISOString(),
          })
          .eq("id", hermana.id);
      }
    } catch (err) {
      console.error(err);
      alert("Error al eliminar la sección.");
    }
  };

  ///////////////////////////////////////////

  const duplicarSeccion = async (
    seccion,
    secciones,
    setSecciones,
    setSeccionActiva,
  ) => {
    if (readonlyParam || (permiso !== "dueño" && permiso !== "escritura"))
      return;
    if (!seccion?.id || !documentoId) return;

    const normalizarParentId = (parentId) => parentId || null;

    const mapaSecciones = new Map(secciones.map((s) => [s.id, s]));

    const calcularNivel = (sec) => {
      let nivel = 0;
      let parentId = normalizarParentId(sec.parent_id);

      while (parentId && mapaSecciones.has(parentId)) {
        nivel += 1;
        parentId = normalizarParentId(mapaSecciones.get(parentId)?.parent_id);
      }

      return nivel;
    };

    const obtenerArbolOrdenado = (seccionRaiz) => {
      const resultado = [];

      const recorrer = (sec) => {
        resultado.push(sec);

        const hijos = secciones
          .filter((s) => normalizarParentId(s.parent_id) === sec.id)
          .sort((a, b) => (a.orden ?? 0) - (b.orden ?? 0));

        hijos.forEach(recorrer);
      };

      recorrer(seccionRaiz);

      return resultado;
    };

    try {
      const arbolOriginal = obtenerArbolOrdenado(seccion);
      const idsOriginales = arbolOriginal.map((s) => s.id);

      const { data: seccionesCompletas, error: fetchError } = await supabase
        .from("secciones")
        .select(
          "id, titulo, contenido, orden, parent_id, nivel, aprobado_revisor, estado_revision",
        )
        .in("id", idsOriginales);

      if (fetchError) throw fetchError;

      const completasMap = new Map(
        (seccionesCompletas || []).map((s) => [s.id, s]),
      );

      const seccionesOrdenadasCompletas = arbolOriginal.map((sec) => {
        const completa = completasMap.get(sec.id) || sec;

        return {
          ...sec,
          ...completa,
          contenido:
            seccionActiva?.id === sec.id
              ? seccionActiva.contenido || ""
              : completa.contenido || "",
        };
      });

      const parentRaiz = normalizarParentId(seccion.parent_id);
      const ordenOriginal = seccion.orden ?? 0;
      const nuevoOrdenRaiz = ordenOriginal + 1;

      const hermanasPosteriores = secciones.filter(
        (s) =>
          normalizarParentId(s.parent_id) === parentRaiz &&
          (s.orden ?? 0) >= nuevoOrdenRaiz,
      );

      for (const hermana of hermanasPosteriores) {
        await supabase
          .from("secciones")
          .update({
            orden: (hermana.orden ?? 0) + 1,
            updated_at: new Date().toISOString(),
          })
          .eq("id", hermana.id);
      }

      const idOriginalANuevo = new Map();
      const nuevasSecciones = [];

      for (const secOriginal of seccionesOrdenadasCompletas) {
        const esRaizDuplicada = secOriginal.id === seccion.id;

        const nuevoParentId = esRaizDuplicada
          ? parentRaiz
          : idOriginalANuevo.get(secOriginal.parent_id) || null;

        const nuevoTitulo = esRaizDuplicada
          ? `${secOriginal.titulo} (copia)`
          : secOriginal.titulo;

        const { data: nuevaSeccion, error: insertError } = await supabase
          .from("secciones")
          .insert({
            documento_id: documentoId,
            titulo: nuevoTitulo,
            contenido: secOriginal.contenido || "",
            orden: esRaizDuplicada ? nuevoOrdenRaiz : (secOriginal.orden ?? 0),
            parent_id: nuevoParentId,
            nivel: calcularNivel(secOriginal),
            estado_revision: null,
            aprobado_revisor: false,
          })
          .select()
          .single();

        if (insertError) throw insertError;

        idOriginalANuevo.set(secOriginal.id, nuevaSeccion.id);
        nuevasSecciones.push({
          ...nuevaSeccion,
          contenidoCargado: true,
        });
      }

      const seccionesActualizadas = secciones.map((sec) => {
        const esHermanaPosterior = hermanasPosteriores.some(
          (h) => h.id === sec.id,
        );

        if (!esHermanaPosterior) return sec;

        return {
          ...sec,
          orden: (sec.orden ?? 0) + 1,
        };
      });

      const resultado = [...seccionesActualizadas, ...nuevasSecciones];

      setSecciones(resultado);

      const nuevaRaiz = nuevasSecciones[0] || null;

      if (nuevaRaiz) {
        setSeccionActiva(nuevaRaiz);
        setLastSavedContent(nuevaRaiz.contenido || "");
      }

      await logAccion("duplicar_seccion", nuevaRaiz?.id || null, {
        seccion_original: seccion.id,
        titulo_original: seccion.titulo,
        secciones_duplicadas: nuevasSecciones.map((s) => s.id),
      });
    } catch (err) {
      console.error(err);
      alert("Error al duplicar la sección.");
    }
  };

  ///////////////////////////////////////////

  const actualizarTituloSeccion = async (seccionId, nuevoTitulo) => {
    if (!nuevoTitulo.trim() || readonlyParam) return;
    setGuardandoTitulo(true);
    try {
      await supabase
        .from("secciones")
        .update({ titulo: nuevoTitulo, updated_at: new Date().toISOString() })
        .eq("id", seccionId);
      setSecciones((prev) =>
        prev.map((s) =>
          s.id === seccionId ? { ...s, titulo: nuevoTitulo } : s,
        ),
      );
      setSeccionActiva((prev) =>
        prev?.id === seccionId ? { ...prev, titulo: nuevoTitulo } : prev,
      );
      await logAccion("renombrar_seccion", seccionId, { nuevo: nuevoTitulo });
    } finally {
      setGuardandoTitulo(false);
    }
  };

  const guardarContenidoSeccion = async (
    seccion,
    nuevoContenido,
    auto = false,
  ) => {
    if (readonlyParam) return;
    if (auto && permiso !== "dueño" && permiso !== "escritura") return;
    try {
      await supabase
        .from("secciones")
        .update({
          contenido: nuevoContenido,
          updated_at: new Date().toISOString(),
        })
        .eq("id", seccion.id);
      setSecciones((prev) =>
        prev.map((s) =>
          s.id === seccion.id ? { ...s, contenido: nuevoContenido } : s,
        ),
      );
      setSeccionActiva((prev) =>
        prev?.id === seccion.id ? { ...prev, contenido: nuevoContenido } : prev,
      );
      setLastSavedContent(nuevoContenido);
    } catch (err) {
      console.error(err);
    }
  };

  return {
    editandoTituloSeccion,
    setEditandoTituloSeccion,
    nuevoTitulo,
    setNuevoTitulo,
    guardandoTitulo,
    agregarSeccion,
    eliminarSeccion,
    duplicarSeccion,
    actualizarTituloSeccion,
    guardarContenidoSeccion,
    marcarPendiente,
    desmarcarPendiente,
    marcarCorrecciones,
    aprobarSeccion,
  };
};
