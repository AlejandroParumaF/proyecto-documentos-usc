// src/lib/logs.js
import { supabase } from "./supabase";

export const registrarLog = async (
  documentoId,
  seccionId,
  accion,
  detalle = {},
) => {
  try {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    const usuarioId = session?.user?.id;
    if (!usuarioId) {
      console.warn("No se pudo registrar log: usuario no autenticado");
      return;
    }

    // Inserción directa
    const { error } = await supabase.from("logs").insert({
      documento_id: documentoId,
      seccion_id: seccionId || null,
      usuario_id: usuarioId,
      accion,
      detalle: detalle || {},
    });

    if (error) {
      console.error("Error al insertar log:", error);
    } else {
      console.log("Log registrado:", accion, "Documento:", documentoId);
    }
  } catch (error) {
    console.error("Error inesperado al registrar log:", error);
  }
};
