// src/hooks/useProgramas.js
import { useState, useEffect } from "react";
import { supabase } from "../lib/supabase";

export const useProgramas = (usuarioId) => {
  const [programas, setProgramas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const cargarProgramas = async () => {
    if (!usuarioId) return;
    setLoading(true);
    const { data, error } = await supabase
      .from("programas")
      .select("id, nombre, created_at, updated_at")
      .eq("usuario_id", usuarioId)
      .order("created_at", { ascending: false });
    if (error) {
      setError(error.message);
    } else {
      setProgramas(data || []);
    }
    setLoading(false);
  };

  const crearPrograma = async (nombre) => {
    if (!nombre.trim()) throw new Error("El nombre es obligatorio");
    // Insertar programa
    const { data: programa, error: progError } = await supabase
      .from("programas")
      .insert({ nombre: nombre.trim(), usuario_id: usuarioId })
      .select()
      .single();
    if (progError) throw progError;
    // Crear documento maestro asociado
    const { error: docError } = await supabase.from("documentos").insert({
      titulo: `Documento maestro: ${nombre}`,
      usuario_id: usuarioId,
      programa_id: programa.id,
      tipo_documento: "maestro",
    });
    if (docError) throw docError;
    await cargarProgramas();
    return programa;
  };

  const eliminarPrograma = async (programaId) => {
    const { error } = await supabase
      .from("programas")
      .delete()
      .eq("id", programaId)
      .eq("usuario_id", usuarioId);
    if (error) throw error;
    await cargarProgramas();
  };

  useEffect(() => {
    cargarProgramas();
  }, [usuarioId]);

  return {
    programas,
    loading,
    error,
    crearPrograma,
    eliminarPrograma,
    recargar: cargarProgramas,
  };
};
