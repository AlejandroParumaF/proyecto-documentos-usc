import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase, setAuthStorage } from "../lib/supabase";
import {
  EnvelopeIcon,
  LockClosedIcon,
  EyeIcon,
  EyeSlashIcon,
  XMarkIcon,
} from "@heroicons/react/24/outline";

export const LoginPage = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true); // true por defecto (marcado)
  const [showResetModal, setShowResetModal] = useState(false);
  const [resetEmail, setResetEmail] = useState("");
  const [resetMessage, setResetMessage] = useState("");
  const [resetError, setResetError] = useState("");
  const [resetting, setResetting] = useState(false);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    const checkSession = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (session?.user) {
        const role = session.user.user_metadata?.rol;
        if (role === "admin") navigate("/admin", { replace: true });
        else if (role === "editor") navigate("/editor", { replace: true });
        else if (role === "revisor") navigate("/revisor", { replace: true });
        else navigate("/", { replace: true });
      } else {
        setLoading(false);
      }
    };
    checkSession();
  }, [navigate]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      // Configurar storage según "Recordarme"
      setAuthStorage(rememberMe);

      const { error, data } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      if (error) throw error;

      const role = data.user.user_metadata?.rol;
      if (role === "admin") navigate("/admin", { replace: true });
      else if (role === "editor") navigate("/editor", { replace: true });
      else if (role === "revisor") navigate("/revisor", { replace: true });
      else navigate("/", { replace: true });
    } catch (err) {
      let msg = err.message;
      if (msg.includes("Invalid login credentials")) {
        msg = "Correo o contraseña incorrectos.";
      } else if (msg.includes("Email not confirmed")) {
        msg = "Confirma tu correo antes de iniciar sesión.";
      }
      setError(msg);
      setLoading(false);
    }
  };

  const handleResetSubmit = async (e) => {
    e.preventDefault();
    setResetting(true);
    setResetMessage("");
    setResetError("");
    const { error } = await supabase.auth.resetPasswordForEmail(resetEmail, {
      redirectTo: `${window.location.origin}/update-password`,
    });
    if (error) {
      setResetError(error.message);
    } else {
      setResetMessage(
        "Revisa tu correo. Te enviamos un enlace para restablecer tu contraseña.",
      );
      setTimeout(() => {
        setShowResetModal(false);
        setResetEmail("");
        setResetMessage("");
      }, 3000);
    }
    setResetting(false);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-gray-500">Cargando...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex">
      {/* Columna izquierda - institucional (sin cambios, igual que antes) */}
      <div className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-indigo-800 to-blue-900 relative overflow-hidden">
        <div className="absolute inset-0 bg-black opacity-20"></div>
        <div className="absolute -top-24 -right-24 w-96 h-96 bg-white opacity-10 rounded-full blur-3xl"></div>
        <div className="absolute -bottom-32 -left-32 w-96 h-96 bg-indigo-300 opacity-20 rounded-full blur-3xl"></div>
        <div className="relative z-10 flex flex-col justify-center px-12 text-white">
          <div className="mb-8">
            <div className="w-16 h-16 bg-white/20 rounded-xl flex items-center justify-center mb-6">
              <span className="text-3xl font-bold">U</span>
            </div>
            <h1 className="text-4xl font-bold mb-4">
              Aseguramiento de la calidad
            </h1>
            <p className="text-indigo-100 text-lg">
              Documentos maestros de programas.
            </p>
          </div>
          <div className="mt-12 space-y-4">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center">
                <svg
                  className="w-5 h-5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z"
                  />
                </svg>
              </div>
              <p className="text-sm">Usar plantillas y recomendaciones</p>
            </div>
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center">
                <svg
                  className="w-5 h-5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"
                  />
                </svg>
              </div>
              <p className="text-sm">
                Acceso y revisión de documentos compartidos
              </p>
            </div>
          </div>
          <footer className="absolute bottom-6 left-0 right-0 text-center text-indigo-200 text-xs">
            © 2026 Universidad Santiago de Cali. Todos los derechos reservados.
          </footer>
        </div>
      </div>

      {/* Columna derecha - formulario */}
      <div className="flex-1 flex items-center justify-center p-8 bg-gray-50">
        <div className="w-full max-w-md">
          <div className="lg:hidden text-center mb-8">
            <div className="w-12 h-12 bg-indigo-600 rounded-xl flex items-center justify-center mx-auto mb-4">
              <span className="text-white text-xl font-bold">U</span>
            </div>
            <h2 className="text-2xl font-bold text-gray-800">
              Bienvenido de nuevo
            </h2>
            <p className="text-gray-500 mt-1">
              Inicia sesión con tu cuenta institucional
            </p>
          </div>

          <div className="bg-white rounded-2xl shadow-xl p-8 md:p-10">
            <div className="hidden lg:block text-center mb-8">
              <h2 className="text-2xl font-bold text-gray-800">
                Acceso al sistema
              </h2>
              <p className="text-gray-500 text-sm mt-1">
                Ingresa tus credenciales académicas
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Correo electrónico institucional
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <EnvelopeIcon className="h-5 w-5 text-gray-400" />
                  </div>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition"
                    placeholder="nombre.apellido@usc.edu.co"
                    required
                    autoComplete="email"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Contraseña
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <LockClosedIcon className="h-5 w-5 text-gray-400" />
                  </div>
                  <input
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full pl-10 pr-10 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition"
                    placeholder="••••••••"
                    required
                    autoComplete="current-password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-500 hover:text-gray-700"
                  >
                    {showPassword ? (
                      <EyeSlashIcon className="h-5 w-5" />
                    ) : (
                      <EyeIcon className="h-5 w-5" />
                    )}
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-between">
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                    className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
                  />
                  <span className="ml-2 text-sm text-gray-600">Recordarme</span>
                </label>
                <button
                  type="button"
                  onClick={() => setShowResetModal(true)}
                  className="text-sm text-indigo-600 hover:underline font-medium"
                >
                  ¿Olvidaste tu contraseña?
                </button>
              </div>

              {error && (
                <div className="bg-red-50 border-l-4 border-red-500 p-3 rounded">
                  <p className="text-red-700 text-sm">{error}</p>
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-2.5 px-4 rounded-lg transition duration-200 disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
              >
                {loading ? (
                  <span className="flex items-center justify-center">
                    <svg
                      className="animate-spin h-5 w-5 mr-2 text-white"
                      viewBox="0 0 24 24"
                    >
                      <circle
                        className="opacity-25"
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="currentColor"
                        strokeWidth="4"
                        fill="none"
                      />
                      <path
                        className="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                      />
                    </svg>
                    Verificando...
                  </span>
                ) : (
                  "Ingresar al sistema"
                )}
              </button>
            </form>

            <div className="mt-6 text-center text-sm text-gray-500">
              <p>
                ¿Problemas técnicos?{" "}
                <a href="#" className="text-indigo-600 hover:underline">
                  Contáctanos: 5183000 Ext: 748
                </a>
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Modal recuperar contraseña */}
      {showResetModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-medium text-gray-900">
                Restablecer contraseña
              </h3>
              <button
                onClick={() => {
                  setShowResetModal(false);
                  setResetMessage("");
                  setResetError("");
                  setResetEmail("");
                }}
                className="text-gray-400 hover:text-gray-600"
              >
                <XMarkIcon className="h-6 w-6" />
              </button>
            </div>
            <form onSubmit={handleResetSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Correo electrónico
                </label>
                <input
                  type="email"
                  value={resetEmail}
                  onChange={(e) => setResetEmail(e.target.value)}
                  required
                  className="w-full border border-gray-300 rounded-lg p-2 focus:ring-indigo-500 focus:border-indigo-500"
                  placeholder="nombre.apellido@usc.edu.co"
                />
              </div>
              {resetMessage && (
                <div className="bg-green-50 border-l-4 border-green-500 p-3 rounded">
                  <p className="text-green-700 text-sm">{resetMessage}</p>
                </div>
              )}
              {resetError && (
                <div className="bg-red-50 border-l-4 border-red-500 p-3 rounded">
                  <p className="text-red-700 text-sm">{resetError}</p>
                </div>
              )}
              <button
                type="submit"
                disabled={resetting}
                className="w-full bg-indigo-600 hover:bg-indigo-700 text-white py-2 rounded-lg transition disabled:opacity-50"
              >
                {resetting ? "Enviando..." : "Enviar enlace"}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
