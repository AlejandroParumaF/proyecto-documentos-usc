// src/components/PanelComentarios.jsx
import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import {
  ChatBubbleLeftRightIcon,
  XMarkIcon,
  CheckCircleIcon,
  UserCircleIcon,
} from "@heroicons/react/24/outline";

export const PanelComentarios = ({
  seccionId,
  documentoId,
  permiso,
  usuario,
  userRole,
}) => {
  const [comentarios, setComentarios] = useState([]);
  const [cargando, setCargando] = useState(false);
  const [nuevoComentario, setNuevoComentario] = useState("");
  const [enviando, setEnviando] = useState(false);
  // Mapa para almacenar nombres de usuarios (id -> nombre)
  const [userNames, setUserNames] = useState(new Map());

  const puedeComentar = userRole === "revisor";
  const puedeResolverYEliminar = userRole === "revisor";

  const cargarComentarios = async () => {
    if (!seccionId) return;
    setCargando(true);
    try {
      // Obtener comentarios con el usuario_id
      const { data, error } = await supabase
        .from("comentarios")
        .select(`id, texto, created_at, resuelto, usuario_id`)
        .eq("seccion_id", seccionId)
        .order("created_at", { ascending: true });
      if (error) throw error;

      // Obtener nombres de los usuarios (ids únicos)
      const userIds = [...new Set(data.map((c) => c.usuario_id))];
      if (userIds.length > 0) {
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
          const newMap = new Map();
          result.users.forEach((u) => {
            newMap.set(u.id, `${u.nombre} ${u.apellido}`.trim() || u.email);
          });
          setUserNames(newMap);
        }
      }
      setComentarios(data || []);
    } catch (err) {
      console.error("Error cargando comentarios:", err);
    } finally {
      setCargando(false);
    }
  };

  useEffect(() => {
    cargarComentarios();
  }, [seccionId]);

  const enviarComentario = async (e) => {
    e.preventDefault();
    if (!nuevoComentario.trim()) return;
    setEnviando(true);
    try {
      const { error } = await supabase.from("comentarios").insert({
        seccion_id: seccionId,
        documento_id: documentoId,
        usuario_id: usuario.id,
        texto: nuevoComentario.trim(),
      });
      if (error) throw error;
      setNuevoComentario("");
      await cargarComentarios();
    } catch (err) {
      console.error(err);
      alert("Error al enviar comentario");
    } finally {
      setEnviando(false);
    }
  };

  const toggleResuelto = async (comentarioId, actualResuelto) => {
    if (!puedeResolverYEliminar) return;
    try {
      const { error } = await supabase
        .from("comentarios")
        .update({ resuelto: !actualResuelto })
        .eq("id", comentarioId);
      if (error) throw error;
      await cargarComentarios();
    } catch (err) {
      console.error(err);
    }
  };

  const eliminarComentario = async (comentarioId) => {
    if (!puedeResolverYEliminar) return;
    if (!confirm("¿Eliminar este comentario?")) return;
    try {
      const { error } = await supabase
        .from("comentarios")
        .delete()
        .eq("id", comentarioId);
      if (error) throw error;
      await cargarComentarios();
    } catch (err) {
      console.error(err);
      alert("Error al eliminar");
    }
  };

  const obtenerNombreAutor = (usuarioId) => {
    if (usuarioId === usuario.id) return "Tú";
    return userNames.get(usuarioId) || usuarioId.slice(0, 8) + "...";
  };

  return (
    <div className="bg-white rounded-lg shadow-lg p-4 h-full flex flex-col">
      <h3 className="font-bold text-gray-700 flex items-center gap-2 mb-3">
        <ChatBubbleLeftRightIcon className="h-5 w-5" />
        Comentarios de esta sección
      </h3>
      <div className="flex-1 overflow-y-auto mb-4 space-y-3">
        {cargando ? (
          <p className="text-center text-gray-400">Cargando...</p>
        ) : comentarios.length === 0 ? (
          <p className="text-center text-gray-400">No hay comentarios.</p>
        ) : (
          comentarios.map((c) => (
            <div
              key={c.id}
              className={`p-3 rounded-lg ${
                c.resuelto
                  ? "bg-green-50 border border-green-200"
                  : "bg-gray-50"
              }`}
            >
              <div className="flex justify-between items-start">
                <div className="flex items-center gap-2">
                  <UserCircleIcon className="h-5 w-5 text-gray-500" />
                  <span className="text-sm font-medium text-gray-700">
                    {obtenerNombreAutor(c.usuario_id)}
                  </span>
                  <span className="text-xs text-gray-400">
                    {new Date(c.created_at).toLocaleString()}
                  </span>
                </div>
                <div className="flex gap-1">
                  {puedeResolverYEliminar && (
                    <button
                      onClick={() => toggleResuelto(c.id, c.resuelto)}
                      className={`text-xs ${
                        c.resuelto
                          ? "text-green-600"
                          : "text-gray-400 hover:text-green-600"
                      }`}
                      title={
                        c.resuelto
                          ? "Marcar como no resuelto"
                          : "Marcar como resuelto"
                      }
                    >
                      <CheckCircleIcon className="h-5 w-5" />
                    </button>
                  )}
                  {puedeResolverYEliminar && (
                    <button
                      onClick={() => eliminarComentario(c.id)}
                      className="text-gray-400 hover:text-red-600"
                      title="Eliminar"
                    >
                      <XMarkIcon className="h-4 w-4" />
                    </button>
                  )}
                </div>
              </div>
              <p className="mt-2 text-sm text-gray-700">{c.texto}</p>
              {c.resuelto && (
                <div className="mt-1 text-xs text-green-600 flex items-center gap-1">
                  <CheckCircleIcon className="h-3 w-3" /> Resuelto
                </div>
              )}
            </div>
          ))
        )}
      </div>
      {puedeComentar && (
        <form onSubmit={enviarComentario} className="border-t pt-3">
          <textarea
            value={nuevoComentario}
            onChange={(e) => setNuevoComentario(e.target.value)}
            placeholder="Escribe un comentario..."
            rows="3"
            className="w-full border rounded-md p-2 text-sm focus:ring-indigo-500 focus:border-indigo-500"
            disabled={enviando}
          />
          <button
            type="submit"
            disabled={enviando || !nuevoComentario.trim()}
            className="mt-2 bg-indigo-600 hover:bg-indigo-700 text-white px-3 py-1 rounded-md text-sm disabled:opacity-50"
          >
            {enviando ? "Enviando..." : "Comentar"}
          </button>
        </form>
      )}
    </div>
  );
};
