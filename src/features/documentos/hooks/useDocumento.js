// src/features/documentos/hooks/useDocumento.js
import { useState, useEffect, useRef, useCallback } from "react";
import { supabase } from "../../../lib/supabase";

export const useDocumento = (id, user, readonlyParam) => {
  const [documento, setDocumento] = useState(null);
  const [secciones, setSecciones] = useState([]);
  const [seccionActiva, setSeccionActiva] = useState(null);
  const [permiso, setPermiso] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadingContenido, setLoadingContenido] = useState(false);
  const [error, setError] = useState("");

  const isNew = id === "nuevo";
  const userId = user?.id;
  const documentoCargadoRef = useRef(null);

  const cargarContenidoSeccion = useCallback(async (seccion) => {
    if (!seccion?.id) return null;

    if (seccion.contenido !== undefined && seccion.contenidoCargado) {
      return seccion;
    }

    setLoadingContenido(true);

    try {
      const { data, error } = await supabase
        .from("secciones")
        .select("contenido")
        .eq("id", seccion.id)
        .single();

      if (error) throw error;

      const seccionConContenido = {
        ...seccion,
        contenido: data?.contenido || "",
        contenidoCargado: true,
      };

      setSecciones((prev) =>
        prev.map((s) =>
          s.id === seccion.id
            ? {
                ...s,
                contenido: seccionConContenido.contenido,
                contenidoCargado: true,
              }
            : s,
        ),
      );

      return seccionConContenido;
    } catch (err) {
      console.error("Error cargando contenido de sección:", err);
      return {
        ...seccion,
        contenido: "",
        contenidoCargado: true,
      };
    } finally {
      setLoadingContenido(false);
    }
  }, []);

  const cargarTodasLasSeccionesConContenido = useCallback(async () => {
    if (!id || isNew) return [];

    const { data, error } = await supabase
      .from("secciones")
      .select(
        "id, titulo, contenido, orden, parent_id, nivel, aprobado_revisor, estado_revision",
      )
      .eq("documento_id", id)
      .order("orden", { ascending: true });

    if (error) throw error;

    const seccionesCompletas = (data || []).map((sec) => ({
      ...sec,
      contenido: sec.contenido || "",
      contenidoCargado: true,
    }));

    setSecciones(seccionesCompletas);

    setSeccionActiva((prev) => {
      if (!prev) return seccionesCompletas[0] || null;
      return seccionesCompletas.find((sec) => sec.id === prev.id) || prev;
    });

    return seccionesCompletas;
  }, [id, isNew]);

  useEffect(() => {
    if (!userId) return;

    if (isNew) {
      setPermiso("dueño");
      setDocumento({ titulo: "", usuario_id: userId });
      setSecciones([]);
      setSeccionActiva(null);
      setLoading(false);
      return;
    }

    const claveCarga = `${id}_${userId}_${readonlyParam ? "readonly" : "edit"}`;

    if (documentoCargadoRef.current === claveCarga) {
      return;
    }

    let cancelado = false;

    const fetchData = async () => {
      setLoading(true);
      setError("");

      try {
        const { data: doc, error: docError } = await supabase
          .from("documentos")
          .select("*")
          .eq("id", id)
          .single();

        if (docError) throw docError;
        if (!doc) throw new Error("Documento no encontrado");

        let permisoCalculado = null;

        if (readonlyParam) {
          permisoCalculado = "lectura";
        } else if (doc.usuario_id === userId) {
          permisoCalculado = "dueño";
        } else {
          const { data: shareData } = await supabase
            .from("compartidos")
            .select("permiso")
            .eq("documento_id", id)
            .eq("usuario_id", userId)
            .single();

          if (!shareData) throw new Error("No tienes acceso a este documento");

          permisoCalculado = shareData.permiso;
        }

        const { data: secc, error: secError } = await supabase
          .from("secciones")
          .select(
            "id, titulo, orden, parent_id, nivel, aprobado_revisor, estado_revision",
          )
          .eq("documento_id", id)
          .order("orden", { ascending: true });

        if (secError) throw secError;
        if (cancelado) return;

        const seccionesBase = (secc || []).map((sec) => ({
          ...sec,
          contenido: undefined,
          contenidoCargado: false,
        }));

        setDocumento(doc);
        setPermiso(permisoCalculado);
        setSecciones(seccionesBase);

        const ultimaSeccionId = sessionStorage.getItem(`seccion_activa_${id}`);

        const seccionInicial =
          seccionesBase.find((sec) => sec.id === ultimaSeccionId) ||
          seccionesBase[0] ||
          null;

        if (seccionInicial) {
          const seccionConContenido =
            await cargarContenidoSeccion(seccionInicial);

          if (!cancelado) {
            setSeccionActiva(seccionConContenido);
          }
        } else {
          setSeccionActiva(null);
        }

        documentoCargadoRef.current = claveCarga;
      } catch (err) {
        if (!cancelado) {
          setError(err.message);
        }
      } finally {
        if (!cancelado) {
          setLoading(false);
        }
      }
    };

    fetchData();

    return () => {
      cancelado = true;
    };
  }, [id, userId, readonlyParam, isNew, cargarContenidoSeccion]);

  return {
    documento,
    setDocumento,
    secciones,
    setSecciones,
    seccionActiva,
    setSeccionActiva,
    permiso,
    loading,
    loadingContenido,
    error,
    isNew,
    cargarContenidoSeccion,
    cargarTodasLasSeccionesConContenido,
  };
};
