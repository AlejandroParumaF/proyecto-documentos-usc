// src/features/documentos/components/VersionsModal.jsx
import { XMarkIcon } from "@heroicons/react/24/outline";

export const VersionsModal = ({
  onClose,
  versiones,
  cargandoVersiones,
  permiso,
  readonlyParam,
  onRestaurar,
  onEliminar,
}) => {
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[80vh] flex flex-col">
        <div className="flex justify-between items-center p-4 border-b">
          <h3 className="text-lg font-medium">Historial de versiones</h3>
          <button onClick={onClose}>
            <XMarkIcon className="h-6 w-6" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-4">
          {cargandoVersiones ? (
            <p>Cargando...</p>
          ) : versiones.length === 0 ? (
            <p>No hay versiones guardadas.</p>
          ) : (
            <ul className="space-y-3">
              {versiones.map((v) => (
                <li key={v.id} className="border rounded-lg p-3">
                  <div className="flex justify-between items-start">
                    <div>
                      <span className="font-bold text-indigo-600">
                        Versión {v.numero}
                      </span>
                      <p className="text-sm text-gray-500">
                        {new Date(v.created_at).toLocaleString()}
                      </p>
                      {v.comentario && (
                        <p className="text-sm mt-1 text-gray-700">
                          {v.comentario}
                        </p>
                      )}
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => onRestaurar(v.id)}
                        className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1 rounded-md text-sm cursor-pointer"
                      >
                        Restaurar
                      </button>
                      {permiso === "dueño" && !readonlyParam && (
                        <button
                          onClick={() => onEliminar(v.id, v.numero)}
                          className="bg-red-600 hover:bg-red-700 text-white px-3 py-1 rounded-md text-sm cursor-pointer"
                        >
                          Eliminar
                        </button>
                      )}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
};
