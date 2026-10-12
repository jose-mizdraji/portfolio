// ============================================
// Carga de imágenes para exportar.
// Cada foto se reduce (lado mayor máximo) y se pasa a JPEG: así los
// archivos no pesan decenas de MB y los PNG con transparencia quedan
// sobre fondo blanco en vez de negro.
// ============================================

import { normalizePath } from '../util.js';

async function decode(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${url}: ${res.status}`);
  const blob = await res.blob();
  if (typeof createImageBitmap === 'function') return createImageBitmap(blob);
  // Navegadores viejos: se pasa por un <img> (misma ruta del sitio, permitida por la política de seguridad).
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`No se pudo decodificar ${url}`));
    img.src = url;
  });
}

function toJpegBytes(source, width, height, quality) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, width, height);
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(source, 0, 0, width, height);
  return new Promise((resolve, reject) => {
    canvas.toBlob(async (blob) => {
      if (!blob) return reject(new Error('No se pudo generar la imagen'));
      resolve(new Uint8Array(await blob.arrayBuffer()));
    }, 'image/jpeg', quality);
  });
}

/** Devuelve { bytes, width, height } (JPEG ya reducido) o null si la imagen no se pudo cargar. */
export async function loadJpeg(path, { maxSide = 1600, quality = 0.85 } = {}) {
  const url = normalizePath(path);
  if (!url) return null;
  try {
    const bitmap = await decode(url);
    const w = bitmap.width || bitmap.naturalWidth;
    const h = bitmap.height || bitmap.naturalHeight;
    if (!w || !h) return null;
    const scale = Math.min(1, maxSide / Math.max(w, h));
    const width = Math.max(1, Math.round(w * scale));
    const height = Math.max(1, Math.round(h * scale));
    const bytes = await toJpegBytes(bitmap, width, height, quality);
    if (bitmap.close) bitmap.close();
    return { bytes, width, height };
  } catch (err) {
    console.warn('Imagen omitida en la exportación:', path, err);
    return null;
  }
}

/**
 * Carga todas las imágenes distintas de un modelo de documento (de a 3 por vez).
 * Devuelve un Map: ruta original → { bytes, width, height } | null.
 */
export async function loadAll(paths, opts, onProgress) {
  const unique = [...new Set(paths.filter(Boolean))];
  const result = new Map();
  let done = 0;
  let next = 0;
  const worker = async () => {
    while (next < unique.length) {
      const path = unique[next++];
      result.set(path, await loadJpeg(path, opts));
      done++;
      if (onProgress) onProgress(done, unique.length);
    }
  };
  await Promise.all([worker(), worker(), worker()]);
  return result;
}
