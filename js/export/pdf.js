// ============================================
// Exportación a PDF (A4 apaisado) con jsPDF.
// Portada · una página separadora por serie · una obra por página
// (foto grande + ficha técnica) · contacto.
// ============================================

import { fichaFilas, resumenSeccion } from './model.js';

// La librería vive en js/vendor/ (la política de seguridad solo permite scripts del propio sitio).
// Se carga recién cuando alguien pide el PDF.
let jspdfPromise = null;
function loadJsPdf() {
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

// Las fuentes estándar del PDF usan la codificación Windows-1252: se reemplaza
// lo que queda afuera (por ejemplo flechas o emojis) para que no salgan símbolos rotos.
const CP1252_EXTRA = new Set('€‚ƒ„…†‡ˆ‰Š‹ŒŽ‘’“”•–—˜™š›œžŸ'.split('').map(c => c.charCodeAt(0)));
function clean(text) {
  return String(text ?? '')
    .normalize('NFC')
    .replace(/[→➔]/g, '->')
    .replace(/[   ]/g, ' ')
    .replace(/[^\n\x20-\x7E¡-ÿ]/g, (ch) => (CP1252_EXTRA.has(ch.charCodeAt(0)) ? ch : ''));
}

const INK = [26, 26, 26];
const MUTED = [110, 110, 106];
const ACCENT = [139, 115, 85];
const RULE = [221, 218, 211];

const W = 297;
const H = 210;
const M = 16;            // margen
const FOOT_Y = 200;      // línea del pie

function lines(doc, text, width) {
  return clean(text).split('\n').flatMap(par => (par.trim() ? doc.splitTextToSize(par, width) : ['']));
}

// Dibuja texto en bloque; devuelve la coordenada Y siguiente. Recorta con "…" si pasa maxLines / maxY.
function block(doc, text, x, y, width, { font = 'helvetica', style = 'normal', size = 10, color = INK, lh = 1.45, maxLines = Infinity, maxY = Infinity, charSpace = 0 } = {}) {
  doc.setFont(font, style);
  doc.setFontSize(size);
  doc.setTextColor(...color);
  const step = size * 0.3528 * lh;
  let ls = lines(doc, text, width);
  const fit = Math.min(maxLines, Math.max(1, Math.floor((maxY - y) / step)));
  if (ls.length > fit) {
    ls = ls.slice(0, fit);
    ls[fit - 1] = ls[fit - 1].replace(/\s*\S{0,3}$/, '') + '…';
  }
  ls.forEach((l, i) => doc.text(l, x, y + i * step, charSpace ? { charSpace } : undefined));
  return y + ls.length * step;
}

function fitImage(img, boxW, boxH) {
  const r = Math.min(boxW / img.width, boxH / img.height);
  return { w: img.width * r, h: img.height * r };
}

function drawImage(doc, img, alias, bx, by, bw, bh, align = 'center') {
  if (!img) return false;
  const { w, h } = fitImage(img, bw, bh);
  const x = align === 'left' ? bx : bx + (bw - w) / 2;
  doc.addImage(img.bytes, 'JPEG', x, by + (bh - h) / 2, w, h, alias, 'FAST');
  return true;
}

function capitalize(s) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export async function buildPdf(model, images) {
  const JsPDF = await loadJsPdf();
  const doc = new JsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4', compress: true });
  doc.setProperties({
    title: clean(`${model.titulo} — ${model.artista}`),
    author: clean(model.artista),
    subject: 'Portfolio',
    creator: 'jose-mizdraji.github.io/portfolio'
  });

  const img = (o) => images.get(o.imagen) || null;
  const primera = model.secciones.flatMap(s => s.obras).find(o => img(o));

  // ----- Portada -----
  {
    const colW = 118;
    let y = 40;
    doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.setTextColor(...ACCENT);
    doc.text('PORTFOLIO', M + 2, y, { charSpace: 2.2 });
    y += 16;
    y = block(doc, model.artista, M + 2, y, colW, { font: 'times', size: 40, lh: 1.1 });
    doc.setDrawColor(...ACCENT); doc.setLineWidth(0.5); doc.line(M + 2, y + 2, M + 22, y + 2);
    y += 11;
    if (model.subtitulo) y = block(doc, model.subtitulo, M + 2, y, colW, { size: 11, color: MUTED }) + 8;
    y = block(doc, model.titulo, M + 2, y, colW, { font: 'times', style: 'italic', size: 20, lh: 1.25 }) + 3;
    if (model.destinatario) y = block(doc, model.destinatario, M + 2, y + 1, colW, { size: 11 }) + 2;
    if (model.descripcion) block(doc, model.descripcion, M + 2, y + 6, colW, { size: 9.5, color: MUTED, lh: 1.55, maxY: 170 });

    doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.setTextColor(...INK);
    doc.text(clean(capitalize(model.fecha)), M + 2, H - 28);
    doc.setFontSize(8); doc.setTextColor(...MUTED);
    doc.text(clean(model.url), M + 2, H - 22.5);

    if (primera) drawImage(doc, img(primera), primera.imagen, 150, M, W - M - 150, H - 2 * M, 'center');
  }

  // ----- Secciones -----
  const unaSolaSinTexto = model.secciones.length === 1 && !model.secciones[0].descripcion;
  model.secciones.forEach((sec, si) => {
    if (!unaSolaSinTexto) {
      doc.addPage();
      let y = 66;
      doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.setTextColor(...ACCENT);
      doc.text(sec.esSerie ? `SERIE ${String(si + 1).padStart(2, '0')}` : 'OBRAS', M + 2, y, { charSpace: 2 });
      y += 14;
      y = block(doc, sec.titulo, M + 2, y, 230, { font: 'times', size: 32, lh: 1.15 });
      y = block(doc, resumenSeccion(sec), M + 2, y + 2, 230, { size: 10, color: MUTED });
      doc.setDrawColor(...ACCENT); doc.setLineWidth(0.5); doc.line(M + 2, y + 5, M + 22, y + 5);
      if (sec.descripcion) block(doc, sec.descripcion, M + 2, y + 15, 175, { size: 12, lh: 1.65, color: [60, 60, 58], maxY: 185 });
    }

    // ----- Una obra por página -----
    sec.obras.forEach(o => {
      doc.addPage();
      const im = img(o);
      const imgBox = { x: M, y: M, w: 180, h: 176 };
      if (!drawImage(doc, im, o.imagen, imgBox.x, imgBox.y, imgBox.w, imgBox.h, 'center')) {
        doc.setFont('helvetica', 'italic'); doc.setFontSize(10); doc.setTextColor(...MUTED);
        doc.text('Imagen no disponible', imgBox.x + imgBox.w / 2, imgBox.y + imgBox.h / 2, { align: 'center' });
      }

      const tx = 206;
      const tw = W - M - tx;
      let y = 24;
      doc.setFont('helvetica', 'normal'); doc.setFontSize(7.5); doc.setTextColor(...MUTED);
      doc.text(clean(o.disciplina).toUpperCase(), tx, y, { charSpace: 1.4 });
      y += 9;
      y = block(doc, o.titulo, tx, y, tw, { font: 'times', size: 19, lh: 1.2, maxLines: 5 });
      if (o.serie) y = block(doc, `Serie: ${o.serie}`, tx, y + 3, tw, { font: 'times', style: 'italic', size: 11, color: MUTED });
      y += 6;
      doc.setDrawColor(...RULE); doc.setLineWidth(0.3); doc.line(tx, y, tx + tw, y);
      y += 6;

      for (const [k, v] of fichaFilas(o)) {
        doc.setFont('helvetica', 'normal'); doc.setFontSize(7); doc.setTextColor(...MUTED);
        doc.text(clean(k).toUpperCase(), tx, y, { charSpace: 1.2 });
        y = block(doc, v, tx, y + 4.6, tw, { size: 10.5, lh: 1.35, maxLines: 4 }) + 3.2;
      }

      if (o.descripcion) {
        y += 2;
        doc.setDrawColor(...RULE); doc.line(tx, y, tx + tw, y);
        block(doc, o.descripcion, tx, y + 6, tw, { size: 9, lh: 1.55, color: [70, 70, 68], maxY: 188 });
      }
    });
  });

  // ----- Contacto -----
  {
    doc.addPage();
    let y = 66;
    doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.setTextColor(...ACCENT);
    doc.text('CONTACTO', M + 2, y, { charSpace: 2 });
    y += 14;
    y = block(doc, model.artista, M + 2, y, 230, { font: 'times', size: 30, lh: 1.15 }) + 6;
    const filas = [['Email', model.contacto.email], ['Instagram', model.contacto.instagram], ['Facebook', model.contacto.facebook], ['Portfolio en línea', model.url]].filter(([, v]) => v);
    for (const [k, v] of filas) {
      doc.setFont('helvetica', 'normal'); doc.setFontSize(7.5); doc.setTextColor(...MUTED);
      doc.text(clean(k).toUpperCase(), M + 2, y, { charSpace: 1.2 });
      y = block(doc, v, M + 2, y + 5.5, 230, { size: 12 }) + 5;
    }
  }

  // ----- Pie de página (todas menos la portada) -----
  const total = doc.getNumberOfPages();
  for (let p = 2; p <= total; p++) {
    doc.setPage(p);
    doc.setDrawColor(...RULE); doc.setLineWidth(0.25); doc.line(M, FOOT_Y, W - M, FOOT_Y);
    doc.setFont('helvetica', 'normal'); doc.setFontSize(7.5); doc.setTextColor(...MUTED);
    doc.text(clean(`${model.artista}  ·  ${model.titulo}`), M, FOOT_Y + 5);
    doc.text(String(p), W - M, FOOT_Y + 5, { align: 'right' });
  }

  return doc.output('blob');
}
