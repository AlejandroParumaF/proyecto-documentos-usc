import { Link } from "react-router-dom";
export const UnauthorizedPage = () => (
  <div>
    <h1>Acceso no autorizado</h1>
    <p>No tienes permisos para ver esta página.</p>
    <Link to="/">Volver al inicio</Link>
  </div>
);
