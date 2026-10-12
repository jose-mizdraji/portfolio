// ============================================
// Panel · «Enlaces y descargas»
// Lista los portfolios personalizados publicados y, para cada uno:
//   · el enlace completo para compartir (con botón de copiar), y
//   · las descargas en PDF, Word (.docx) y OpenDocument (.odt).
// Las descargas NO están en la página pública que se comparte: solo acá.
// Todo se arma en el navegador con los datos publicados del sitio.
// ============================================

import * as M from '../js/model.js';
import { escapeHtml as esc } from '../js/util.js';

// Raíz del sitio (la página declara <base href="../">): https://…/portfolio/ o https://dominio/
const SITE_URL = new URL('.', document.baseURI).href;

const listEl = document.getElementById('adm-list');
const updatedEl = document.getElementById('adm-updated');
const refreshBtn = document.getElementById('adm-refresh');

let cat = null;

// ---------- Datos ----------

async function getJson(path, optional = false) {
  try {
    // no-cache: siempre revalida, así lo recién publicado aparece apenas GitHub Pages lo sirve.
    const res = await fetch(path, { cache: 'no-cache' });
    if (!res.ok) throw new Error(`${path}: ${res.status}`);
    return await res.json();
  } catch (err) {
    if (optional) return null;
    throw err;
  }
}

async function loadCatalog() {
  const [obras, bio, contacto, series, base, personalizados] = await Promise.all([
    getJson('data/obras.json'),
    getJson('data/bio.json'),
    getJson('data/contacto.json'),
    getJson('data/series.json', true),
    getJson('data/portfolios-base.json', true),
    getJson('data/portfolios-personalizados.json', true)
  ]);
  cat = M.normalizeData({ obras, series, bio, contacto, base, personalizados });
}

// ---------- Vista ----------

function plural(n, uno, varios) {
  return `${n} ${n === 1 ? uno : varios}`;
}

function cardHtml(p, i) {
  const sections = M.resolvePortfolio(cat, p);
  const total = sections.reduce((n, s) => n + s.works.length, 0);
  const titulo = p.titulo || `Portfolio ${p.enlace}`;
  const link = new URL(M.portfolioRoute(p), SITE_URL).href;
  const alt = new URL(`#${M.portfolioRoute(p)}`, SITE_URL).href;
  const off = !p.habilitado;
  const vacio = total === 0;

  return `
    <article class="adm-card${off ? ' adm-card-off' : ''}" data-enlace="${esc(p.enlace)}">
      <h2>${esc(titulo)}</h2>
      <p class="adm-meta">
        ${p.destinatario ? `<span>${esc(p.destinatario)}</span>` : ''}
        <span>${esc(M.TIPO_PERSONALIZADO[p.tipo])}</span>
        <span>${plural(total, 'obra', 'obras')}</span>
        <span class="adm-pill ${off ? 'off' : 'on'}">${off ? 'Deshabilitado' : 'Habilitado'}</span>
      </p>

      <div class="adm-field">
        <label for="adm-link-${i}">Enlace para compartir</label>
        <div class="adm-linkrow">
          <input id="adm-link-${i}" class="adm-link" type="text" readonly value="${esc(link)}" aria-describedby="adm-state-${i}">
          <button type="button" class="btn btn-sm" data-copy>Copiar enlace</button>
          <a class="btn btn-sm btn-outline" href="${esc(link)}" target="_blank" rel="noopener noreferrer">Abrir</a>
        </div>
        <details class="adm-alt">
          <summary>Enlace alternativo, por si el principal no abre</summary>
          <code>${esc(alt)}</code>
        </details>
        <p class="adm-warn" id="adm-state-${i}">${
          off ? 'Este portfolio está deshabilitado: quien abra el enlace verá «Este portfolio no está disponible». Para activarlo, marcá «Habilitado» en el panel.' : ''
        }${
          vacio ? `${off ? ' ' : ''}Este portfolio todavía no tiene obras para mostrar.` : ''
        }</p>
      </div>

      <div class="adm-field">
        <span class="label">Descargar</span>
        <div class="adm-dl">
          <button type="button" class="btn btn-sm btn-outline" data-dl="pdf"${vacio ? ' disabled' : ''}>PDF</button>
          <button type="button" class="btn btn-sm btn-outline" data-dl="docx"${vacio ? ' disabled' : ''}>Word (.docx)</button>
          <button type="button" class="btn btn-sm btn-outline" data-dl="odt"${vacio ? ' disabled' : ''}>OpenDocument (.odt)</button>
        </div>
        <div class="adm-status" role="status" aria-live="polite"></div>
      </div>
    </article>`;
}

function render() {
  // Lo último que se agregó va arriba: es lo que se suele querer compartir.
  const portfolios = [...cat.portfolios].reverse();
  if (!portfolios.length) {
    listEl.innerHTML = `<p class="adm-empty">Todavía no hay portfolios personalizados publicados.<br>
      Creá uno desde <a class="adm-textlink" href="admin/#/collections/portfolios/entries/personalizados">Administrar portfolios</a>.</p>`;
    return;
  }
  listEl.innerHTML = portfolios.map(cardHtml).join('');
}

function showError() {
  listEl.innerHTML = `<p class="adm-empty error">No se pudieron cargar los portfolios. Revisá la conexión y tocá «Actualizar lista».</p>`;
}

async function refresh() {
  refreshBtn.disabled = true;
  updatedEl.textContent = 'Actualizando…';
  try {
    await loadCatalog();
    render();
    updatedEl.textContent = `Actualizado a las ${new Date().toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}`;
  } catch (err) {
    console.error('Error cargando datos:', err);
    showError();
    updatedEl.textContent = '';
  } finally {
    refreshBtn.disabled = false;
  }
}

// ---------- Acciones ----------

async function copyText(text, input) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch (e) { /* sin permiso o sin contexto seguro: se prueba el método viejo */ }
  try {
    input.focus();
    input.select();
    input.setSelectionRange(0, text.length);
    return document.execCommand('copy');
  } catch (e) {
    return false;
  }
}

async function onCopy(btn, card) {
  const input = card.querySelector('.adm-link');
  const ok = await copyText(input.value, input);
  const original = 'Copiar enlace';
  btn.textContent = ok ? '¡Enlace copiado!' : 'Seleccionado: copialo con Ctrl+C';
  if (!ok) { input.focus(); input.select(); }
  clearTimeout(btn._t);
  btn._t = setTimeout(() => { btn.textContent = original; }, 2500);
}

async function onDownload(btn, card) {
  const portfolio = cat.portfolios.find(p => p.enlace === card.dataset.enlace);
  if (!portfolio) return;
  const status = card.querySelector('.adm-status');
  const buttons = [...card.querySelectorAll('[data-dl]')];
  const say = (msg, isError = false) => {
    status.textContent = msg;
    status.classList.toggle('error', isError);
  };

  buttons.forEach(b => { b.disabled = true; });
  say('Preparando el archivo…');
  try {
    // La librería de exportación se carga recién acá.
    const { exportPortfolio } = await import('../js/export/index.js');
    await exportPortfolio({
      format: btn.dataset.dl,
      cat,
      portfolio,
      sections: M.resolvePortfolio(cat, portfolio),
      siteUrl: SITE_URL,
      onProgress: (hechas, total) => say(`Procesando imágenes… ${hechas} de ${total}`)
    });
    say('Listo: el archivo se descargó.');
  } catch (err) {
    console.error('Error al exportar:', err);
    say('No se pudo generar el archivo. Probá de nuevo o usá otro formato.', true);
  } finally {
    buttons.forEach(b => { b.disabled = false; });
  }
}

listEl.addEventListener('click', (e) => {
  const card = e.target.closest('.adm-card');
  if (!card) return;
  const copy = e.target.closest('[data-copy]');
  if (copy) return void onCopy(copy, card);
  const dl = e.target.closest('[data-dl]');
  if (dl && !dl.disabled) onDownload(dl, card);
});

refreshBtn.addEventListener('click', refresh);
refresh();
