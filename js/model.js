// ============================================
// Modelo de datos — lógica pura, sin DOM.
//
// Conceptos:
//  - Obra: pertenece a una DISCIPLINA (Pinturas, Dibujos, ...) y es
//    figurativa o no figurativa. Puede estar en 0, 1 o varias SERIES.
//  - Serie: entidad propia (nombre + descripción). Es transdisciplinaria
//    y transtemporal: se arma sola con las obras que la nombran.
//  - Portfolio base: "Arte Figurativo" y "Arte No Figurativo". Se arman
//    solos: cada uno muestra las series con obras de ese tipo.
//    Una misma serie puede aparecer en ambos, con contenido distinto.
//  - Portfolio personalizado: armado a mano para un destinatario
//    (/portfolio-MET-2026). Puede incluir series y obras que no están
//    visibles en el resto del sitio.
// ============================================

import { fold, slugify } from './util.js';

export const DISCIPLINAS = ['Pinturas', 'Dibujos', 'Grabados', 'Esculturas'];

export const TIPOS = {
  'figurativo': {
    key: 'figurativo', ruta: 'arte-figurativo',
    titulo: 'Arte Figurativo', corto: 'Figurativo'
  },
  'no-figurativo': {
    key: 'no-figurativo', ruta: 'arte-no-figurativo',
    titulo: 'Arte No Figurativo', corto: 'No figurativo'
  }
};
export const TIPO_KEYS = Object.keys(TIPOS);
export const TIPO_PERSONALIZADO = { ...Object.fromEntries(TIPO_KEYS.map(k => [k, TIPOS[k].corto])), mixto: 'Mixto' };

export const PREFIJO_PORTFOLIO = 'portfolio-';

// ---------- Normalización ----------

function toArray(v) {
  return Array.isArray(v) ? v : [];
}

function timestamp(w) {
  const t = Date.parse(w.fechaCarga || '');
  return Number.isNaN(t) ? 0 : t;
}

export function normalizeWork(raw) {
  const tipo = TIPOS[raw.tipo] ? raw.tipo : null;
  const año = Number(raw.año);
  return {
    id: String(raw.id ?? ''),
    titulo: raw.titulo || 'Sin título',
    categoria: raw.categoria || '',
    tipo,
    año: Number.isFinite(año) && año > 0 ? año : null,
    tecnica: raw.tecnica || '',
    medidas: raw.medidas || '',
    descripcion: raw.descripcion || '',
    series: toArray(raw.series).filter(Boolean).map(String),
    // Una obra es visible salvo que esté marcada explícitamente como oculta.
    visible: raw.visible !== false,
    imagenPrincipal: raw.imagenPrincipal || '',
    galeria: toArray(raw.galeria).filter(Boolean),
    fechaCarga: raw.fechaCarga || '',
    _ts: timestamp(raw)
  };
}

// Más recientes primero: por año de la obra y, a igual año, por fecha de carga.
export function byRecent(a, b) {
  return ((b.año ?? 0) - (a.año ?? 0)) || (b._ts - a._ts) || a.titulo.localeCompare(b.titulo, 'es');
}

export function yearRange(works) {
  const years = works.map(w => w.año).filter(Boolean);
  if (!years.length) return '';
  const min = Math.min(...years);
  const max = Math.max(...years);
  return min === max ? String(min) : `${min} – ${max}`;
}

export function normalizeData({ obras, series, bio, contacto, base, personalizados }) {
  const works = toArray(Array.isArray(obras) ? obras : obras?.obras).map(normalizeWork).filter(w => w.id);
  const worksById = new Map(works.map(w => [w.id, w]));

  // Slugs de serie para las URLs (#serie/<slug>/<tipo>). Si dos series
  // tuvieran el mismo nombre, la segunda lleva un sufijo numérico.
  const usados = new Set();
  const seriesList = toArray(Array.isArray(series) ? series : series?.series)
    .filter(s => s && s.id && s.nombre)
    .map(s => {
      let slug = slugify(s.nombre) || 'serie';
      let n = 2;
      while (usados.has(slug) || slug === 'otras') slug = `${slugify(s.nombre) || 'serie'}-${n++}`;
      usados.add(slug);
      return {
        id: String(s.id),
        nombre: s.nombre,
        slug,
        descripcion: s.descripcion || '',
        imagen: s.imagen || '',
        visible: s.visible !== false
      };
    });

  const portfolios = toArray(Array.isArray(personalizados) ? personalizados : personalizados?.portfolios)
    .filter(p => p && p.enlace)
    .map(p => ({
      enlace: String(p.enlace).trim().replace(/^portfolio-/i, ''),
      titulo: p.titulo || '',
      destinatario: p.destinatario || '',
      descripcion: p.descripcion || '',
      habilitado: p.habilitado !== false,
      tipo: TIPO_PERSONALIZADO[p.tipo] ? p.tipo : 'mixto',
      secciones: toArray(p.secciones).map(s => ({
        serie: s?.serie ? String(s.serie) : '',
        obras: toArray(s?.obras).filter(Boolean).map(String)
      }))
    }));

  return {
    works,
    worksById,
    series: seriesList,
    seriesById: new Map(seriesList.map(s => [s.id, s])),
    seriesBySlug: new Map(seriesList.map(s => [s.slug, s])),
    portfolios,
    bio: bio || {},
    contact: contacto || {},
    base: base || {}
  };
}

// ---------- Vistas públicas (solo lo visible) ----------

export function publicWorks(cat) {
  return cat.works.filter(w => w.visible);
}

export function visibleSeriesOf(cat, work) {
  return work.series.map(id => cat.seriesById.get(id)).filter(s => s && s.visible);
}

function groupFor(cat, serie, tipo) {
  const works = publicWorks(cat)
    .filter(w => w.tipo === tipo && w.series.includes(serie.id))
    .sort(byRecent);
  return works.length ? { kind: 'serie', serie, tipo, works } : null;
}

// Obras de ese tipo que no pertenecen a ninguna serie visible.
function groupOtras(cat, tipo) {
  const works = publicWorks(cat)
    .filter(w => w.tipo === tipo && visibleSeriesOf(cat, w).length === 0)
    .sort(byRecent);
  return works.length ? { kind: 'otras', serie: null, tipo, works } : null;
}

// Grupos (series + "otras obras") de un portfolio base. El orden de las
// series es el que el artista definió en el panel.
export function groupsForTipo(cat, tipo) {
  const groups = cat.series
    .filter(s => s.visible)
    .map(s => groupFor(cat, s, tipo))
    .filter(Boolean);
  const otras = groupOtras(cat, tipo);
  if (otras) groups.push(otras);
  return groups;
}

// Todos los grupos de todos los tipos (vista "Obras → por series").
// Una misma serie puede dar dos tarjetas: una por cada portfolio.
export function allGroups(cat) {
  const groups = [];
  for (const s of cat.series.filter(x => x.visible)) {
    for (const tipo of TIPO_KEYS) {
      const g = groupFor(cat, s, tipo);
      if (g) groups.push(g);
    }
  }
  for (const tipo of TIPO_KEYS) {
    const o = groupOtras(cat, tipo);
    if (o) groups.push(o);
  }
  return groups;
}

export function findGroup(cat, slug, tipo) {
  if (!TIPOS[tipo]) return null;
  if (slug === 'otras') return groupOtras(cat, tipo);
  const serie = cat.seriesBySlug.get(slug);
  return serie && serie.visible ? groupFor(cat, serie, tipo) : null;
}

export function groupTitle(group) {
  return group.kind === 'otras' ? 'Otras obras' : group.serie.nombre;
}

export function groupSlug(group) {
  return group.kind === 'otras' ? 'otras' : group.serie.slug;
}

export function groupCover(group) {
  return (group.serie && group.serie.imagen) || group.works[0]?.imagenPrincipal || '';
}

// ---------- Portfolios personalizados ----------

export function portfolioRoute(p) {
  return PREFIJO_PORTFOLIO + p.enlace;
}

// Acepta "portfolio-MET-2026" (la ruta) sin distinguir mayúsculas.
export function findPortfolio(cat, route) {
  const wanted = fold(route);
  return cat.portfolios.find(p => fold(portfolioRoute(p)) === wanted) || null;
}

// Convierte la configuración de un portfolio en secciones listas para mostrar:
//  - Con obras elegidas: se muestran esas (aunque estén ocultas en el sitio).
//  - Sin obras elegidas: se muestran todas las obras VISIBLES de la serie
//    y, si el portfolio es figurativo / no figurativo, solo las de ese tipo.
//  - Sin serie: sección "Otras obras" con las obras elegidas.
export function resolvePortfolio(cat, portfolio) {
  const sections = [];
  for (const sec of portfolio.secciones) {
    const serie = sec.serie ? cat.seriesById.get(sec.serie) : null;
    if (sec.serie && !serie) continue; // serie borrada: se ignora la sección

    let works;
    if (sec.obras.length) {
      works = sec.obras.map(id => cat.worksById.get(id)).filter(Boolean);
    } else if (serie) {
      works = publicWorks(cat)
        .filter(w => w.series.includes(serie.id))
        .filter(w => portfolio.tipo === 'mixto' || w.tipo === portfolio.tipo)
        .sort(byRecent);
    } else {
      works = [];
    }
    if (!works.length) continue;

    sections.push({
      titulo: serie ? serie.nombre : 'Otras obras',
      descripcion: serie ? serie.descripcion : '',
      serie,
      works
    });
  }
  return sections;
}

// ---------- Trayectoria ----------

// Muestra solo lo "destacado" si el artista marcó algo; si no, los primeros N.
export function pickFeatured(items, limit) {
  const list = toArray(items);
  const marked = list.filter(i => i && i.destacado);
  const shown = marked.length ? marked : list.slice(0, limit);
  return { shown, total: list.length, hasMore: list.length > shown.length };
}
