// ============================================
// Maquetación del documento (A4 apaisado) — UNA sola para los tres formatos.
//
// Acá se decide qué va en cada página y en qué posición exacta (en mm):
// textos, fotos y líneas. Después PDF, Word y OpenDocument solo "dibujan"
// esa misma lista de elementos, por eso los tres salen iguales:
//
//   { k:'text', x, top, w, h, paras:[…] }   cuadro de texto (editable en Word/ODT)
//   { k:'img',  x, y, w, h, path, alt }     foto
//   { k:'rect', x, y, w, h, color }         línea o filete (rectángulo muy fino)
//
// Cada párrafo de un cuadro de texto lleva dos cosas:
//   · runs  → el texto "de verdad" (lo que se edita en Word/ODT)
//   · lines → cómo se partió en renglones (lo que dibuja el PDF)
// Las fuentes son Helvetica y Times (las estándar del PDF), que en Word/ODT
// se escriben como Arial y Times New Roman: tienen las mismas medidas, así
// que los renglones se cortan en el mismo lugar.
// ============================================

import { fichaFilas, resumenSeccion } from './model.js';
import { textWidth } from './metrics.js';

export const W = 297;
export const H = 210;
export const M = 16;            // margen
export const FOOT_Y = 200;      // línea del pie

const PT = 25.4 / 72;           // milímetros por punto
// Con interlineado exacto, la base del primer renglón queda al 80 % de la altura del renglón
// (así lo hacen Word y LibreOffice). Con esto se calcula dónde arranca cada cuadro de texto.
export const ASCENT = 0.8;

export const COLOR = {
  INK: [26, 26, 26],
  MUTED: [110, 110, 106],
  ACCENT: [139, 115, 85],
  RULE: [221, 218, 211],
  SOFT: [60, 60, 58],
  SOFT2: [70, 70, 68]
};
const { INK, MUTED, ACCENT, RULE, SOFT, SOFT2 } = COLOR;

// Las fuentes estándar del PDF usan la codificación Windows-1252: se reemplaza
// lo que queda afuera (por ejemplo flechas o emojis) para que no salgan símbolos rotos.
const CP1252_EXTRA = new Set('€‚ƒ„…†‡ˆ‰Š‹ŒŽ‘’“”•–—˜™š›œžŸ'.split('').map(c => c.charCodeAt(0)));
export function clean(text) {
  return String(text ?? '')
    .normalize('NFC')
    .replace(/[→➔]/g, '->')
    .replace(/[   ]/g, ' ')
    .replace(/[^\n\x20-\x7E¡-ÿ]/g, (ch) => (CP1252_EXTRA.has(ch.charCodeAt(0)) ? ch : ''));
}

function capitalize(s) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function fitImage(img, boxW, boxH) {
  const r = Math.min(boxW / img.width, boxH / img.height);
  return { w: img.width * r, h: img.height * r };
}

/**
 * Posición y ancho del cuadro de texto para Word / OpenDocument.
 * Se agrega una pizca de ancho (0,5 mm) y el MISMO margen se usa al cortar los renglones del PDF
 * (ver wrap): así, si un renglón entra justo, los tres formatos coinciden aunque Word y LibreOffice
 * redondeen las medidas de las letras una centésima distinto.
 */
export const WRAP_SLACK = 0.5;
export function editorBox(item) {
  const align = item.paras[0] ? item.paras[0].align : 'left';
  const w = item.w + WRAP_SLACK;
  const x = align === 'right' ? item.x - WRAP_SLACK : align === 'center' ? item.x - WRAP_SLACK / 2 : item.x;
  return { x, w };
}


/**
 * Reparte un texto en renglones de hasta `max` mm. `medir(s)` da el ancho de un texto en mm.
 * Una palabra más ancha que el renglón se parte por letras (igual que hacen Word y LibreOffice).
 */
function cortarRenglones(t, max, medir) {
  const lines = [];
  let line = '';
  const poner = (piece, conEspacio) => {
    const candidato = conEspacio && line !== '' ? `${line} ${piece}` : line + piece;
    if (line === '' || medir(candidato) <= max) { line = candidato; return; }
    lines.push(line);
    line = piece;
  };
  const ponerLarga = (piece, conEspacio) => {
    if (conEspacio && line !== '') { lines.push(line); line = ''; }   // arranca renglón propio
    for (const ch of piece) {
      if (line !== '' && medir(line + ch) > max) { lines.push(line); line = ch; } else line += ch;
    }
  };
  for (const token of t.split(' ')) {
    token.split(/(?<=[-–—])(?=\p{L})/u).forEach((piece, i) => {
      if (piece.length > 1 && medir(piece) > max) ponerLarga(piece, i === 0);
      else poner(piece, i === 0);
    });
  }
  lines.push(line);
  return lines;
}

// ---------- Constructor de páginas ----------

class Layout {
  constructor(doc, images) {
    this.doc = doc;           // jsPDF: solo se usa para MEDIR texto (mismas medidas que el PDF final)
    this.images = images;
    this.pages = [];
    this.page = null;
  }

  newPage() {
    this.page = { items: [] };
    this.pages.push(this.page);
    return this.page;
  }

  /**
   * Parte un texto de un solo párrafo en renglones del ancho dado.
   * Mide con los anchos exactos de Arial / Times (metrics.js) y corta donde cortan Word y LibreOffice:
   * en los espacios y justo después de un guion o una raya seguidos de una letra («Pre-Bienal», «–Osvaldo»).
   * El límite lleva la misma tolerancia (WRAP_SLACK) que el cuadro de texto de Word/ODT, así los tres
   * formatos deciden igual en los casos justos.
   */
  wrap(text, width, { font = 'helvetica', style = 'normal', size = 10 } = {}) {
    const t = clean(text);
    if (!t.trim()) return [''];
    return cortarRenglones(t, width + WRAP_SLACK, (s) => textWidth(s, font, style, size));
  }

  rect(x, y, w, h, color) {
    this.page.items.push({ k: 'rect', x, y, w, h, color });
  }

  /** Fila horizontal fina centrada en y (equivale a una línea de grosor lw). */
  rule(x1, x2, y, lw, color) {
    this.rect(x1, y - lw / 2, x2 - x1, lw, color);
  }

  /** Foto dentro de una caja, sin deformarla. Devuelve false si la foto no se cargó. */
  image(path, bx, by, bw, bh, alt = '', align = 'center') {
    const img = path ? this.images.get(path) : null;
    if (!img) return false;
    const { w, h } = fitImage(img, bw, bh);
    const x = align === 'left' ? bx : bx + (bw - w) / 2;
    this.page.items.push({ k: 'img', x, y: by + (bh - h) / 2, w, h, path, alt });
    return true;
  }

  /** Agrega un cuadro de texto ya armado. */
  box({ x, top, w, paras }) {
    const mm = (p) => p.rows * p.pitch * PT + (p.after || 0) * PT;
    const h = paras.reduce((n, p) => n + mm(p), 0);
    this.page.items.push({ k: 'text', x, top, w, h, paras });
    return h;
  }

  /**
   * Texto en bloque posicionado por la BASE del primer renglón (y), igual que antes.
   * Devuelve la Y siguiente (y + renglones × interlineado).
   * Si no entra en maxLines / maxY se recorta con «…».
   * Las líneas en blanco del texto (\n\n) separan párrafos.
   */
  text(str, x, y, width, {
    font = 'helvetica', style = 'normal', size = 10, color = INK, lh = 1.45,
    maxLines = Infinity, maxY = Infinity, cs = 0, upper = false, wrap = true, align = 'left'
  } = {}) {
    const source = String(str ?? '');
    const partsSrc = source.split('\n');
    const partsClean = clean(source).split('\n');
    const pitch = size * lh;                  // pt
    const step = pitch * PT;                  // mm

    const wrapped = partsClean.map(par => (par.trim() ? (wrap ? this.wrap(par, width, { font, style, size }) : [par]) : ['']));
    let all = wrapped.flat();
    const fit = Math.min(maxLines, Math.max(1, Math.floor((maxY - y) / step)));
    const truncated = all.length > fit;
    if (truncated) {
      all = all.slice(0, fit);
      all[fit - 1] = all[fit - 1].replace(/\s*\S{0,3}$/, '') + '…';
    }
    if (!all.length) return y;

    // Reparte los renglones que quedaron entre los párrafos originales.
    const style0 = { font, style, size, color, cs, upper };
    const paras = [];
    let used = 0;
    partsSrc.forEach((srcPart, i) => {
      const n = wrapped[i].length;
      if (used >= all.length) return;
      const mine = all.slice(used, used + n);
      used += n;
      if (!srcPart.trim()) {                  // renglón en blanco = aire entre párrafos
        if (paras.length) paras[paras.length - 1].after += pitch;
        else paras.push({ runs: [{ t: '', ...style0 }], pitch, after: 0, left: 0, hang: 0, align, rows: 1, lines: [{ t: '', x: 0, row: 0, ...style0 }] });
        return;
      }
      const t = truncated ? mine.join(' ') : srcPart;
      paras.push({
        runs: [{ t: t.normalize('NFC'), ...style0 }],
        pitch, after: 0, left: 0, hang: 0, align, rows: mine.length,
        lines: mine.map((l, i) => ({ t: l, x: align === 'right' ? width : align === 'center' ? width / 2 : 0, row: i, ...style0 }))
      });
    });
    if (!paras.length) return y;
    // un renglón en blanco al final no cuenta como párrafo
    while (paras.length > 1 && !paras[paras.length - 1].runs[0].t && paras[paras.length - 1].lines.every(l => !l.t)) paras.pop();

    this.box({ x, top: y - ASCENT * step, w: width, paras });
    return y + all.length * step;
  }
}

// ---------- Cuadros de texto de lista (año + título + lugar) ----------

const ENTRY = { size: 10, lh: 1.42, subSize: 8.5, yearSize: 9, hang: 15, after: 2.4 };   // after: mm

// Los espacios repetidos (y los saltos) de los datos se juntan: Word y LibreOffice los cortan distinto que el PDF.
// También se acomoda la puntuación con el espacio al revés («palabra .Otra» → «palabra. Otra»):
// después de un espacio, un punto o una coma no admiten corte de renglón en LibreOffice y Word los trata distinto.
const limpiar = (s) => String(s ?? '')
  .replace(/\s+/g, ' ')
  .replace(/ ([.,;:!?])(?=[\p{L}\p{N}])/gu, '$1 ')
  .replace(/ ([.,;:!?)\]])/g, '$1')
  .trim();

/** opts.sinAño: la lista no tiene ningún año → sin sangría para el año. */
function entryPara(L, e0, colW, opts = {}) {
  const e = { año: limpiar(e0.año), titulo: limpiar(e0.titulo), sub: limpiar(e0.sub) };
  const hang = opts.sinAño ? 0 : ENTRY.hang;
  const pitch = ENTRY.size * ENTRY.lh;
  const year = { font: 'helvetica', style: 'normal', size: ENTRY.yearSize, color: ACCENT, cs: 0.2, upper: false };
  const title = { font: 'helvetica', style: 'normal', size: ENTRY.size, color: INK, cs: 0, upper: false };
  const sub = { font: 'helvetica', style: 'normal', size: ENTRY.subSize, color: MUTED, cs: 0, upper: false };

  const titleLines = L.wrap(e.titulo || '', colW - hang, title);
  const subLines = e.sub ? L.wrap(e.sub, colW - hang, sub) : [];

  // Renglones para el PDF: el año comparte renglón con el primero del título.
  const lines = [];
  if (e.año) lines.push({ t: String(e.año), x: 0, row: 0, ...year });
  titleLines.forEach((t, i) => lines.push({ t, x: hang, row: i, ...title }));
  subLines.forEach((t, i) => lines.push({ t, x: hang, row: titleLines.length + i, ...sub }));

  // Texto para Word/ODT: «año ⇥ título ⏎ lugar» con sangría francesa, así se puede escribir como una lista.
  const runs = [];
  if (e.año) runs.push({ t: String(e.año), ...year });
  if (hang) runs.push({ tab: true });
  runs.push({ t: e.titulo || '', ...title });
  if (e.sub) runs.push({ br: true }, { t: e.sub, ...sub });

  return {
    runs, pitch, after: ENTRY.after / PT, left: hang, hang, align: 'left',
    lines, rows: titleLines.length + subLines.length, splittable: false
  };
}

function paragraphPara(L, text, colW, o) {
  const { size = 10, lh = 1.65, color = SOFT } = o;
  const style0 = { font: 'helvetica', style: 'normal', size, color, cs: 0, upper: false };
  const ls = L.wrap(text, colW, style0);
  const pitch = size * lh;
  return {
    runs: [{ t: String(text).normalize('NFC'), ...style0 }],
    pitch, after: pitch * 0.55, left: 0, hang: 0, align: 'left',
    lines: ls.map((t, i) => ({ t, x: 0, row: i, ...style0 })), rows: ls.length, splittable: true, __text: text, __style: style0
  };
}

function headingPara(text, o = {}) {
  const style0 = { font: 'helvetica', style: 'normal', size: 7.5, color: MUTED, cs: 1.2, upper: true };
  const pitch = 7.5 * 1.5;
  return {
    runs: [{ t: text, ...style0 }], pitch, after: pitch * 0.45, left: 0, hang: 0, align: 'left',
    lines: [{ t: text, x: 0, row: 0, ...style0 }], rows: 1, splittable: false, gap: o.gap ?? 7,
    keepNext: true   // un título nunca queda solo al pie de una columna
  };
}

// ---------- Flujo en columnas (para Trayectoria, Premios, Exposiciones, Presentación) ----------

/**
 * Reparte párrafos en columnas y páginas. Cada columna de cada página termina siendo
 * UN cuadro de texto con varios párrafos (como una lista que se puede escribir).
 * paraList: párrafos ya medidos (entryPara / paragraphPara / headingPara).
 * area: { cols:[{x,w}], top, bottom }
 * newPage(n): crea la página (n = 0 la primera, 1, 2… las de continuación) y devuelve su área.
 */
function flow(L, paraList, area, newPage) {
  let pageNo = 0;
  let colIdx = 0;
  let col = null;

  const startPage = () => {
    L.newPage();
    newPage(pageNo++);
    colIdx = 0;
    openCol();
  };
  const openCol = () => {
    col = { x: area.cols[colIdx].x, w: area.cols[colIdx].w, top: area.top, y: area.top, paras: [] };
  };
  const flush = () => {
    if (col && col.paras.length) {
      // lo que se dibuja y lo que se edita sale del mismo párrafo
      const paras = col.paras.map(p => ({ ...p, lines: p.lines.map(l => ({ ...l })) }));
      L.box({ x: col.x, top: col.top, w: col.w, paras });
    }
  };
  const nextCol = () => {
    flush();
    if (colIdx + 1 < area.cols.length) { colIdx++; openCol(); } else startPage();
  };
  const height = (p) => p.rows * p.pitch * PT + p.after * PT;

  startPage();
  for (let i = 0; i < paraList.length; i++) {
    let p = paraList[i];
    // Un título viaja con lo que le sigue: si no entran juntos, pasa a la columna siguiente.
    if (p.keepNext && col.paras.length && paraList[i + 1]) {
      const sig = paraList[i + 1];
      const sigMin = sig.splittable ? Math.min(sig.rows, 2) * sig.pitch * PT : height(sig);
      const gapH = p.gap ? p.gap * 0.3528 : 0;
      if (col.y + gapH + height(p) + sigMin > area.bottom + 0.01) nextCol();
    }
    const gap = p.gap && col.paras.length ? p.gap * 0.3528 : 0;
    if (gap) {
      const last = col.paras[col.paras.length - 1];
      last.after += gap / PT;
      col.y += gap;
    }
    // ¿entra entero?
    while (true) {
      const room = area.bottom - col.y;
      if (height(p) <= room + 0.01) break;
      if (p.splittable) {
        const step = p.pitch * PT;
        let fit = Math.floor(room / step);
        if (fit >= 2) {
          if (p.rows - fit === 1) fit -= 1;           // no dejar un renglón huérfano
          if (fit >= 2) {
            const [a, b] = splitPara(L, p, fit);
            col.paras.push(a); col.y += height(a);
            p = b;
          }
        }
        nextCol();
        continue;
      }
      if (col.paras.length === 0) break;              // más alto que la columna: se pone igual
      nextCol();
    }
    col.paras.push(p);
    col.y += height(p);
  }
  flush();
}

function splitPara(L, p, fit) {
  const first = p.lines.slice(0, fit);
  const rest = p.lines.slice(fit).map((l, i) => ({ ...l, row: i }));
  // El texto editable se parte en el mismo lugar que los renglones (sin meter un espacio si se cortó tras un guion).
  const full = limpiar(p.__text ?? p.runs[0].t);
  let t1, t2;
  if (clean(full) === full) {
    let pos = 0;
    for (const l of first) { pos += l.t.length; if (full[pos] === ' ') pos++; }
    t1 = full.slice(0, pos).trim();
    t2 = full.slice(pos).trim();
  } else {
    t1 = first.map(l => l.t).join(' ');
    t2 = rest.map(l => l.t).join(' ');
  }
  const mk = (ls, t, after) => ({
    ...p, lines: ls, rows: ls.length, after,
    runs: [{ ...p.runs[0], t }], __text: t
  });
  return [mk(first, t1, 0), mk(rest, t2, p.after)];
}

// ---------- El documento ----------

export function layoutDocument(model, images, doc) {
  const L = new Layout(doc, images);

  // ----- Portada -----
  // Si la descripción no entra en la portada, va completa en una página propia («Presentación»)
  // en vez de cortarse con «…».
  let descripcionAparte = false;

  L.newPage();
  {
    const colW = 118;
    let y = 40;
    L.text('Portfolio', M + 2, y, 100, { size: 9, color: ACCENT, cs: 2.2, upper: true, wrap: false });
    y += 16;
    y = L.text(model.artista, M + 2, y, colW, { font: 'times', size: 40, lh: 1.1 });
    L.rule(M + 2, M + 22, y + 2, 0.5, ACCENT);
    y += 11;
    if (model.subtitulo) y = L.text(model.subtitulo, M + 2, y, colW, { size: 11, color: MUTED }) + 8;
    y = L.text(model.titulo, M + 2, y, colW, { font: 'times', style: 'italic', size: 20, lh: 1.25 }) + 3;
    if (model.destinatario) y = L.text(model.destinatario, M + 2, y + 1, colW, { size: 11 }) + 2;
    if (model.descripcion) {
      const o = { size: 9.5, color: MUTED, lh: 1.55 };
      const room = Math.floor((170 - (y + 6)) / (9.5 * 1.55 * PT));
      const parrafos = model.descripcion.split('\n');
      const total = parrafos.reduce((s, t) => s + (t.trim() ? L.wrap(t, colW, o).length : 1), 0);
      if (total <= room) L.text(model.descripcion, M + 2, y + 6, colW, { ...o, maxY: 170 });
      else descripcionAparte = true;
    }

    L.text(capitalize(model.fecha), M + 2, H - 28, 100, { size: 9, wrap: false });
    L.text(model.url, M + 2, H - 22.5, 200, { size: 8, color: MUTED, wrap: false });

    // Foto de portada: la elegida y, si no se pudo cargar, la primera obra
    const portada = [model.portada, model.portadaAuto].find(p => p && images.get(p));
    if (portada) L.image(portada, 150, M, W - M - 150, H - 2 * M, model.titulo, 'center');
  }

  // ----- Páginas de texto y listas (Presentación, Trayectoria, Premios, Exposiciones) -----
  const COLS = [{ x: M + 2, w: 123 }, { x: M + 2 + 123 + 15, w: 123 }];
  const AREA = { cols: COLS, top: 70, bottom: 193 };

  function paginasDeTexto({ titulo, resumen, parrafos }) {
    flow(L, parrafos, AREA, (n) => {
      L.text(model.artista, M + 2, 28, 200, { size: 9, color: ACCENT, cs: 2, upper: true, wrap: false });
      L.text(n ? `${titulo} (cont.)` : titulo, M + 2, 42, 230, { font: 'times', size: 30, lh: 1.15, wrap: false });
      if (resumen && !n) L.text(resumen, M + 2, 52, 230, { size: 10, color: MUTED, wrap: false });
      L.rule(M + 2, M + 22, 59, 0.5, ACCENT);
    });
  }

  const textoEnParrafos = (t) => String(t || '').split(/\n+/).map(limpiar).filter(Boolean);
  const plural = (n, uno, varios) => `${n} ${n === 1 ? uno : varios}`;

  const ex = model.extras || {};
  const cvPaginas = () => {
    if (ex.trayectoria) {
      const t = ex.trayectoria;
      const ps = textoEnParrafos(t.texto).map(x => paragraphPara(L, x, COLS[0].w, { size: 10, lh: 1.65 }));
      if (t.formacion && t.formacion.length) {
        ps.push(headingPara('Formación, becas y clínicas', { gap: 9 }));
        const sinAño = !t.formacion.some(f => limpiar(f.año));
        t.formacion.forEach(f => ps.push(entryPara(L, { año: f.año, titulo: f.titulo, sub: f.institucion }, COLS[0].w, { sinAño })));
      }
      const sub = [model.nacimiento, model.tituloProfesional].filter(Boolean).join('  ·  ');
      paginasDeTexto({ titulo: 'Trayectoria', resumen: sub, parrafos: ps });
    }
    if (ex.premios) {
      const sinAño = !ex.premios.items.some(e => limpiar(e.año));
      const ps = ex.premios.items.map(e => entryPara(L, { año: e.año, titulo: e.titulo, sub: e.lugar }, COLS[0].w, { sinAño }));
      paginasDeTexto({ titulo: 'Premios y distinciones', resumen: plural(ps.length, 'premio', 'premios'), parrafos: ps });
    }
    if (ex.exposiciones) {
      for (const [clave, titulo, uno, varios] of [['individuales', 'Exposiciones individuales', 'exposición', 'exposiciones'], ['colectivas', 'Exposiciones colectivas', 'exposición', 'exposiciones']]) {
        const lista = ex.exposiciones[clave] || [];
        if (!lista.length) continue;
        const sinAño = !lista.some(e => limpiar(e.año));
        const ps = lista.map(e => entryPara(L, { año: e.año, titulo: e.titulo, sub: e.lugar }, COLS[0].w, { sinAño }));
        paginasDeTexto({ titulo, resumen: plural(ps.length, uno, varios), parrafos: ps });
      }
    }
  };

  if (descripcionAparte) {
    const ps = textoEnParrafos(model.descripcion).map(x => paragraphPara(L, x, COLS[0].w, { size: 10.5, lh: 1.65 }));
    paginasDeTexto({ titulo: 'Presentación', resumen: model.titulo, parrafos: ps });
  }
  if (ex.ubicacion === 'inicio') cvPaginas();

  // ----- Secciones y obras -----
  const unaSolaSinTexto = model.secciones.length === 1 && !model.secciones[0].descripcion;
  model.secciones.forEach((sec, si) => {
    if (!unaSolaSinTexto) {
      L.newPage();
      let y = 66;
      L.text(sec.esSerie ? `Serie ${String(si + 1).padStart(2, '0')}` : 'Obras', M + 2, y, 100, { size: 9, color: ACCENT, cs: 2, upper: true, wrap: false });
      y += 14;
      y = L.text(sec.titulo, M + 2, y, 230, { font: 'times', size: 32, lh: 1.15 });
      y = L.text(resumenSeccion(sec), M + 2, y + 2, 230, { size: 10, color: MUTED });
      L.rule(M + 2, M + 22, y + 5, 0.5, ACCENT);
      if (sec.descripcion) L.text(sec.descripcion, M + 2, y + 15, 175, { size: 12, lh: 1.65, color: SOFT, maxY: 185 });
    }

    // ----- Una obra por página -----
    sec.obras.forEach(o => {
      L.newPage();
      const box = { x: M, y: M, w: 180, h: 176 };
      if (!L.image(o.imagen, box.x, box.y, box.w, box.h, o.titulo, 'center')) {
        L.text('Imagen no disponible', box.x, box.y + box.h / 2, box.w, { style: 'italic', size: 10, color: MUTED, align: 'center', wrap: false });
      }

      const tx = 206;
      const tw = W - M - tx;
      let y = 24;
      L.text(o.disciplina, tx, y, tw, { size: 7.5, color: MUTED, cs: 1.4, upper: true, wrap: false });
      y += 9;
      y = L.text(o.titulo, tx, y, tw, { font: 'times', size: 19, lh: 1.2, maxLines: 5 });
      if (o.serie) y = L.text(`Serie: ${o.serie}`, tx, y + 3, tw, { font: 'times', style: 'italic', size: 11, color: MUTED });
      y += 6;
      L.rule(tx, tx + tw, y, 0.3, RULE);
      y += 6;

      for (const [k, v] of fichaFilas(o)) {
        L.text(k, tx, y, tw, { size: 7, color: MUTED, cs: 1.2, upper: true, wrap: false });
        y = L.text(v, tx, y + 4.6, tw, { size: 10.5, lh: 1.35, maxLines: 4 }) + 3.2;
      }

      if (o.descripcion) {
        y += 2;
        L.rule(tx, tx + tw, y, 0.3, RULE);
        L.text(o.descripcion, tx, y + 6, tw, { size: 9, lh: 1.55, color: SOFT2, maxY: 188 });
      }
    });
  });

  if (ex.ubicacion !== 'inicio') cvPaginas();

  // ----- Contacto -----
  {
    L.newPage();
    let y = 66;
    L.text('Contacto', M + 2, y, 100, { size: 9, color: ACCENT, cs: 2, upper: true, wrap: false });
    y += 14;
    y = L.text(model.artista, M + 2, y, 230, { font: 'times', size: 30, lh: 1.15 }) + 6;
    const filas = [['Email', model.contacto.email], ['Instagram', model.contacto.instagram], ['Facebook', model.contacto.facebook], ['Portfolio en línea', model.url]].filter(([, v]) => v);
    for (const [k, v] of filas) {
      L.text(k, M + 2, y, 100, { size: 7.5, color: MUTED, cs: 1.2, upper: true, wrap: false });
      y = L.text(v, M + 2, y + 5.5, 230, { size: 12 }) + 5;
    }
  }

  // ----- Pie de página (todas menos la portada) -----
  const footerStyle = { font: 'helvetica', style: 'normal', size: 7.5, color: MUTED, cs: 0, upper: false };
  const fPitch = 7.5 * 1.4;
  const fTop = FOOT_Y + 5 - ASCENT * fPitch * PT;
  const footer = {
    items: [
      { k: 'rect', x: M, y: FOOT_Y - 0.125, w: W - 2 * M, h: 0.25, color: RULE },
      { k: 'text', x: M, top: fTop, w: 200, h: fPitch * PT, paras: [{
        runs: [{ t: `${model.artista}  ·  ${model.titulo}`, ...footerStyle }], pitch: fPitch, after: 0, left: 0, hang: 0, align: 'left', rows: 1,
        lines: [{ t: `${model.artista}  ·  ${model.titulo}`, x: 0, row: 0, ...footerStyle }]
      }] },
      { k: 'text', x: W - M - 30, top: fTop, w: 30, h: fPitch * PT, paras: [{
        runs: [{ field: 'page', t: '2', ...footerStyle }], pitch: fPitch, after: 0, left: 0, hang: 0, align: 'right', rows: 1,
        lines: [{ t: '{PAGE}', x: 30, row: 0, ...footerStyle }]
      }] }
    ]
  };

  return { pages: L.pages, footer, ascent: ASCENT };
}
