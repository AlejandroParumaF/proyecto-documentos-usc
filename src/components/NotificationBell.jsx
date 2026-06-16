// src/components/NotificationBell.jsx
import { useState, useEffect, useRef } from "react";
import {
  BellIcon,
  CheckCircleIcon,
  XCircleIcon,
  ChatBubbleLeftRightIcon,
  XMarkIcon,
} from "@heroicons/react/24/outline";
import { supabase } from "../lib/supabase";
import { useAuth } from "../context/AuthContext";
import { useNavigate } from "react-router-dom";

export const NotificationBell = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef(null);

  useEffect(() => {
    if (!user) return;

    cargarNotificaciones();

    // Suscripción en tiempo real
    const channel = supabase
      .channel("notificaciones")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "notificaciones",
          filter: `usuario_id=eq.${user.id}`,
        },
        (payload) => {
          setNotifications((prev) => [payload.new, ...prev]);
          setUnreadCount((prev) => prev + 1);
        },
      )
      .subscribe();

    // Cerrar dropdown al hacer clic fuera
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      channel.unsubscribe();
    };
  }, [user]);

  const cargarNotificaciones = async () => {
    const { data, error } = await supabase
      .from("notificaciones")
      .select("*")
      .eq("usuario_id", user.id)
      .order("created_at", { ascending: false })
      .limit(50);
    if (!error) {
      setNotifications(data);
      setUnreadCount(data.filter((n) => !n.leida).length);
    }
  };

  const marcarComoLeida = async (id) => {
    await supabase.from("notificaciones").update({ leida: true }).eq("id", id);
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, leida: true } : n)),
    );
    setUnreadCount((prev) => prev - 1);
  };

  const marcarTodasLeidas = async () => {
    const ids = notifications.filter((n) => !n.leida).map((n) => n.id);
    if (ids.length === 0) return;
    await supabase.from("notificaciones").update({ leida: true }).in("id", ids);
    setNotifications((prev) => prev.map((n) => ({ ...n, leida: true })));
    setUnreadCount(0);
  };

  const irADocumento = (documentoId, seccionId) => {
    navigate(`/editor/documento/${documentoId}`);
    setIsOpen(false);
  };

  const getIcon = (tipo) => {
    switch (tipo) {
      case "aprobado":
        return <CheckCircleIcon className="h-5 w-5 text-green-500" />;
      case "correcciones":
        return <XCircleIcon className="h-5 w-5 text-orange-500" />;
      case "comentario":
        return <ChatBubbleLeftRightIcon className="h-5 w-5 text-blue-500" />;
      default:
        return <BellIcon className="h-5 w-5" />;
    }
  };

  const formatDate = (date) => {
    const diff = new Date() - new Date(date);
    if (diff < 60000) return "hace un momento";
    if (diff < 3600000) return `hace ${Math.floor(diff / 60000)} min`;
    if (diff < 86400000) return `hace ${Math.floor(diff / 3600000)} h`;
    return new Date(date).toLocaleDateString();
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 rounded-full hover:bg-gray-100 transition cursor-pointer"
      >
        <BellIcon className="h-6 w-6 text-gray-600" />
        {unreadCount > 0 && (
          <span className="absolute top-0 right-0 inline-flex items-center justify-center px-2 py-1 text-xs font-bold leading-none text-white transform translate-x-1/2 -translate-y-1/2 bg-red-600 rounded-full">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-80 bg-white rounded-lg shadow-xl border border-gray-200 z-20 overflow-hidden">
          <div className="px-4 py-2 border-b border-gray-200 flex justify-between items-center bg-gray-50">
            <h3 className="font-semibold text-gray-700">Notificaciones</h3>
            {unreadCount > 0 && (
              <button
                onClick={marcarTodasLeidas}
                className="text-xs text-indigo-600 hover:underline"
              >
                Marcar todas como leídas
              </button>
            )}
          </div>
          <div className="max-h-96 overflow-y-auto">
            {notifications.length === 0 ? (
              <div className="p-4 text-center text-gray-500 text-sm">
                No hay notificaciones
              </div>
            ) : (
              notifications.map((n) => (
                <div
                  key={n.id}
                  className={`p-3 border-b border-gray-100 hover:bg-gray-50 cursor-pointer ${!n.leida ? "bg-blue-50" : ""}`}
                  onClick={() => irADocumento(n.documento_id, n.seccion_id)}
                >
                  <div className="flex items-start gap-2">
                    {getIcon(n.tipo)}
                    <div className="flex-1">
                      <p className="text-sm text-gray-800">{n.mensaje}</p>
                      <p className="text-xs text-gray-400 mt-1">
                        {formatDate(n.created_at)}
                      </p>
                    </div>
                    {!n.leida && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          marcarComoLeida(n.id);
                        }}
                        className="text-gray-400 hover:text-gray-600"
                      >
                        <XMarkIcon className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
};
