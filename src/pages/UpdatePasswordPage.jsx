import { useState, useEffect } from "react";
import { supabase } from "../lib/supabase";
import { useNavigate } from "react-router-dom";

export const UpdatePasswordPage = () => {
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    // Verificar que el hash de recuperación está presente
    const hash = window.location.hash;
    if (!hash.includes("access_token")) {
      setMessage(
        "Enlace inválido o expirado. Solicita un nuevo restablecimiento.",
      );
    }
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password });
    if (error) {
      setMessage("Error: " + error.message);
    } else {
      setMessage("Contraseña actualizada. Redirigiendo al login...");
      setTimeout(() => navigate("/login"), 2000);
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="max-w-md w-full bg-white p-8 rounded shadow">
        <h2 className="text-2xl font-bold mb-4">Establecer nueva contraseña</h2>
        <form onSubmit={handleSubmit}>
          <input
            type="password"
            placeholder="Nueva contraseña"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            className="w-full border p-2 rounded mb-4"
          />
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-indigo-600 text-white py-2 rounded"
          >
            {loading ? "Guardando..." : "Guardar contraseña"}
          </button>
        </form>
        {message && <p className="mt-2 text-sm text-center">{message}</p>}
      </div>
    </div>
  );
};
