// ============================================
// Exportación a PDF (A4 apaisado) con jsPDF.
// No decide nada de diseño: dibuja la maquetación de layout.js
// (la misma que usan Word y OpenDocument).
// ============================================

import { clean, W, H, ASCENT } from './layout.js';

const PT = 25.4 / 72;

// La librería vive en js/vendor/ (la política de seguridad solo permite scripts del propio sitio).
// Se carga recién cuando alguien pide un documento.
let jspdfPromise = null;
export function loadJsPdf() {
  if (window.jspdf && window.jspdf.jsPDF) return Promise.resolve(window.jspdf.jsPDF);
  if (!jspdfPromise) {
    jspdfPromise = new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = new URL('../vendor/jspdf.umd.min.js', import.meta.url).href;
      s.onload = () => (window.jspdf && window.jspdf.jsPDF ? resolve(window.jspdf.jsPDF) : reject(new Error('jsPDF no disponible')));
      s.onerror = () => reject(new Error('No se pudo cargar jsPDF'));
      document.head.appendChild(s);
    });
  }
  return jspdfPromise;
}

/** Documento jsPDF vacío con el formato del portfolio (también sirve para medir texto). */
export async function newPdfDoc() {
  const JsPDF = await loadJsPdf();
  return new JsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4', compress: true });
}

function drawText(doc, item, pageNumber) {
  let y = item.top;
  for (const p of item.paras) {
    for (const l of p.lines) {
      const base = y + l.row * p.pitch * PT + ASCENT * p.pitch * PT;
      doc.setFont(l.font, l.style);
      doc.setFontSize(l.size);
      doc.setTextColor(...l.color);
      let t = l.t === '{PAGE}' ? String(pageNumber) : clean(l.t);
      if (l.upper) t = t.toUpperCase();
      const opts = {};
      if (l.cs) opts.charSpace = l.cs;
      if (p.align === 'right') opts.align = 'right';
      else if (p.align === 'center') opts.align = 'center';
      if (t) doc.text(t, item.x + l.x, base, Object.keys(opts).length ? opts : undefined);
    }
    y += p.rows * p.pitch * PT + (p.after || 0) * PT;
  }
}

function drawItem(doc, item, images, pageNumber) {
  if (item.k === 'rect') {
    doc.setFillColor(...item.color);
    doc.rect(item.x, item.y, item.w, item.h, 'F');
  } else if (item.k === 'img') {
    const im = images.get(item.path);
    if (im) doc.addImage(im.bytes, 'JPEG', item.x, item.y, item.w, item.h, item.path, 'FAST');
  } else if (item.k === 'text') {
    drawText(doc, item, pageNumber);
  }
}

export function buildPdf(doc, layout, images, model) {
  doc.setProperties({
    title: clean(`${model.titulo} — ${model.artista}`),
    author: clean(model.artista),
    subject: 'Portfolio',
    creator: 'jose-mizdraji.github.io/portfolio'
  });

  // jsPDF ya trae una página en blanco: se usa para la primera.
  layout.pages.forEach((page, i) => {
    if (i > 0) doc.addPage();
    for (const item of page.items) drawItem(doc, item, images, i + 1);
    if (i > 0) for (const item of layout.footer.items) drawItem(doc, item, images, i + 1);
  });

  return doc.output('blob');
}

export { W, H };
