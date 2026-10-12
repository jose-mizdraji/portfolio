// ============================================
// Utilidades compartidas (sitio público + exportación)
// ============================================

export function escapeHtml(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// Valida que una URL sea http(s) antes de usarla en un href.
// escapeHtml() NO protege contra href="javascript:..." porque ese string
// no tiene caracteres HTML especiales. Esta función sí lo bloquea.
export function sanitizeUrl(url) {
  if (!url) return '';
  const trimmed = String(url).trim();
  return /^https?:\/\//i.test(trimmed) ? trimmed : '';
}

// Sveltia CMS guarda las rutas de imagen con "/" inicial (y a veces con el
// prefijo "/portfolio/"). El sitio puede vivir en un subdirectorio de
// GitHub Pages o en la raíz de un dominio propio, así que se normalizan a
// rutas relativas ("assets/images/...") que funcionan en ambos casos.
export function normalizePath(path) {
  if (!path) return '';
  return String(path).replace(/^(\/portfolio)?\//, '');
}

// Minúsculas y sin tildes: sirve para comparar nombres y armar slugs.
export function fold(str) {
  return String(str ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim();
}

export function slugify(str) {
  return fold(str)
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}
