// src/components/PanelAnexos.jsx
import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import {
  DocumentTextIcon,
  DocumentIcon,
  TableCellsIcon,
  PhotoIcon,
  XMarkIcon,
  PaperClipIcon,
} from "@heroicons/react/24/outline";

const getIconByType = (tipo) => {
  if (tipo?.includes("pdf"))
    return <DocumentTextIcon className="h-6 w-6 text-red-500" />;
  if (tipo?.includes("excel") || tipo?.includes("spreadsheet"))
    return <TableCellsIcon className="h-6 w-6 text-green-600" />;
  if (tipo?.includes("word"))
    return <DocumentIcon className="h-6 w-6 text-blue-600" />;
  if (tipo?.includes("image"))
    return <PhotoIcon className="h-6 w-6 text-purple-500" />;
  return <DocumentIcon className="h-6 w-6 text-gray-500" />;
};

export const PanelAnexos = ({ seccionId, permiso, documentoId }) => {
  const [anexos, setAnexos] = useState([]);
  const [cargando, setCargando] = useState(false);
  const [subiendo, setSubiendo] = useState(false);
  const puedeEditar = permiso === "dueño" || permiso === "escritura";

  const cargarAnexos = async () => {
    if (!seccionId) return;
    setCargando(true);
    const { data, error } = await supabase
      .from("anexos")
      .select("*")
      .eq("seccion_id", seccionId)
      .order("created_at", { ascending: false });
    if (error) console.error(error);
    else setAnexos(data || []);
    setCargando(false);
  };

  useEffect(() => {
    cargarAnexos();
  }, [seccionId]);

  const subirArchivo = async (event) => {
    const file = event.target.files[0];
    if (!file) return;
    setSubiendo(true);
    try {
      const fileExt = file.name.split(".").pop();
      const fileName = `${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`;
      const filePath = `anexos/${documentoId}/${seccionId}/${fileName}`;

      const { data: storageData, error: storageError } = await supabase.storage
        .from("anexos")
        .upload(filePath, file);
      if (storageError) throw storageError;

      const {
        data: { publicUrl },
      } = supabase.storage.from("anexos").getPublicUrl(filePath);

      const { error: dbError } = await supabase.from("anexos").insert({
        seccion_id: seccionId,
        nombre: file.name,
        url: publicUrl,
        tipo: file.type,
        tamaño: file.size,
        usuario_id: (await supabase.auth.getUser()).data.user?.id,
      });
      if (dbError) throw dbError;

      await cargarAnexos();
    } catch (error) {
      console.error("Error subiendo archivo:", error);
      alert("Error al subir el archivo");
    } finally {
      setSubiendo(false);
      event.target.value = "";
    }
  };

  const eliminarAnexo = async (anexo) => {
    if (!puedeEditar) return;
    if (!confirm(`¿Eliminar "${anexo.nombre}"?`)) return;
    try {
      // Extraer path relativo de la URL (asumiendo estructura predecible)
      const path = anexo.url.split("/").slice(-4).join("/");
      await supabase.storage.from("anexos").remove([path]);
      await supabase.from("anexos").delete().eq("id", anexo.id);
      await cargarAnexos();
    } catch (error) {
      console.error(error);
      alert("Error al eliminar");
    }
  };

  return (
    <div className="w-72 bg-white border-l border-gray-200 flex flex-col h-full">
      <div className="p-4 border-b">
        <h3 className="font-bold text-gray-700 flex items-center gap-2">
          <PaperClipIcon className="h-5 w-5" />
          Anexos
        </h3>
        {puedeEditar && (
          <div className="mt-3">
            <label className="block">
              <span className="sr-only">Subir archivo</span>
              <input
                type="file"
                accept=".pdf,.xls,.xlsx,.doc,.docx,.txt,.zip,.jpg,.png"
                onChange={subirArchivo}
                disabled={subiendo}
                className="block w-full text-sm text-gray-500 file:mr-2 file:py-1 file:px-3 file:rounded-md file:border-0 file:text-sm file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100"
              />
            </label>
            {subiendo && (
              <p className="text-xs text-gray-400 mt-1">Subiendo...</p>
            )}
          </div>
        )}
      </div>
      <div className="flex-1 overflow-y-auto p-2">
        {cargando ? (
          <p className="text-center text-gray-400 text-sm">Cargando...</p>
        ) : anexos.length === 0 ? (
          <p className="text-center text-gray-400 text-sm">No hay anexos</p>
        ) : (
          <ul className="space-y-2">
            {anexos.map((anexo) => (
              <li
                key={anexo.id}
                className="flex items-center justify-between p-2 bg-gray-50 rounded-md hover:bg-gray-100"
              >
                <a
                  href={anexo.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 flex-1 truncate"
                  title={anexo.nombre}
                >
                  {getIconByType(anexo.tipo)}
                  <span className="text-sm truncate">{anexo.nombre}</span>
                </a>
                {puedeEditar && (
                  <button
                    onClick={() => eliminarAnexo(anexo)}
                    className="text-gray-400 hover:text-red-600 cursor-pointer"
                    title="Eliminar"
                  >
                    <XMarkIcon className="h-4 w-4" />
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
};
