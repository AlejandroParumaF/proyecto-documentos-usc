// src/features/documentos/components/DocumentoHeader.jsx
import { useState } from "react";
import {
  ArrowLeftIcon,
  DocumentDuplicateIcon,
  ClockIcon,
  DocumentArrowDownIcon,
  ShareIcon,
  ChevronDownIcon,
  DocumentPlusIcon,
} from "@heroicons/react/24/outline";

export const DocumentoHeader = ({
  titulo,
  onTituloChange,
  onGuardarTitulo,
  onGoBack,
  autoSaveStatus,
  permiso,
  readonlyParam,
  role,
  onGuardarVersion,
  onCargarVersiones,
  onExportPDF,
  onExportDOCX,
  onCompartir,
  onVerLogs,
  onGuardarPlantilla,
}) => {
  const soloLectura = readonlyParam || permiso === "lectura";
  const [showExportMenu, setShowExportMenu] = useState(false);

  return (
    <div className="bg-white/80 backdrop-blur-sm shadow-sm border-b border-gray-200 sticky top-0 z-10">
      <div className="w-full px-4 sm:px-6 lg:px-8 py-4 flex flex-col sm:flex-row justify-between items-center gap-4">
        <div className="flex items-center gap-3 flex-1 w-full sm:w-auto">
          <button
            onClick={onGoBack}
            className="text-gray-600 hover:text-gray-900 cursor-pointer"
            title="Volver"
          >
            <ArrowLeftIcon className="h-6 w-6" />
          </button>
          <input
            type="text"
            value={titulo}
            onChange={(e) => onTituloChange(e.target.value)}
            onBlur={() => onGuardarTitulo(titulo)}
            disabled={soloLectura}
            className="text-xl font-bold border-0 focus:ring-0 p-1 outline-none disabled:bg-transparent w-full bg-transparent"
          />
        </div>
        <div className="flex items-center gap-4 flex-wrap justify-end">
          {!soloLectura && (
            <div className="text-xs text-gray-500 min-w-[80px] text-right">
              {autoSaveStatus === "saving" && "Guardando..."}
              {autoSaveStatus === "saved" && "✓ Guardado"}
              {autoSaveStatus === "error" && "Error al guardar"}
            </div>
          )}
          {permiso === "dueño" && !readonlyParam && (
            <button
              onClick={onGuardarVersion}
              className="bg-purple-600 hover:bg-purple-700 text-white px-3 py-2 rounded-md flex items-center gap-2 cursor-pointer"
            >
              <DocumentDuplicateIcon className="h-5 w-5" /> Guardar versión
            </button>
          )}
          <button
            onClick={onCargarVersiones}
            className="bg-gray-600 hover:bg-gray-700 text-white px-3 py-2 rounded-md flex items-center gap-2 cursor-pointer"
          >
            <ClockIcon className="h-5 w-5" /> Versiones
          </button>

          {/* Menú desplegable de exportación */}
          <div className="relative">
            <button
              onClick={() => setShowExportMenu(!showExportMenu)}
              className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-2 rounded-md flex items-center gap-2 cursor-pointer"
            >
              <DocumentArrowDownIcon className="h-5 w-5" /> Exportar
              <ChevronDownIcon className="h-4 w-4" />
            </button>
            {showExportMenu && (
              <div className="absolute right-0 mt-2 w-40 bg-white rounded-md shadow-lg border border-gray-200 z-10">
                <button
                  onClick={() => {
                    onExportPDF();
                    setShowExportMenu(false);
                  }}
                  className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 cursor-pointer"
                >
                  Exportar como PDF
                </button>
                <button
                  onClick={() => {
                    onExportDOCX();
                    setShowExportMenu(false);
                  }}
                  className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 cursor-pointer"
                >
                  Exportar como Word (DOCX)
                </button>
              </div>
            )}
          </div>

          {permiso === "dueño" && !readonlyParam && (
            <button
              onClick={onCompartir}
              className="bg-green-600 hover:bg-green-700 text-white px-3 py-2 rounded-md flex items-center gap-2 cursor-pointer"
            >
              <ShareIcon className="h-5 w-5" /> Compartir
            </button>
          )}

          {readonlyParam && (
            <button
              onClick={onVerLogs}
              className="bg-indigo-600 hover:bg-indigo-700 text-white px-3 py-2 rounded-md flex items-center gap-2 cursor-pointer"
            >
              <ClockIcon className="h-5 w-5" /> Ver logs
            </button>
          )}

          {/* Botón Guardar como plantilla (solo para administradores, incluso en solo lectura) */}
          {role === "admin" && (
            <button
              onClick={onGuardarPlantilla}
              className="bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-2 rounded-md flex items-center gap-2 cursor-pointer"
            >
              <DocumentPlusIcon className="h-5 w-5" /> Guardar como plantilla
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
