// ============================================
// Extensiones del panel (Sveltia CMS) para «Administrar portfolios».
// Se carga en admin/index.html DESPUÉS del bundle de Sveltia. Hace dos cosas:
//
//  1. Agrega al menú lateral el ítem «Enlaces y descargas», justo debajo de
//     «Administrar portfolios», que abre admin/portfolios.html (enlace completo
//     para copiar y descargas en PDF / Word / ODT).
//
//  2. Cada vez que se guarda un portfolio NUEVO, muestra un aviso con el enlace
//     completo y un botón para copiarlo, para que el artista lo tenga a mano
//     en el momento de crearlo.
//
// Es un script común (no un módulo) y no usa HTML en línea: respeta la política
// de seguridad del panel (script-src 'self' https://unpkg.com).
// La versión de Sveltia está fijada con SRI en admin/index.html, así que la
// estructura de su menú no cambia sin que alguien actualice esa versión.
// ============================================

(function () {
  'use strict';

  // Debe coincidir con el «label» de la colección en admin/config.yml.
  var LABEL_COLECCION = 'Administrar portfolios';
  var COLECCION = 'portfolios';
  var PREFIJO = 'portfolio-';

  // El script vive en <raíz del sitio>/admin/: de ahí salen todas las rutas.
  var scriptUrl = (document.currentScript && document.currentScript.src) || location.href;
  var SITE_URL = new URL('../', scriptUrl).href;
  var PAGINA_ENLACES = new URL('portfolios.html', scriptUrl).href;

  function limpiar(enlace) {
    return String(enlace || '').trim().replace(/^portfolio-/i, '');
  }
  function enlaceCompleto(enlace) {
    return new URL(PREFIJO + limpiar(enlace), SITE_URL).href;
  }

  // ---------- Estilos ----------

  var style = document.createElement('style');
  style.textContent = [
    '.jh-dialog { border: 0; border-radius: 14px; padding: 0; width: min(580px, calc(100vw - 32px)); max-height: calc(100vh - 32px);',
    '  background: #fff; color: #1d1d1b; box-shadow: 0 24px 70px rgba(0,0,0,.35); font: 14px/1.55 system-ui, -apple-system, "Segoe UI", Roboto, sans-serif; }',
    '.jh-dialog::backdrop { background: rgba(0,0,0,.45); }',
    '.jh-body { padding: 26px 28px 8px; }',
    '.jh-body h2 { margin: 0 0 6px; font-size: 20px; line-height: 1.3; font-weight: 600; }',
    '.jh-lead { margin: 0 0 18px; color: #555; }',
    '.jh-item { margin: 0 0 18px; }',
    '.jh-name { font-weight: 600; margin: 0 0 6px; }',
    '.jh-row { display: flex; gap: 8px; flex-wrap: wrap; }',
    '.jh-input { flex: 1 1 260px; min-width: 0; padding: 10px 12px; font: inherit; color: inherit; background: #f6f6f4; border: 1px solid #d4d4cf; border-radius: 8px; }',
    '.jh-input:focus { outline: 2px solid #8b7355; outline-offset: 1px; }',
    '.jh-btn { padding: 10px 16px; font: inherit; font-weight: 600; cursor: pointer; border-radius: 8px; border: 1px solid #1d1d1b; background: #1d1d1b; color: #fff; text-decoration: none; display: inline-flex; align-items: center; justify-content: center; }',
    '.jh-btn:hover { opacity: .88; }',
    '.jh-btn.sec { background: transparent; color: inherit; border-color: #bdbdb7; }',
    '.jh-warn { margin: 8px 0 0; color: #b3261e; }',
    '.jh-foot { display: flex; gap: 10px; justify-content: flex-end; flex-wrap: wrap; padding: 14px 28px 22px; }',
    '.jh-note { margin: 0; padding: 0 28px 4px; color: #777; font-size: 13px; }',
    '@media (prefers-color-scheme: dark) {',
    '  .jh-dialog { background: #232321; color: #f1efe9; }',
    '  .jh-lead { color: #b9b7b0; } .jh-note { color: #9a9892; }',
    '  .jh-input { background: #1a1a19; border-color: #4a4944; }',
    '  .jh-btn { background: #f1efe9; color: #1d1d1b; border-color: #f1efe9; }',
    '  .jh-btn.sec { background: transparent; color: inherit; border-color: #6a6963; }',
    '  .jh-warn { color: #f2b8b5; }',
    '}'
  ].join('\n');
  document.head.appendChild(style);

  // ---------- 1. Ítem de menú «Enlaces y descargas» ----------

  function irAEnlaces() {
    location.assign(PAGINA_ENLACES);
  }

  function asegurarItemDeMenu() {
    var opcion = document.querySelector('button[role="option"][data-label="' + LABEL_COLECCION + '"]');
    if (!opcion || !opcion.parentElement) return;
    var envoltorio = opcion.parentElement;                 // el contenedor de la opción dentro del menú
    var siguiente = envoltorio.nextElementSibling;
    if (siguiente && siguiente.classList.contains('jh-menu-item')) return;   // ya está

    // Se clona una opción real del menú para heredar exactamente su aspecto
    // (tipografías, colores, tema claro/oscuro) y se le cambia lo necesario.
    var copia = envoltorio.cloneNode(true);
    copia.classList.add('jh-menu-item');
    var boton = copia.querySelector('button');
    if (!boton) return;
    ['id', 'data-search-value', 'data-value', 'data-label', 'value', 'aria-selected'].forEach(function (a) { boton.removeAttribute(a); });
    boton.setAttribute('role', 'link');
    boton.setAttribute('tabindex', '0');
    boton.setAttribute('title', 'Copiar enlaces y descargar los portfolios');
    boton.classList.remove('selected', 'active', 'focused', 'checked');

    var icono = boton.querySelector('.icon');
    if (icono) icono.textContent = 'share';
    var texto = boton.querySelector('.truncated-text');
    if (texto) {
      texto.textContent = 'Enlaces y descargas';
    }
    var cantidad = boton.querySelector('.count');
    if (cantidad) cantidad.remove();

    boton.addEventListener('click', function (e) {
      e.preventDefault();
      e.stopPropagation();
      irAEnlaces();
    });
    envoltorio.insertAdjacentElement('afterend', copia);
  }

  var pendiente = false;
  function programar() {
    if (pendiente) return;
    pendiente = true;
    requestAnimationFrame(function () {
      pendiente = false;
      try { asegurarItemDeMenu(); } catch (err) { console.error('[portfolio-extras] menú:', err); }
    });
  }
  new MutationObserver(programar).observe(document.documentElement, { childList: true, subtree: true });
  programar();

  // ---------- 2. Aviso con el enlace al crear un portfolio ----------

  // Enlaces que ya estaban publicados antes de esta sesión de edición.
  var conocidos = new Set();
  var listoConocidos = fetch(new URL('data/portfolios-personalizados.json', SITE_URL).href, { cache: 'no-store' })
    .then(function (r) { return r.ok ? r.json() : { portfolios: [] }; })
    .then(function (d) {
      (Array.isArray(d.portfolios) ? d.portfolios : []).forEach(function (p) {
        if (p && p.enlace) conocidos.add(limpiar(p.enlace).toLowerCase());
      });
    })
    .catch(function () { /* sin datos previos: se avisa por todos los enlaces */ });

  function copiar(texto, input) {
    var ok = Promise.resolve(false);
    if (navigator.clipboard && navigator.clipboard.writeText) {
      ok = navigator.clipboard.writeText(texto).then(function () { return true; }, function () { return false; });
    }
    return ok.then(function (hecho) {
      if (hecho) return true;
      try { input.focus(); input.select(); return document.execCommand('copy'); } catch (e) { return false; }
    });
  }

  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  }

  function mostrarAviso(nuevos) {
    var previo = document.querySelector('dialog.jh-dialog');
    if (previo) previo.remove();

    var dialogo = el('dialog', 'jh-dialog');
    dialogo.setAttribute('aria-labelledby', 'jh-titulo');
    var cuerpo = el('div', 'jh-body');
    var h2 = el('h2', null, nuevos.length === 1 ? 'Portfolio guardado' : 'Portfolios guardados');
    h2.id = 'jh-titulo';
    cuerpo.appendChild(h2);
    cuerpo.appendChild(el('p', 'jh-lead', nuevos.length === 1
      ? 'Este es el enlace para compartir. Copialo ahora y enviáselo a quien corresponda.'
      : 'Estos son los enlaces para compartir. Copialos y enviáselos a quien corresponda.'));

    nuevos.slice(0, 5).forEach(function (p, i) {
      var item = el('div', 'jh-item');
      item.appendChild(el('p', 'jh-name', p.titulo || ('Portfolio ' + limpiar(p.enlace))));
      var fila = el('div', 'jh-row');
      var input = el('input', 'jh-input');
      input.type = 'text';
      input.readOnly = true;
      input.value = enlaceCompleto(p.enlace);
      input.setAttribute('aria-label', 'Enlace para compartir');
      input.addEventListener('focus', function () { input.select(); });
      var boton = el('button', 'jh-btn', 'Copiar enlace');
      boton.type = 'button';
      boton.addEventListener('click', function () {
        copiar(input.value, input).then(function (ok) {
          boton.textContent = ok ? '¡Enlace copiado!' : 'Copialo con Ctrl+C';
          if (!ok) { input.focus(); input.select(); }
          setTimeout(function () { boton.textContent = 'Copiar enlace'; }, 2500);
        });
      });
      fila.appendChild(input);
      fila.appendChild(boton);
      item.appendChild(fila);
      if (p.habilitado === false) {
        item.appendChild(el('p', 'jh-warn', 'Está deshabilitado: por ahora quien abra este enlace verá «Este portfolio no está disponible». Marcá «Habilitado» y guardá para publicarlo.'));
      }
      cuerpo.appendChild(item);
      if (i === 0) setTimeout(function () { boton.focus(); }, 0);
    });
    if (nuevos.length > 5) cuerpo.appendChild(el('p', 'jh-lead', 'Y ' + (nuevos.length - 5) + ' más en «Enlaces y descargas».'));
    dialogo.appendChild(cuerpo);
    dialogo.appendChild(el('p', 'jh-note', 'El portfolio queda publicado entre 1 y 2 minutos después de guardar. Hasta entonces el enlace puede no abrir. Desde «Enlaces y descargas» también podés bajarlo en PDF, Word u OpenDocument.'));

    var pie = el('div', 'jh-foot');
    var ir = el('a', 'jh-btn sec', 'Ir a Enlaces y descargas');
    ir.href = PAGINA_ENLACES;
    var cerrar = el('button', 'jh-btn sec', 'Cerrar');
    cerrar.type = 'button';
    cerrar.addEventListener('click', function () { dialogo.close(); });
    pie.appendChild(ir);
    pie.appendChild(cerrar);
    dialogo.appendChild(pie);

    dialogo.addEventListener('close', function () { dialogo.remove(); });
    document.body.appendChild(dialogo);
    dialogo.showModal();
  }

  function alGuardar(args) {
    var entry = args && args.entry;
    var e = entry && typeof entry.toJS === 'function' ? entry.toJS() : entry;
    if (!e || e.collection !== COLECCION || !e.data || !Array.isArray(e.data.portfolios)) return;

    var lista = e.data.portfolios.filter(function (p) { return p && p.enlace; });
    return listoConocidos.then(function () {
      var nuevos = lista.filter(function (p) { return !conocidos.has(limpiar(p.enlace).toLowerCase()); });
      conocidos = new Set(lista.map(function (p) { return limpiar(p.enlace).toLowerCase(); }));
      if (nuevos.length) mostrarAviso(nuevos);
    });
  }

  // Sveltia expone window.CMS cuando termina de cargar su bundle.
  function registrar() {
    if (!window.CMS || typeof window.CMS.registerEventListener !== 'function') return false;
    window.CMS.registerEventListener({ name: 'postSave', handler: alGuardar });
    return true;
  }
  if (!registrar()) {
    var intentos = 0;
    var t = setInterval(function () {
      if (registrar() || ++intentos > 100) clearInterval(t);
    }, 100);
  }
})();
