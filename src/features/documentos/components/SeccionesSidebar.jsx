// src/features/documentos/components/SeccionesSidebar.jsx
import { useState, useEffect, useRef, useMemo } from "react";
import { DragDropContext, Droppable, Draggable } from "@hello-pangea/dnd";
import {
  PlusIcon,
  EllipsisHorizontalIcon,
  PencilIcon,
  TrashIcon,
  CheckBadgeIcon,
  ClockIcon,
  DocumentDuplicateIcon,
  ChevronDownIcon,
  ChevronRightIcon,
} from "@heroicons/react/24/outline";

const normalizarParentId = (parentId) => parentId || null;

const construirArbolSecciones = (secciones = []) => {
  const mapa = new Map();
  const raices = [];

  secciones.forEach((sec) => {
    mapa.set(sec.id, {
      ...sec,
      children: [],
    });
  });

  mapa.forEach((sec) => {
    if (sec.parent_id && mapa.has(sec.parent_id)) {
      mapa.get(sec.parent_id).children.push(sec);
    } else {
      raices.push(sec);
    }
  });

  const ordenarPorOrden = (items) => {
    items.sort((a, b) => (a.orden ?? 0) - (b.orden ?? 0));
    items.forEach((item) => ordenarPorOrden(item.children));
  };

  ordenarPorOrden(raices);

  return raices;
};

const aplanarConNumeracion = (nodos = [], prefijo = [], ancestorIds = []) => {
  return nodos.flatMap((nodo, index) => {
    const esRaiz = prefijo.length === 0;

    const numeroActual = esRaiz ? [index] : [...prefijo, index + 1];

    const numero = numeroActual.join(".");
    const nivelCalculado = prefijo.length;

    return [
      {
        ...nodo,
        numero,
        nivelCalculado,
        ancestorIds,
        tieneHijos: nodo.children?.length > 0,
      },
      ...aplanarConNumeracion(nodo.children || [], numeroActual, [
        ...ancestorIds,
        nodo.id,
      ]),
    ];
  });
};

export const SeccionesSidebar = ({
  secciones,
  seccionActiva,
  permiso,
  readonlyParam,
  onAgregarSeccion,
  onSeleccionarSeccion,
  onEliminarSeccion,
  onDuplicarSeccion,
  editandoTituloSeccion,
  setEditandoTituloSeccion,
  nuevoTitulo,
  setNuevoTitulo,
  onActualizarTitulo,
  onMarcarPendiente,
  onReorder,
}) => {
  const soloLectura = readonlyParam || permiso === "lectura";

  const puedeEditar =
    !soloLectura && (permiso === "dueño" || permiso === "escritura");

  const [menuOpenFor, setMenuOpenFor] = useState(null);
  const [collapsedIds, setCollapsedIds] = useState(() => new Set());
  const menuRef = useRef(null);

  const seccionesNumeradas = useMemo(() => {
    const arbol = construirArbolSecciones(secciones);
    return aplanarConNumeracion(arbol);
  }, [secciones]);

  const idsConHijos = useMemo(() => {
    return seccionesNumeradas
      .filter((sec) => sec.tieneHijos)
      .map((sec) => sec.id);
  }, [seccionesNumeradas]);

  const seccionesVisibles = useMemo(() => {
    return seccionesNumeradas.filter((sec) => {
      return !sec.ancestorIds.some((ancestorId) =>
        collapsedIds.has(ancestorId),
      );
    });
  }, [seccionesNumeradas, collapsedIds]);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setMenuOpenFor(null);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  useEffect(() => {
    setCollapsedIds((prev) => {
      const idsValidos = new Set(secciones.map((sec) => sec.id));
      const next = new Set();

      prev.forEach((id) => {
        if (idsValidos.has(id)) {
          next.add(id);
        }
      });

      return next;
    });
  }, [secciones]);

  const handleMenuClick = (secId, e) => {
    e.stopPropagation();
    setMenuOpenFor(menuOpenFor === secId ? null : secId);
  };

  const handleRename = (secId, currentTitle, e) => {
    e.stopPropagation();
    setEditandoTituloSeccion(secId);
    setNuevoTitulo(currentTitle);
    setMenuOpenFor(null);
  };

  const handleDelete = (sec) => {
    onEliminarSeccion(sec);
    setMenuOpenFor(null);
  };

  const handleDuplicate = (sec) => {
    if (onDuplicarSeccion) {
      onDuplicarSeccion(sec);
    }

    setMenuOpenFor(null);
  };

  const handleAgregarSubseccion = (sec, e) => {
    e.stopPropagation();

    if (onAgregarSubseccion) {
      onAgregarSubseccion(sec);
    }

    setCollapsedIds((prev) => {
      const next = new Set(prev);
      next.delete(sec.id);
      return next;
    });

    setMenuOpenFor(null);
  };

  const handleTogglePendiente = (secId, currentState, e) => {
    e.stopPropagation();
    onMarcarPendiente(secId, !currentState);
  };

  const toggleCollapse = (secId, e) => {
    e.stopPropagation();

    setCollapsedIds((prev) => {
      const next = new Set(prev);

      if (next.has(secId)) {
        next.delete(secId);
      } else {
        next.add(secId);
      }

      return next;
    });
  };

  const expandirTodo = () => {
    setCollapsedIds(new Set());
  };

  const colapsarTodo = () => {
    setCollapsedIds(new Set(idsConHijos));
  };

  const getEstadoBadge = (estado) => {
    switch (estado) {
      case "pendiente":
        return (
          <span className="bg-yellow-100 text-yellow-800 text-xs px-1.5 py-0.5 rounded-full whitespace-nowrap">
            Pendiente
          </span>
        );
      case "correcciones":
        return (
          <span className="bg-orange-100 text-orange-800 text-xs px-1.5 py-0.5 rounded-full whitespace-nowrap">
            Correcciones
          </span>
        );
      case "aprobado":
        return (
          <span className="bg-green-100 text-green-800 text-xs px-1.5 py-0.5 rounded-full whitespace-nowrap">
            Aprobado
          </span>
        );
      default:
        return null;
    }
  };

  const onDragEnd = (result) => {
    if (!result.destination) return;
    if (!puedeEditar) return;

    const sourceIndex = result.source.index;
    const destinationIndex = result.destination.index;

    if (sourceIndex === destinationIndex) return;

    const seccionMovida = seccionesVisibles[sourceIndex];
    const seccionDestino = seccionesVisibles[destinationIndex];

    if (!seccionMovida || !seccionDestino) return;

    const parentOrigen = normalizarParentId(seccionMovida.parent_id);
    const parentDestino = normalizarParentId(seccionDestino.parent_id);

    if (parentOrigen !== parentDestino) {
      alert("Solo puedes mover secciones dentro del mismo nivel.");
      return;
    }

    const hermanos = secciones
      .filter((sec) => normalizarParentId(sec.parent_id) === parentOrigen)
      .sort((a, b) => (a.orden ?? 0) - (b.orden ?? 0));

    const sourceSiblingIndex = hermanos.findIndex(
      (sec) => sec.id === seccionMovida.id,
    );

    const destinationSiblingIndex = hermanos.findIndex(
      (sec) => sec.id === seccionDestino.id,
    );

    if (sourceSiblingIndex === -1 || destinationSiblingIndex === -1) return;

    const hermanosReordenados = Array.from(hermanos);
    const [itemMovido] = hermanosReordenados.splice(sourceSiblingIndex, 1);

    hermanosReordenados.splice(destinationSiblingIndex, 0, itemMovido);

    const hermanosConNuevoOrden = hermanosReordenados.map((sec, index) => ({
      ...sec,
      orden: index,
    }));

    const nuevoOrdenCompleto = secciones.map((sec) => {
      const actualizada = hermanosConNuevoOrden.find((h) => h.id === sec.id);
      return actualizada || sec;
    });

    onReorder(nuevoOrdenCompleto, parentOrigen);
  };

  return (
    <div className="w-80 bg-white border-r border-gray-200 flex flex-col overflow-hidden shadow-sm">
      <div className="p-4 border-b border-gray-100 flex-shrink-0 bg-gray-50/50">
        <div className="flex justify-between items-center">
          <h2 className="font-semibold text-gray-700">Secciones</h2>

          {puedeEditar && (
            <button
              onClick={onAgregarSeccion}
              className="p-1 rounded-full hover:bg-gray-200 transition cursor-pointer"
              title="Nueva sección principal"
            >
              <PlusIcon className="h-5 w-5 text-indigo-600" />
            </button>
          )}
        </div>

        {idsConHijos.length > 0 && (
          <div className="flex items-center gap-2 mt-3 text-xs">
            <button
              type="button"
              onClick={expandirTodo}
              className="text-indigo-600 hover:text-indigo-800 hover:underline"
            >
              Expandir todo
            </button>

            <span className="text-gray-300">|</span>

            <button
              type="button"
              onClick={colapsarTodo}
              className="text-indigo-600 hover:text-indigo-800 hover:underline"
            >
              Contraer todo
            </button>
          </div>
        )}
      </div>

      <div className="flex-1 overflow-y-auto">
        {secciones.length === 0 && (
          <p className="p-4 text-gray-400 text-sm text-center">
            No hay secciones.
          </p>
        )}

        <DragDropContext onDragEnd={onDragEnd}>
          <Droppable droppableId="secciones">
            {(provided) => (
              <ul
                {...provided.droppableProps}
                ref={provided.innerRef}
                className="divide-y divide-gray-100"
              >
                {seccionesVisibles.map((sec, idx) => {
                  const estaColapsada = collapsedIds.has(sec.id);

                  return (
                    <Draggable
                      key={sec.id}
                      draggableId={sec.id}
                      index={idx}
                      isDragDisabled={!puedeEditar}
                    >
                      {(provided, snapshot) => (
                        <li
                          ref={provided.innerRef}
                          {...provided.draggableProps}
                          {...provided.dragHandleProps}
                          className={`group py-2 pr-4 hover:bg-gray-50 transition ${
                            puedeEditar ? "cursor-move" : "cursor-pointer"
                          } ${
                            seccionActiva?.id === sec.id
                              ? "bg-indigo-50 border-l-4 border-indigo-500"
                              : "border-l-4 border-transparent"
                          } ${snapshot.isDragging ? "opacity-50" : ""}`}
                          style={{
                            ...provided.draggableProps.style,
                            paddingLeft: `${12 + sec.nivelCalculado * 18}px`,
                          }}
                          onClick={() =>
                            !snapshot.isDragging && onSeleccionarSeccion(sec)
                          }
                          onDoubleClick={() => {
                            if (puedeEditar) {
                              setEditandoTituloSeccion(sec.id);
                              setNuevoTitulo(sec.titulo);
                            }
                          }}
                        >
                          <div className="flex justify-between items-center gap-2">
                            <div className="flex items-center gap-1.5 flex-1 min-w-0">
                              {sec.tieneHijos ? (
                                <button
                                  type="button"
                                  onClick={(e) => toggleCollapse(sec.id, e)}
                                  onMouseDown={(e) => e.stopPropagation()}
                                  className="p-0.5 rounded hover:bg-gray-200 text-gray-500 flex-shrink-0"
                                  title={
                                    estaColapsada
                                      ? "Expandir sección"
                                      : "Contraer sección"
                                  }
                                >
                                  {estaColapsada ? (
                                    <ChevronRightIcon className="h-4 w-4" />
                                  ) : (
                                    <ChevronDownIcon className="h-4 w-4" />
                                  )}
                                </button>
                              ) : (
                                <span className="w-5 flex-shrink-0" />
                              )}

                              <span className="text-xs text-gray-500 font-semibold whitespace-nowrap">
                                {sec.numero}
                              </span>

                              <span
                                className={`text-sm text-gray-800 truncate ${
                                  sec.nivelCalculado === 0
                                    ? "font-semibold"
                                    : "font-medium"
                                }`}
                                title={sec.titulo}
                              >
                                {sec.titulo}
                              </span>

                              {sec.tieneHijos && estaColapsada && (
                                <span className="text-[11px] text-gray-400 whitespace-nowrap">
                                  ({sec.children.length})
                                </span>
                              )}

                              {getEstadoBadge(sec.estado_revision)}
                            </div>

                            <div className="flex items-center gap-1 flex-shrink-0 ml-2">
                              {puedeEditar &&
                                sec.estado_revision !== "aprobado" && (
                                  <button
                                    type="button"
                                    onClick={(e) =>
                                      handleTogglePendiente(
                                        sec.id,
                                        sec.estado_revision === "pendiente",
                                        e,
                                      )
                                    }
                                    onMouseDown={(e) => e.stopPropagation()}
                                    className={`p-1 rounded-full hover:bg-gray-200 transition cursor-pointer ${
                                      sec.estado_revision === "pendiente"
                                        ? "text-amber-600"
                                        : "text-gray-400"
                                    }`}
                                    title={
                                      sec.estado_revision === "pendiente"
                                        ? "Quitar pendiente"
                                        : "Marcar para revisión"
                                    }
                                  >
                                    <ClockIcon className="h-4 w-4" />
                                  </button>
                                )}

                              {puedeEditar && (
                                <div className="relative">
                                  <button
                                    type="button"
                                    onClick={(e) => handleMenuClick(sec.id, e)}
                                    onMouseDown={(e) => e.stopPropagation()}
                                    className="p-1 rounded-full hover:bg-gray-200 transition cursor-pointer"
                                    title="Opciones"
                                  >
                                    <EllipsisHorizontalIcon className="h-5 w-5 text-gray-500" />
                                  </button>

                                  {menuOpenFor === sec.id && (
                                    <div
                                      ref={menuRef}
                                      className="absolute right-0 mt-1 w-48 bg-white rounded-md shadow-lg border border-gray-200 z-20"
                                    >
                                      <button
                                        type="button"
                                        onClick={(e) =>
                                          handleAgregarSubseccion(sec, e)
                                        }
                                        className="flex items-center gap-2 w-full px-3 py-2 text-left text-sm hover:bg-gray-100 transition cursor-pointer"
                                      >
                                        <PlusIcon className="h-4 w-4 text-indigo-600" />
                                        Agregar subsección
                                      </button>

                                      <button
                                        onClick={() =>
                                          handleRename(sec.id, sec.titulo)
                                        }
                                        className="flex items-center gap-2 w-full px-3 py-2 text-left text-sm hover:bg-gray-100 transition cursor-pointer"
                                      >
                                        <PencilIcon className="h-4 w-4 text-indigo-600" />
                                        Renombrar
                                      </button>

                                      <button
                                        onClick={() => handleDuplicate(sec)}
                                        className="flex items-center gap-2 w-full px-3 py-2 text-left text-sm hover:bg-gray-100 transition cursor-pointer"
                                      >
                                        <DocumentDuplicateIcon className="h-4 w-4 text-gray-600" />
                                        Duplicar
                                      </button>

                                      <button
                                        onClick={() => handleDelete(sec)}
                                        className="flex items-center gap-2 w-full px-3 py-2 text-left text-sm hover:bg-gray-100 transition cursor-pointer"
                                      >
                                        <TrashIcon className="h-4 w-4 text-red-600" />
                                        Eliminar
                                      </button>
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>
                          </div>

                          {editandoTituloSeccion === sec.id && (
                            <input
                              type="text"
                              value={nuevoTitulo}
                              onClick={(e) => e.stopPropagation()}
                              onMouseDown={(e) => e.stopPropagation()}
                              onChange={(e) => setNuevoTitulo(e.target.value)}
                              className="mt-2 w-full border rounded-md px-2 py-1 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
                              autoFocus
                              onBlur={() => {
                                if (
                                  nuevoTitulo.trim() &&
                                  nuevoTitulo !== sec.titulo
                                ) {
                                  onActualizarTitulo(sec.id, nuevoTitulo);
                                }

                                setEditandoTituloSeccion(null);
                              }}
                              onKeyDown={(e) => {
                                if (e.key === "Enter") {
                                  if (
                                    nuevoTitulo.trim() &&
                                    nuevoTitulo !== sec.titulo
                                  ) {
                                    onActualizarTitulo(sec.id, nuevoTitulo);
                                  }

                                  setEditandoTituloSeccion(null);
                                } else if (e.key === "Escape") {
                                  setEditandoTituloSeccion(null);
                                }
                              }}
                            />
                          )}
                        </li>
                      )}
                    </Draggable>
                  );
                })}

                {provided.placeholder}
              </ul>
            )}
          </Droppable>
        </DragDropContext>
      </div>
    </div>
  );
};
