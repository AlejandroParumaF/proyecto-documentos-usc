// src/components/VistaPrevisualizacion.jsx
export const VistaPrevisualizacion = ({ contenido }) => {
  return (
    <div className="vista-previsualizacion max-w-none p-6">
      <style>{`
        .vista-previsualizacion {
          font-family: Arial, sans-serif;
          font-size: 10pt;
          line-height: 1.3;
          color: #111827;
          overflow-wrap: anywhere;
          word-break: break-word;
        }

        .vista-previsualizacion p {
          margin: 0;
        }

        .vista-previsualizacion img {
          max-width: 100%;
          height: auto;
        }

        .vista-previsualizacion table {
          width: 100%;
          max-width: 100%;
          border-collapse: collapse;
          table-layout: fixed;
          margin: 10px 0;
        }

        .vista-previsualizacion th,
        .vista-previsualizacion td {
          border: 1px solid #ccc;
          padding: 8px;
          vertical-align: top;
          overflow-wrap: anywhere;
          word-break: break-word;
        }

        .vista-previsualizacion th {
          font-weight: 700;
        }

        .vista-previsualizacion a {
          color: #2563eb;
          text-decoration: underline;
          overflow-wrap: anywhere;
          word-break: break-all;
        }
      `}</style>

      <div dangerouslySetInnerHTML={{ __html: contenido || "" }} />
    </div>
  );
};
