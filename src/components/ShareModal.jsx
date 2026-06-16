// src/components/ShareModal.jsx
import {
  XMarkIcon,
  UserPlusIcon,
  TrashIcon,
} from "@heroicons/react/24/outline";

export const ShareModal = ({
  onClose,
  titulo,
  searchEmail,
  setSearchEmail,
  searchResults,
  onSelectUser,
  newPermiso,
  setNewPermiso,
  onAddShare,
  sharedUsers,
  onShareChange,
  onRemoveShare,
  loadingShare,
}) => {
  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex items-center justify-center min-h-screen p-4 text-center">
        <div
          className="fixed inset-0 bg-black bg-opacity-40 transition-opacity"
          onClick={onClose}
        ></div>
        <div className="relative bg-white rounded-2xl shadow-2xl max-w-lg w-full p-6">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-xl font-semibold text-gray-900">
              Compartir documento
            </h3>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 cursor-pointer cursor-pointer"
            >
              <XMarkIcon className="h-6 w-6" />
            </button>
          </div>
          <p className="text-sm text-gray-500 mb-4">{titulo}</p>
          <div className="mb-4">
            <label className="block text-sm font-medium mb-1">
              Añadir colaborador
            </label>
            <div className="flex gap-2">
              <div className="flex-1 relative">
                <input
                  type="email"
                  placeholder="Email"
                  value={searchEmail}
                  onChange={(e) => setSearchEmail(e.target.value)}
                  className="w-full border rounded-md p-2"
                />
                {searchResults.length > 0 && (
                  <ul className="absolute z-10 mt-1 w-full bg-white border rounded-md shadow-lg max-h-40 overflow-auto">
                    {searchResults.map((u) => (
                      <li
                        key={u.id}
                        onClick={() => onSelectUser(u)}
                        className="p-2 hover:bg-gray-100 cursor-pointer cursor-pointer"
                      >
                        {u.email} - {u.nombre} {u.apellido}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              <select
                value={newPermiso}
                onChange={(e) => setNewPermiso(e.target.value)}
                className="border rounded-md p-2"
              >
                <option value="lectura">Revisión</option>
                <option value="escritura">Edición</option>
              </select>
              <button
                onClick={onAddShare}
                disabled={loadingShare}
                className="bg-indigo-600 hover:bg-indigo-700 text-white px-3 rounded-md disabled:opacity-50 cursor-pointer"
              >
                <UserPlusIcon className="h-5 w-5" />
              </button>
            </div>
          </div>
          <div>
            <h4 className="font-medium mb-2">Personas con acceso</h4>
            {sharedUsers.length === 0 ? (
              <p className="text-sm text-gray-500">No hay colaboradores</p>
            ) : (
              <ul className="space-y-2">
                {sharedUsers.map((s) => (
                  <li
                    key={s.usuario_id}
                    className="flex justify-between items-center border-b pb-1"
                  >
                    <div>
                      <span className="font-medium">
                        {s.info.email}{" "}
                        {s.info.nombre
                          ? `(${s.info.nombre} ${s.info.apellido})`
                          : ""}
                      </span>
                      <span className="ml-2 text-xs bg-gray-200 px-2 rounded-full">
                        {s.permiso === "escritura" ? "Edición" : "Revisión"}
                      </span>
                    </div>
                    <div className="flex gap-2">
                      <select
                        value={s.permiso}
                        onChange={(e) =>
                          onShareChange(s.usuario_id, e.target.value)
                        }
                        className="text-sm border rounded p-1"
                      >
                        <option value="lectura">Revisión</option>
                        <option value="escritura">Edición</option>
                      </select>
                      <button
                        onClick={() => onRemoveShare(s.usuario_id)}
                        className="text-red-600 cursor-pointer"
                      >
                        <TrashIcon className="h-5 w-5" />
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
