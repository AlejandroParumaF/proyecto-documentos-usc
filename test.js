import { createClient } from "@supabase/supabase-js";

// Coloca aquí tus credenciales (solo para prueba local)
const supabaseUrl = "https://fcjrqdmdwfkzqoygioes.supabase.co";
const supabaseAnonKey =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZjanJxZG1kd2ZrenFveWdpb2VzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY3MDc3OTIsImV4cCI6MjA5MjI4Mzc5Mn0.ThPaIDZmPqdS2AXDEgPMf2dOE9y1u4WC2BsTsy5n1fI"; // Reemplaza con tu anon key real

const supabase = createClient(supabaseUrl, supabaseAnonKey);

const { data, error } = await supabase.functions.invoke("set-admin", {
  body: {}, // No es necesario enviar datos si la función no los requiere
});

if (error) {
  console.error("Error:", error);
} else {
  console.log("Respuesta:", data);
}
