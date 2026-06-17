const SUPABASE_URL = "https://fcjrqdmdwfkzqoygioes.supabase.co";
const SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZjanJxZG1kd2ZrenFveWdpb2VzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY3MDc3OTIsImV4cCI6MjA5MjI4Mzc5Mn0.ThPaIDZmPqdS2AXDEgPMf2dOE9y1u4WC2BsTsy5n1fI";

const response = await fetch(`${SUPABASE_URL}/functions/v1/asistente-editor`, {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    apikey: SUPABASE_ANON_KEY,
    Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
  },
  body: JSON.stringify({
    accion: "mejorar_redaccion",
    contenido:
      "<p>El curso trata sobre bases de datos y se verán temas importantes para que el estudiante aprenda.</p>",
    tituloSeccion: "Introducción",
    tituloDocumento: "Plan de curso",
    tipoDocumento: "curso",
  }),
});

const text = await response.text();

console.log("Status:", response.status);
console.log("Respuesta:");
console.log(text);
