// src/features/documentos/hooks/useVersiones.js
import { useState } from "react";
import { supabase } from "../../../lib/supabase";
import { registrarLog } from "../../../lib/logs";

export const useVersiones = (
  documentoId,
  permiso,
  isNew,
  readonlyParam,
  secciones,
) => {
  const [showVersionsModal, setShowVersionsModal] = useState(false);
  const [versiones, setVersiones] = useState([]);
  const [cargandoVersiones, setCargandoVersiones] = useState(false);

  const logAccion = async (accion, detalle) => {
    if (!isNew && documentoId && !readonlyParam) {
      await registrarLog(documentoId, null, accion, detalle);
    }
  };

  const guardarVersion = async (seccionesCompletas = null) => {
    if (isNew || readonlyParam) {
      alert("No puedes guardar versiones en modo solo lectura.");
      return;
    }

    const comentario = prompt("Comentario opcional (puedes dejar vacío)");
    if (comentario === null) return;

    try {
      const seccionesFuente = seccionesCompletas || secciones;

      const { data: ultimaVersion } = await supabase
        .from("versiones")
        .select("numero")
        .eq("documento_id", documentoId)
        .order("numero", { ascending: false })
        .limit(1);

      const nuevoNumero = (ultimaVersion?.[0]?.numero || 0) + 1;

      const { data: version, error: versionError } = await supabase
        .from("versiones")
        .insert({
          documento_id: documentoId,
          numero: nuevoNumero,
          comentario: comentario || null,
          creada_por: (await supabase.auth.getUser()).data.user?.id,
        })
        .select()
        .single();

      if (versionError) throw versionError;

      const seccionesVersion = seccionesFuente.map((sec, idx) => ({
        version_id: version.id,
        titulo: sec.titulo,
        contenido: sec.contenido || "",
        orden: idx,
      }));

      await supabase.from("secciones_version").insert(seccionesVersion);

      await logAccion("guardar_version", {
        numero: nuevoNumero,
        comentario,
      });

      alert(`Versión ${nuevoNumero} guardada.`);
    } catch (err) {
      console.error(err);
      alert("Error al guardar versión");
    }
  };

  const cargarVersiones = async () => {
    setCargandoVersiones(true);
    const { data, error } = await supabase
      .from("versiones")
      .select("id, numero, comentario, created_at, creada_por")
      .eq("documento_id", documentoId)
      .order("numero", { ascending: false });
    if (!error) setVersiones(data || []);
    setCargandoVersiones(false);
    setShowVersionsModal(true);
  };

  const restaurarVersion = async (versionId) => {
    if (readonlyParam) {
      alert("No puedes restaurar versiones en modo solo lectura.");
      return;
    }
    if (
      !confirm(
        "Restaurar esta versión reemplazará todo el contenido actual. ¿Continuar?",
      )
    )
      return;
    try {
      const { data: seccionesVersion } = await supabase
        .from("secciones_version")
        .select("*")
        .eq("version_id", versionId)
        .order("orden", { ascending: true });
      if (!seccionesVersion?.length)
        throw new Error("La versión no contiene secciones");
      await supabase.from("secciones").delete().eq("documento_id", documentoId);
      const nuevasSecciones = seccionesVersion.map((sv, idx) => ({
        documento_id: documentoId,
        titulo: sv.titulo,
        contenido: sv.contenido,
        orden: idx,
      }));
      await supabase.from("secciones").insert(nuevasSecciones);
      await logAccion("restaurar_version", { version_id: versionId });
      window.location.reload();
    } catch (err) {
      console.error(err);
      alert("Error al restaurar");
    }
  };

  const eliminarVersion = async (versionId, numeroVersion) => {
    if (readonlyParam || permiso !== "dueño") {
      alert("No tienes permisos para eliminar versiones.");
      return;
    }
    if (!confirm(`¿Eliminar versión ${numeroVersion}?`)) return;
    await supabase
      .from("secciones_version")
      .delete()
      .eq("version_id", versionId);
    await supabase.from("versiones").delete().eq("id", versionId);
    await cargarVersiones();
    alert(`Versión ${numeroVersion} eliminada.`);
  };

  return {
    showVersionsModal,
    setShowVersionsModal,
    versiones,
    cargandoVersiones,
    guardarVersion,
    cargarVersiones,
    restaurarVersion,
    eliminarVersion,
  };
};
