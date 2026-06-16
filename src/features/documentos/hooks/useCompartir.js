// src/features/documentos/hooks/useCompartir.js
import { useState, useCallback, useEffect, useRef } from "react";
import { supabase } from "../../../lib/supabase";
import { registrarLog } from "../../../lib/logs";

export const useCompartir = (documentoId, permiso, isNew, readonlyParam) => {
  const [showShareModal, setShowShareModal] = useState(false);
  const [sharedUsers, setSharedUsers] = useState([]);
  const [searchEmail, setSearchEmail] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [newPermiso, setNewPermiso] = useState("lectura");
  const [loadingShare, setLoadingShare] = useState(false);

  const debounceTimer = useRef(null);

  const logAccion = async (accion, detalle) => {
    if (!isNew && documentoId && !readonlyParam) {
      await registrarLog(documentoId, null, accion, detalle);
    }
  };

  const loadSharedUsers = useCallback(async () => {
    if (isNew || permiso !== "dueño" || readonlyParam) return;
    try {
      const { data: shares, error } = await supabase
        .from("compartidos")
        .select("usuario_id, permiso")
        .eq("documento_id", documentoId);
      if (error) throw error;
      if (!shares || shares.length === 0) {
        setSharedUsers([]);
        return;
      }

      const userIds = shares.map((s) => s.usuario_id);
      const token = (await supabase.auth.getSession()).data.session
        ?.access_token;
      let usersMap = new Map();

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
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
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

      const formatted = shares.map((share) => {
        const info = usersMap.get(share.usuario_id);
        return {
          usuario_id: share.usuario_id,
          permiso: share.permiso,
          info: info || { email: share.usuario_id, nombre: "", apellido: "" },
        };
      });
      setSharedUsers(formatted);
    } catch (err) {
      console.error("Error en loadSharedUsers:", err);
      setSharedUsers([]);
    }
  }, [documentoId, isNew, permiso, readonlyParam]);

  useEffect(() => {
    if (!isNew && permiso === "dueño" && !readonlyParam) {
      loadSharedUsers();
    }
  }, [isNew, permiso, readonlyParam, loadSharedUsers]);

  // 🔥 searchUsers memoizado con useCallback
  const searchUsers = useCallback(async (query) => {
    if (query.length < 3) {
      setSearchResults([]);
      return;
    }
    const token = (await supabase.auth.getSession()).data.session?.access_token;
    try {
      const res = await fetch(
        `https://fcjrqdmdwfkzqoygioes.supabase.co/functions/v1/buscar-usuarios?email=${encodeURIComponent(query)}`,
        { headers: { Authorization: `Bearer ${token}` } },
      );
      const data = await res.json();
      if (data.users) {
        setSearchResults(data.users);
      } else {
        setSearchResults([]);
      }
    } catch (err) {
      console.error(err);
      setSearchResults([]);
    }
  }, []); // Sin dependencias, se crea una sola vez

  const buscarUsuarioPorEmail = useCallback(async (email) => {
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

      const usuarios = data.users || [];

      return (
        usuarios.find((u) => u.email?.trim().toLowerCase() === emailLimpio) ||
        null
      );
    } catch (err) {
      console.error("Error en buscarUsuarioPorEmail:", err);
      return null;
    }
  }, []);

  // 🔥 Efecto de autocompletado dentro del hook
  useEffect(() => {
    if (debounceTimer.current) clearTimeout(debounceTimer.current);
    if (searchEmail && searchEmail.length >= 2) {
      debounceTimer.current = setTimeout(() => {
        searchUsers(searchEmail);
      }, 400);
    } else if (searchEmail.length === 0) {
      setSearchResults([]);
    }
    return () => {
      if (debounceTimer.current) clearTimeout(debounceTimer.current);
    };
  }, [searchEmail, searchUsers]);

  const handleShare = async (usuarioId, permisoSeleccionado) => {
    if (!documentoId || readonlyParam) return;
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
            documentoId,
            usuarioId,
            permiso: permisoSeleccionado,
          }),
        },
      );
      if (res.ok) {
        await loadSharedUsers();
        setSearchEmail("");
        setSearchResults([]);
        alert("Documento compartido correctamente");
        await logAccion("compartir_documento", {
          usuario_compartido: usuarioId,
          permiso: permisoSeleccionado,
        });
      } else {
        const err = await res.json();
        alert(err.error || "Error al compartir");
      }
    } catch (err) {
      alert("Error de red al compartir");
    } finally {
      setLoadingShare(false);
    }
  };

  const removeShare = async (usuarioId) => {
    if (!documentoId || readonlyParam) return;
    if (!confirm("¿Revocar acceso?")) return;
    try {
      await supabase
        .from("compartidos")
        .delete()
        .eq("documento_id", documentoId)
        .eq("usuario_id", usuarioId);
      await loadSharedUsers();
      alert("Acceso revocado");
      await logAccion("revocar_acceso", { usuario_revocado: usuarioId });
    } catch (err) {
      alert("Error al revocar acceso");
    }
  };

  const onChangePermiso = async (usuarioId, nuevoPermiso) => {
    if (!documentoId || readonlyParam) return;
    try {
      const { error } = await supabase
        .from("compartidos")
        .update({ permiso: nuevoPermiso })
        .eq("documento_id", documentoId)
        .eq("usuario_id", usuarioId);
      if (error) throw error;
      await loadSharedUsers();
      alert("Permiso actualizado");
      await logAccion("cambiar_permiso", {
        usuario: usuarioId,
        nuevo_permiso: nuevoPermiso,
      });
    } catch (err) {
      alert("Error al actualizar permiso");
    }
  };

  return {
    showShareModal,
    setShowShareModal,
    sharedUsers,
    searchEmail,
    setSearchEmail,
    searchResults,
    setSearchResults,
    newPermiso,
    setNewPermiso,
    loadingShare,
    searchUsers,
    buscarUsuarioPorEmail,
    handleShare,
    removeShare,
    onChangePermiso,
  };
};
