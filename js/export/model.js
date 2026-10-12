// ============================================
// Modelo de documento común a PDF, DOCX y ODT.
// Convierte un portfolio ya resuelto (ver model.js → resolvePortfolio)
// en una estructura simple: portada, secciones con obras, contacto.
// ============================================

import { fold } from '../util.js';
import { PREFIJO_PORTFOLIO, yearRange } from '../model.js';

function nombreDeArchivo(artista, enlace) {
  const limpio = (s) => fold(s).replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  // se conserva la capitalización del enlace (MET-2026), solo se quitan tildes/símbolos
  const enlaceLimpio = String(enlace).normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^A-Za-z0-9-]+/g, '-');
  const a = (limpio(artista) || 'portfolio').split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join('-');
  return `${a}_${PREFIJO_PORTFOLIO}${enlaceLimpio}`;
}

export function buildDocModel({ cat, portfolio, sections, siteUrl }) {
  const artista = cat.bio.nombre || 'José Mizdraji';
  const titulo = portfolio.titulo || `Portfolio ${portfolio.enlace}`;
  const contacto = cat.contact || {};
  const instagram = contacto.instagram
    ? { texto: contacto.instagram.startsWith('@') ? contacto.instagram : `@${contacto.instagram}` }
    : null;

  return {
    artista,
    subtitulo: cat.bio.subtitulo || '',
    titulo,
    destinatario: portfolio.destinatario || '',
    descripcion: portfolio.descripcion || '',
    fecha: new Date().toLocaleDateString('es-AR', { month: 'long', year: 'numeric' }),
    url: new URL(PREFIJO_PORTFOLIO + portfolio.enlace, siteUrl).href,
    nombreArchivo: nombreDeArchivo(artista, portfolio.enlace),
    secciones: sections.map(s => ({
      titulo: s.titulo,
      descripcion: s.descripcion || '',
      esSerie: Boolean(s.serie),
      rango: yearRange(s.works),
      obras: s.works.map(w => ({
        id: w.id,
        titulo: w.titulo,
        disciplina: w.categoria,
        año: w.año ? String(w.año) : '',
        tecnica: w.tecnica,
        medidas: w.medidas,
        descripcion: w.descripcion,
        serie: s.serie ? s.serie.nombre : '',
        imagen: w.imagenPrincipal || ''
      }))
    })),
    contacto: {
      email: contacto.email || '',
      instagram: instagram ? instagram.texto : '',
      facebook: /^https?:\/\//i.test(contacto.facebook || '') ? contacto.facebook : ''
    }
  };
}

export function allImagePaths(model) {
  return model.secciones.flatMap(s => s.obras.map(o => o.imagen));
}

// Contenido textual que se repite igual en los tres formatos
export function fichaFilas(obra) {
  return [
    ['Año', obra.año],
    ['Técnica', obra.tecnica],
    ['Medidas', obra.medidas]
  ].filter(([, v]) => v);
}

export function resumenSeccion(sec) {
  const n = sec.obras.length;
  return [`${n} ${n === 1 ? 'obra' : 'obras'}`, sec.rango].filter(Boolean).join(' · ');
}
