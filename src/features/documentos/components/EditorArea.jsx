// src/features/documentos/components/EditorArea.jsx
import { Editor } from "@tinymce/tinymce-react";
import { supabase } from "../lib/supabase";

import { VistaPrevisualizacion } from "../../../components/VistaPrevisualizacion";
import { PanelComentarios } from "../../../components/PanelComentarios";
import { CheckBadgeIcon } from "@heroicons/react/24/outline";

export const EditorArea = ({
  seccionActiva,
  soloLectura,
  esRevisorSolo,
  role,
  permiso,
  user,
  documentoId,
  documento,
  margenLateralCm = 3,
  onCambiarMargenLateral,
  onAprobar,
  onSolicitarCorrecciones,
  onMarcarPendiente,
  onContentChange,
  filePickerCallback,
}) => {
  if (!seccionActiva) {
    return (
      <div className="bg-white rounded-lg shadow p-8 text-center text-gray-500">
        No hay secciones. Haz clic en "+" para crear una.
      </div>
    );
  }

  const margenSeguro = Number.isFinite(Number(margenLateralCm))
    ? Number(margenLateralCm)
    : 3;

  const puedeRevisar = role === "revisor";

  const cambiarMargenLateralDesdeEditor = () => {
    if (soloLectura) return;

    const valor = prompt(
      "Margen lateral en centímetros. Ejemplo: 2.5, 3, 3.5",
      String(margenSeguro),
    );

    if (valor === null) return;

    onCambiarMargenLateral?.(valor);
  };

  const aplicarTamanoFuentePersonalizado = (editor) => {
    const valor = prompt("Tamaño de fuente en puntos. Ejemplo: 9, 10.5, 13");

    if (valor === null) return;

    const numero = Number(valor.replace(",", "."));

    if (!Number.isFinite(numero) || numero <= 0) {
      alert("Ingresa un tamaño válido.");
      return;
    }

    editor.execCommand("FontSize", false, `${numero}pt`);
  };

  // Estos botones deben mostrarse aunque el revisor tenga permiso de lectura,
  // porque lectura bloquea edición de contenido, no acciones de revisión.
  const botonesRevisor = puedeRevisar && (
    <div className="flex flex-wrap gap-2">
      {seccionActiva.estado_revision !== "aprobado" && (
        <button
          type="button"
          onClick={onAprobar}
          className="bg-green-600 hover:bg-green-700 text-white px-3 py-1 rounded-md text-sm cursor-pointer"
        >
          Aprobar
        </button>
      )}

      {seccionActiva.estado_revision !== "correcciones" && (
        <button
          type="button"
          onClick={onSolicitarCorrecciones}
          className="bg-orange-600 hover:bg-orange-700 text-white px-3 py-1 rounded-md text-sm cursor-pointer"
        >
          Solicitar correcciones
        </button>
      )}

      {seccionActiva.estado_revision === "correcciones" && (
        <button
          type="button"
          onClick={onMarcarPendiente}
          className="bg-yellow-600 hover:bg-yellow-700 text-white px-3 py-1 rounded-md text-sm cursor-pointer"
        >
          Marcar como pendiente
        </button>
      )}
    </div>
  );

  // Modo revisor con permiso de lectura: no edita contenido, pero sí puede revisar.
  if (esRevisorSolo) {
    return (
      <div className="w-full max-w-[816px] bg-white shadow-xl rounded-lg flex flex-col h-full">
        <div className="border-b p-4 bg-gray-50 flex flex-col gap-3 sm:flex-row sm:justify-between sm:items-center">
          <h2 className="text-xl font-bold text-gray-800">
            {seccionActiva.titulo}
          </h2>
          {botonesRevisor}
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          <VistaPrevisualizacion contenido={seccionActiva.contenido} />
        </div>

        <div className="border-t p-4">
          <PanelComentarios
            seccionId={seccionActiva.id}
            documentoId={documentoId}
            permiso={permiso}
            usuario={user}
            userRole={role}
          />
        </div>
      </div>
    );
  }

  const ejecutarAsistenteIA = async (editor, accion) => {
    try {
      if (soloLectura) {
        alert("No puedes usar el asistente IA en modo solo lectura.");
        return;
      }

      const contenidoSeleccionado = editor.selection.getContent({
        format: "html",
      });

      const contenidoCompleto = editor.getContent();

      const contenidoParaEnviar =
        contenidoSeleccionado?.trim() || contenidoCompleto?.trim();

      if (!contenidoParaEnviar) {
        alert("No hay contenido para procesar.");
        return;
      }

      const confirmar = window.confirm(
        contenidoSeleccionado
          ? "La IA procesará el texto seleccionado. ¿Deseas continuar?"
          : "No seleccionaste texto. La IA procesará toda la sección. ¿Deseas continuar?",
      );

      if (!confirmar) return;

      const { data, error } = await supabase.functions.invoke(
        "asistente-editor",
        {
          body: {
            accion,
            contenido: contenidoParaEnviar,
            tituloSeccion: seccionActiva?.titulo || "",
            tituloDocumento: documento?.titulo || "",
            tipoDocumento: documento?.tipo_documento || "",
          },
        },
      );

      if (error) {
        console.error(error);
        alert("No se pudo ejecutar el asistente IA.");
        return;
      }

      if (data?.error) {
        console.error(data.error);
        alert(data.error);
        return;
      }

      const resultado = data?.resultado;

      if (!resultado) {
        alert("La IA no devolvió contenido.");
        return;
      }

      const aceptar = window.confirm(
        contenidoSeleccionado
          ? "¿Deseas reemplazar el texto seleccionado con la sugerencia de IA?"
          : "¿Deseas reemplazar el contenido completo de la sección con la sugerencia de IA?",
      );

      if (!aceptar) return;

      if (contenidoSeleccionado) {
        editor.selection.setContent(resultado);
      } else {
        editor.setContent(resultado);
      }

      const nuevoContenido = editor.getContent();
      onContentChange(nuevoContenido);
    } catch (error) {
      console.error(error);
      alert("Ocurrió un error usando el asistente IA.");
    }
  };

  // Modo editor normal: dueño, editor o revisor con escritura.
  return (
    <div className="w-full max-w-[816px] bg-white shadow-xl rounded-lg flex flex-col h-full relative">
      {seccionActiva.estado_revision === "aprobado" && (
        <div className="absolute top-4 right-4 bg-green-100 text-green-700 text-xs px-2 py-1 rounded-full flex items-center gap-1 z-10">
          <CheckBadgeIcon className="h-3 w-3" /> Aprobado
        </div>
      )}

      <div className="border-b p-4 bg-gray-50 flex justify-end">
        {botonesRevisor}
      </div>

      <div className="flex-1 min-h-0">
        <Editor
          key={`${seccionActiva.id}-${margenSeguro}`}
          tinymceScriptSrc={`${import.meta.env.BASE_URL}tinymce/tinymce.min.js`}
          licenseKey="gpl"
          value={seccionActiva.contenido || ""}
          onEditorChange={onContentChange}
          disabled={soloLectura}
          init={{
            height: "100%",
            menubar: true,
            paste_data_images: true,
            paste_as_text: false,
            plugins: [
              "advlist",
              "autolink",
              "lists",
              "link",
              "image",
              "charmap",
              "preview",
              "anchor",
              "searchreplace",
              "visualblocks",
              "code",
              "fullscreen",
              "insertdatetime",
              "media",
              "table",
              "wordcount",
              "codesample",
              "pagebreak",
            ],
            toolbar: [
              "undo redo | blocks fontfamily customFontSize fontsize | asistenteIA | bold italic underline strikethrough | forecolor backcolor",
              "alignleft aligncenter alignright alignjustify | bullist numlist outdent indent",
              "link image table codesample | pagebreak | marginLateralButton | removeformat | fullscreen code",
            ].join(" "),
            setup: (editor) => {
              editor.ui.registry.addButton("customFontSize", {
                text: "Font Size",
                tooltip: "Tamaño de fuente personalizado",
                onAction: () => aplicarTamanoFuentePersonalizado(editor),
              });

              editor.ui.registry.addMenuButton("asistenteIA", {
                text: "IA",
                tooltip: "Asistente IA de escritura",
                enabled: !soloLectura,
                fetch: (callback) => {
                  callback([
                    {
                      type: "menuitem",
                      text: "Mejorar redacción",
                      onAction: () =>
                        ejecutarAsistenteIA(editor, "mejorar_redaccion"),
                    },
                    {
                      type: "menuitem",
                      text: "Corregir ortografía y gramática",
                      onAction: () => ejecutarAsistenteIA(editor, "corregir"),
                    },
                    {
                      type: "menuitem",
                      text: "Hacer más académico",
                      onAction: () => ejecutarAsistenteIA(editor, "academico"),
                    },
                    {
                      type: "menuitem",
                      text: "Resumir",
                      onAction: () => ejecutarAsistenteIA(editor, "resumir"),
                    },
                  ]);
                },
              });

              editor.ui.registry.addButton("marginLateralButton", {
                text: `Margen ${margenSeguro}cm`,
                tooltip: "Cambiar margen lateral del documento",
                enabled: !soloLectura,
                onAction: cambiarMargenLateralDesdeEditor,
              });
            },
            pagebreak_separator: "--- Salto de página ---",
            pagebreak_split_block: true,
            content_style: `
              body {
                font-family: 'Arial', sans-serif;
                font-size: 10pt;
                line-height: 1;
                max-width: 100%;
                margin-top: 2.5cm;
                margin-bottom: 2.5cm;
                margin-left: ${margenSeguro}cm;
                margin-right: ${margenSeguro}cm;
                background: white;
                overflow-wrap: anywhere;
                word-break: break-word;
              }

              p {
                margin: 0;
              }

              p,
              li,
              div,
              span,
              a,
              td,
              th {
                overflow-wrap: anywhere;
                word-break: break-word;
              }

              a {
                color: #2563eb;
                text-decoration: underline;
                overflow-wrap: anywhere;
                word-break: break-all;
              }

              img {
                max-width: 100%;
                height: auto;
              }

              table {
                width: 100%;
                max-width: 100%;
                border-collapse: collapse;
                table-layout: fixed;
              }

              th,
              td {
                border: 1px solid #ccc;
                padding: 8px;
                overflow-wrap: anywhere;
                word-break: break-word;
              }
            `,
            fontsize_formats: "8pt 10pt 12pt 14pt 18pt 24pt 36pt 48pt",
            font_family_formats:
              "Arial=arial,helvetica,sans-serif; Courier New=courier new,courier,monospace; Georgia=georgia,serif; Times New Roman=times new roman,times,serif; Verdana=verdana,geneva,sans-serif",
            readonly: soloLectura,
            file_picker_callback: filePickerCallback,
          }}
        />
      </div>

      <div className="border-t p-4">
        <PanelComentarios
          seccionId={seccionActiva.id}
          documentoId={documentoId}
          permiso={permiso}
          usuario={user}
          userRole={role}
        />
      </div>
    </div>
  );
};
