// src/features/documentos/hooks/useAutoguardado.js
import { useState, useRef, useCallback, useEffect } from "react";
import { supabase } from "../../../lib/supabase";

export const useAutoguardado = (
  documentoId,
  permiso,
  isNew,
  readonlyParam,
  seccionActiva,
  setSecciones,
  setSeccionActiva,
  lastSavedContent,
  setLastSavedContent,
) => {
  const [autoSaveStatus, setAutoSaveStatus] = useState("");

  const autoSaveTimerRef = useRef(null);
  const latestContentRef = useRef("");
  const latestSectionIdRef = useRef(null);
  const saveVersionRef = useRef(0);

  useEffect(() => {
    latestContentRef.current = seccionActiva?.contenido || "";
    latestSectionIdRef.current = seccionActiva?.id || null;
  }, [seccionActiva?.id, seccionActiva?.contenido]);

  const guardarContenidoSeccion = useCallback(
    async (seccion, nuevoContenido, auto = false) => {
      if (readonlyParam) return;
      if (!seccion?.id) return;
      if (auto && permiso !== "dueño" && permiso !== "escritura") return;
      if (auto && nuevoContenido === lastSavedContent) return;

      const saveVersion = ++saveVersionRef.current;

      if (auto) {
        setAutoSaveStatus("saving");
      }

      try {
        const { error } = await supabase
          .from("secciones")
          .update({
            contenido: nuevoContenido,
            updated_at: new Date().toISOString(),
          })
          .eq("id", seccion.id);

        if (error) throw error;

        const sigueSiendoLaSeccionActiva =
          latestSectionIdRef.current === seccion.id;

        const contenidoActualEnEditor = latestContentRef.current;

        const esteGuardadoSigueVigente = saveVersion === saveVersionRef.current;

        setSecciones((prev) =>
          prev.map((s) =>
            s.id === seccion.id
              ? {
                  ...s,
                  contenido:
                    sigueSiendoLaSeccionActiva &&
                    contenidoActualEnEditor !== nuevoContenido
                      ? contenidoActualEnEditor
                      : nuevoContenido,
                  contenidoCargado: true,
                }
              : s,
          ),
        );

        setSeccionActiva((prev) => {
          if (!prev || prev.id !== seccion.id) return prev;

          // Esta es la parte clave:
          // si el usuario ya escribió algo nuevo mientras el guardado estaba en curso,
          // NO volvemos a pintar el contenido viejo.
          if (contenidoActualEnEditor !== nuevoContenido) {
            return {
              ...prev,
              contenido: contenidoActualEnEditor,
              contenidoCargado: true,
            };
          }

          return {
            ...prev,
            contenido: nuevoContenido,
            contenidoCargado: true,
          };
        });

        if (
          sigueSiendoLaSeccionActiva &&
          contenidoActualEnEditor === nuevoContenido
        ) {
          setLastSavedContent(nuevoContenido);
        }

        if (auto && esteGuardadoSigueVigente) {
          setAutoSaveStatus("saved");
          setTimeout(() => setAutoSaveStatus(""), 1500);
        }
      } catch (err) {
        console.error(err);

        if (auto) {
          setAutoSaveStatus("error");
          setTimeout(() => setAutoSaveStatus(""), 2000);
        }
      }
    },
    [
      permiso,
      readonlyParam,
      lastSavedContent,
      setSecciones,
      setSeccionActiva,
      setLastSavedContent,
    ],
  );

  const handleContentChange = useCallback(
    (newContent) => {
      if (
        !seccionActiva ||
        readonlyParam ||
        (permiso !== "dueño" && permiso !== "escritura")
      ) {
        return;
      }

      latestContentRef.current = newContent;
      latestSectionIdRef.current = seccionActiva.id;

      setSeccionActiva((prev) => {
        if (!prev || prev.id !== seccionActiva.id) return prev;

        return {
          ...prev,
          contenido: newContent,
          contenidoCargado: true,
        };
      });

      setSecciones((prev) =>
        prev.map((s) =>
          s.id === seccionActiva.id
            ? {
                ...s,
                contenido: newContent,
                contenidoCargado: true,
              }
            : s,
        ),
      );

      if (autoSaveTimerRef.current) {
        clearTimeout(autoSaveTimerRef.current);
      }

      const seccionParaGuardar = {
        ...seccionActiva,
        contenido: newContent,
      };

      autoSaveTimerRef.current = setTimeout(() => {
        guardarContenidoSeccion(seccionParaGuardar, newContent, true);
      }, 2000);
    },
    [
      seccionActiva,
      permiso,
      readonlyParam,
      guardarContenidoSeccion,
      setSecciones,
    ],
  );

  const cleanup = useCallback(() => {
    if (autoSaveTimerRef.current) {
      clearTimeout(autoSaveTimerRef.current);
    }
  }, []);

  return {
    autoSaveStatus,
    guardarContenidoSeccion,
    handleContentChange,
    cleanup,
  };
};
