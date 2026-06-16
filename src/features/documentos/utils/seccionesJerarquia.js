// src/features/documentos/utils/seccionesJerarquia.js

export const construirArbolSecciones = (secciones = []) => {
  const mapa = new Map();
  const raices = [];

  secciones.forEach((sec) => {
    mapa.set(sec.id, { ...sec, children: [] });
  });

  mapa.forEach((sec) => {
    if (sec.parent_id && mapa.has(sec.parent_id)) {
      mapa.get(sec.parent_id).children.push(sec);
    } else {
      raices.push(sec);
    }
  });

  const ordenar = (items) => {
    items.sort((a, b) => (a.orden ?? 0) - (b.orden ?? 0));
    items.forEach((item) => ordenar(item.children));
  };

  ordenar(raices);

  return raices;
};

export const aplanarConNumeracion = (nodos = [], prefijo = []) => {
  return nodos.flatMap((nodo, index) => {
    const numero = [...prefijo, index + 1].join(".");
    const nivelCalculado = prefijo.length;

    return [
      {
        ...nodo,
        numero,
        nivelCalculado,
      },
      ...aplanarConNumeracion(nodo.children || [], [...prefijo, index + 1]),
    ];
  });
};
