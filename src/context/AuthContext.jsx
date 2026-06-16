import { createContext, useContext, useEffect, useState } from "react";
import { supabase } from "../lib/supabase";

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (mounted) setUser(session?.user ?? null);
      if (mounted) setLoading(false);
    });
    const { data: listener } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        if (mounted) setUser(session?.user ?? null);
      },
    );
    return () => {
      mounted = false;
      listener?.subscription.unsubscribe();
    };
  }, []);

  const login = async (email, password) => {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    if (error) throw error;
    return data;
  };

  const logout = async () => {
    await supabase.auth.signOut();
  };

  const role = user?.user_metadata?.rol || null;

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        login,
        logout,
        role,
        isAdmin: role === "admin",
        isEditor: role === "editor",
        isRevisor: role === "revisor",
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
