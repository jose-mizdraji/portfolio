// ============================================
// Punto de entrada de la exportación: arma el modelo del documento,
// carga las fotos y genera el archivo en el navegador (no se sube nada
// a ningún servidor). Se importa recién cuando alguien pide una descarga.
// ============================================

import { buildDocModel, allImagePaths } from './model.js';
import { loadAll } from './images.js';

const FORMATOS = {
  pdf:  { ext: 'pdf',  image: { maxSide: 1800, quality: 0.86 } },
  docx: { ext: 'docx', image: { maxSide: 1600, quality: 0.85 } },
  odt:  { ext: 'odt',  image: { maxSide: 1600, quality: 0.85 } }
};

function saveBlob(blob, fileName) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  a.rel = 'noopener';
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30000);
}

export async function exportPortfolio({ format, cat, portfolio, sections, siteUrl, onProgress }) {
  const fmt = FORMATOS[format];
  if (!fmt) throw new Error(`Formato desconocido: ${format}`);

  const model = buildDocModel({ cat, portfolio, sections, siteUrl });
  const images = await loadAll(allImagePaths(model), fmt.image, onProgress);

  let blob;
  if (format === 'pdf') {
    const { buildPdf } = await import('./pdf.js');
    blob = await buildPdf(model, images);
  } else if (format === 'docx') {
    const { buildDocx } = await import('./docx.js');
    blob = buildDocx(model, images);
  } else {
    const { buildOdt } = await import('./odt.js');
    blob = buildOdt(model, images);
  }

  saveBlob(blob, `${model.nombreArchivo}.${fmt.ext}`);
  return { fileName: `${model.nombreArchivo}.${fmt.ext}`, size: blob.size };
}
