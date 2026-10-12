// Utilidades XML compartidas por DOCX y ODT.

// Escapa texto para XML y descarta caracteres de control que vuelven inválido el archivo.
export function xml(value) {
  return String(value ?? '')
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F￾￿]/g, '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// Un párrafo por cada salto de línea; ignora líneas vacías.
export function paragraphs(text) {
  return String(text ?? '').split(/\n+/).map(s => s.trim()).filter(Boolean);
}

// Tamaño de una imagen dentro de una caja (en cm), respetando la proporción.
export function fitCm(img, maxW, maxH) {
  const r = Math.min(maxW / img.width, maxH / img.height);
  return { w: img.width * r, h: img.height * r };
}

export function capitalize(s) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
