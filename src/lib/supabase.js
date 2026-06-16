import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// Clave para guardar la preferencia del usuario
const STORAGE_TYPE_KEY = "supabase_storage_type";

// Determinar qué storage usar al iniciar
const getInitialStorage = () => {
  const saved = localStorage.getItem(STORAGE_TYPE_KEY);
  return saved === "session" ? sessionStorage : localStorage;
};

let activeStorage = getInitialStorage();

const customStorage = {
  getItem: (key) => activeStorage.getItem(key),
  setItem: (key, value) => activeStorage.setItem(key, value),
  removeItem: (key) => activeStorage.removeItem(key),
};

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: customStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,
  },
});

// Cambiar el storage (llamar antes de login o logout)
export const setAuthStorage = (useLocalStorage) => {
  activeStorage = useLocalStorage ? localStorage : sessionStorage;
  localStorage.setItem(STORAGE_TYPE_KEY, useLocalStorage ? "local" : "session");
};
