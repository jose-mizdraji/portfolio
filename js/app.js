// ============================================
// JOSÉ MIZDRAJI — SPA (GitHub Pages, sin backend)
// Carga datos desde JSON estáticos en /data.
// Editable en producción vía Sveltia CMS (/admin).
//
// Rutas (por #hash):
//   #home
//   #arte-figurativo · #arte-no-figurativo        portfolios base
//   #serie/<serie>/<figurativo|no-figurativo>      una serie dentro de un portfolio
//   #obras[/series | /disciplinas[/<disciplina>] | /recientes]
//   #obra/<id>
//   #trayectoria · #premios · #exposiciones/<individuales|colectivas>
//   #contacto
//   #portfolio-<enlace>                            portfolios personalizados
//                                                  (también por /portfolio-<enlace>, ver 404.html)
// ============================================

import { escapeHtml as esc, sanitizeUrl, normalizePath } from './util.js';
import * as M from './model.js';

// Raíz del sitio, funcione bajo /portfolio/ (github.io) o en un dominio propio.
const SITE_URL = new URL('.', window.location.href).href;

const EMAIL_RE = /^[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}$/;
const PREMIOS_VISIBLES = 5;
const EXPOSICIONES_VISIBLES = 6;

const App = {
  cat: null,
  loaded: false,
  lightbox: { items: [], index: 0 },

  async init() {
    await this.loadData();
    this.bindEvents();
    this.handleRoute();
  },

  // ---------- Datos ----------

  async loadData() {
    const getJson = async (path, optional = false) => {
      try {
        // no-cache: revalida con el servidor, así los cambios del panel se ven apenas se publican.
        const res = await fetch(path, { cache: 'no-cache' });
        if (!res.ok) throw new Error(`${path}: ${res.status}`);
        return await res.json();
      } catch (err) {
        if (optional) { console.warn('Archivo opcional no disponible:', path); return null; }
        throw err;
      }
    };
    try {
      const [obras, bio, contacto, series, base, personalizados] = await Promise.all([
        getJson('data/obras.json'),
        getJson('data/bio.json'),
        getJson('data/contacto.json'),
        getJson('data/series.json', true),
        getJson('data/portfolios-base.json', true),
        getJson('data/portfolios-personalizados.json', true)
      ]);
      this.cat = M.normalizeData({ obras, series, bio, contacto, base, personalizados });
      this.loaded = true;
    } catch (err) {
      console.error('Error cargando datos:', err);
      document.getElementById('app-main').innerHTML = `
        <div class="section container text-center">
          <h2>Error al cargar los datos</h2>
          <p style="color:var(--color-text-secondary)">Por favor, recarga la página o verifica la conexión.</p>
        </div>`;
    }
  },

  // ---------- Eventos globales ----------

  bindEvents() {
    window.addEventListener('hashchange', () => this.handleRoute());
    window.addEventListener('scroll', () => this.handleScroll(), { passive: true });

    document.addEventListener('click', (e) => {
      const toggle = e.target.closest('.mobile-toggle');
      if (toggle) {
        const open = document.querySelector('.main-nav').classList.toggle('open');
        toggle.setAttribute('aria-expanded', String(open));
      }
      if (e.target.closest('.main-nav a')) {
        document.querySelector('.main-nav').classList.remove('open');
        document.querySelector('.mobile-toggle').setAttribute('aria-expanded', 'false');
      }
      if (e.target.closest('#theme-toggle')) this.toggleTheme();
    });

    // Las imágenes que no cargan se marcan por CSS (no se puede usar onerror
    // en línea: la política de seguridad del sitio no permite JS en línea).
    document.addEventListener('error', (e) => {
      const t = e.target;
      if (t && t.tagName === 'IMG') {
        t.classList.add('img-failed');
        if (t.parentElement) t.parentElement.classList.add('img-failed-parent');
      }
    }, true);

    this.syncThemeButton();
  },

  toggleTheme() {
    const root = document.documentElement;
    const next = root.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
    root.setAttribute('data-theme', next);
    try { localStorage.setItem('theme', next); } catch (e) { /* sin almacenamiento: vale solo para esta visita */ }
    this.syncThemeButton();
  },

  syncThemeButton() {
    const btn = document.getElementById('theme-toggle');
    if (!btn) return;
    const dark = document.documentElement.getAttribute('data-theme') === 'dark';
    btn.setAttribute('aria-pressed', String(dark));
    btn.setAttribute('aria-label', dark ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro');
  },

  handleScroll() {
    const header = document.querySelector('.site-header');
    header.classList.toggle('scrolled', window.scrollY > 50);
  },

  // ---------- Ruteo ----------

  parseHash() {
    const raw = (window.location.hash || '#home').slice(1);
    const parts = raw.split('/').map(p => { try { return decodeURIComponent(p); } catch (e) { return p; } });
    return { route: parts[0] || 'home', params: parts.slice(1) };
  },

  handleRoute() {
    if (!this.loaded) return;
    const { route, params } = this.parseHash();
    const main = document.getElementById('app-main');
    const meta = (m) => this.updateMeta(m);
    const cat = this.cat;
    let activeNav = route;
    let html;

    this.closeLightbox();
    this.setRobots(false);

    if (route.toLowerCase().startsWith(M.PREFIJO_PORTFOLIO)) {
      activeNav = '';
      html = this.renderPortfolioPersonalizado(route);
    } else {
      switch (route) {
        case 'home':
          html = this.renderHome();
          meta({
            title: 'José Mizdraji — Artista Visual',
            description: 'Portafolio oficial de José Mizdraji, artista visual correntino. Pintura, dibujo, grabado y escultura.',
            jsonLd: this.personJsonLd()
          });
          break;
        case 'arte-figurativo':
        case 'arte-no-figurativo': {
          const tipo = route === 'arte-figurativo' ? 'figurativo' : 'no-figurativo';
          html = this.renderPortfolioBase(tipo);
          meta({
            title: `${M.TIPOS[tipo].titulo} — José Mizdraji`,
            description: `Series y obras de ${M.TIPOS[tipo].titulo.toLowerCase()} de José Mizdraji.`,
            jsonLd: null
          });
          break;
        }
        case 'serie': {
          const tipo = params[1];
          activeNav = M.TIPOS[tipo] ? M.TIPOS[tipo].ruta : 'obras';
          html = this.renderSerie(params[0], tipo);
          break; // updateMeta se llama dentro (necesita los datos de la serie)
        }
        case 'obras':
          html = this.renderObras(params);
          meta({
            title: 'Obras — José Mizdraji',
            description: 'Obras de José Mizdraji: pinturas, dibujos, grabados y esculturas, por serie o por disciplina.',
            jsonLd: null
          });
          break;
        case 'obra':
          activeNav = 'obras';
          html = this.renderObra(params[0]);
          break; // updateMeta se llama dentro
        case 'trayectoria':
          html = this.renderTrayectoria();
          meta({
            title: 'Trayectoria — José Mizdraji',
            description: 'Biografía, formación, premios y exposiciones de José Mizdraji.',
            jsonLd: this.personJsonLd()
          });
          break;
        case 'premios':
          activeNav = 'trayectoria';
          html = this.renderPremios();
          meta({ title: 'Premios y distinciones — José Mizdraji', description: 'Listado completo de premios y distinciones de José Mizdraji.', jsonLd: null });
          break;
        case 'exposiciones':
          activeNav = 'trayectoria';
          html = this.renderExposiciones(params[0]);
          meta({ title: 'Exposiciones — José Mizdraji', description: 'Listado completo de exposiciones individuales y colectivas de José Mizdraji.', jsonLd: null });
          break;
        case 'contacto':
          html = this.renderContacto();
          meta({ title: 'Contacto — José Mizdraji', description: 'Contacto de José Mizdraji, artista visual correntino.', jsonLd: null });
          break;
        default:
          activeNav = 'home';
          html = this.renderHome();
      }
    }

    main.innerHTML = html;
    document.querySelectorAll('.main-nav a').forEach(a => {
      a.classList.toggle('active', a.dataset.route === activeNav);
    });
    window.scrollTo({ top: 0, behavior: 'instant' });

    // Eventos propios de cada página (solo si esa página los tiene)
    this.bindObraDetailEvents();
    this.bindTrayectoriaEvents();
    this.bindContactoEvents();
    this.bindPortfolioEvents();
  },

  // ---------- SEO dinámico ----------
  // Nota honesta: como el sitio es una SPA con ruteo por #hash, esto mejora
  // el <title>/meta description que ve alguien que abre el link, pero los
  // buscadores en general NO indexan fragmentos #hash como páginas separadas.
  updateMeta({ title, description, jsonLd }) {
    if (title) document.title = title;
    if (description !== undefined) {
      const meta = document.querySelector('meta[name="description"]');
      if (meta) meta.setAttribute('content', description);
      const og = document.querySelector('meta[property="og:description"]');
      if (og) og.setAttribute('content', description);
    }
    const ogTitle = document.querySelector('meta[property="og:title"]');
    if (ogTitle && title) ogTitle.setAttribute('content', title);

    let script = document.getElementById('ld-json');
    if (jsonLd) {
      if (!script) {
        script = document.createElement('script');
        script.type = 'application/ld+json';
        script.id = 'ld-json';
        document.head.appendChild(script);
      }
      // textContent (no innerHTML) evita cualquier riesgo de inyección.
      script.textContent = JSON.stringify(jsonLd);
    } else if (script) {
      script.remove();
    }
  },

  // Los portfolios personalizados no deben aparecer en buscadores.
  setRobots(noindex) {
    let meta = document.querySelector('meta[name="robots"]');
    if (noindex) {
      if (!meta) {
        meta = document.createElement('meta');
        meta.setAttribute('name', 'robots');
        document.head.appendChild(meta);
      }
      meta.setAttribute('content', 'noindex, nofollow');
    } else if (meta) {
      meta.remove();
    }
  },

  personJsonLd() {
    const bio = this.cat.bio;
    return {
      '@context': 'https://schema.org',
      '@type': 'Person',
      name: bio.nombre || 'José Mizdraji',
      jobTitle: bio.tituloProfesional || 'Artista visual',
      description: bio.subtitulo || '',
      url: SITE_URL
    };
  },

  // ---------- Piezas reutilizables ----------

  img(src, alt, { eager = false } = {}) {
    const p = normalizePath(src);
    if (!p) return '';
    return `<img src="${esc(p)}" alt="${esc(alt)}" loading="${eager ? 'eager' : 'lazy'}">`;
  },

  plural(n, uno, varios) {
    return `${n} ${n === 1 ? uno : varios}`;
  },

  emptyState(message = 'Todavía no hay obras para mostrar.') {
    return `<div class="empty-state" style="grid-column: 1 / -1;"><h3>Sin resultados</h3><p>${esc(message)}</p></div>`;
  },

  crumbs(...items) {
    // items: [href, texto] o solo texto (último, sin enlace)
    return `<div class="breadcrumbs">${items.map(i =>
      Array.isArray(i) ? `<a href="${i[0]}">${esc(i[1])}</a>` : esc(i)
    ).join(' <span>/</span> ')}</div>`;
  },

  // Tarjeta de obra. as='link' abre la ficha; as='button' abre el visor (portfolios personalizados).
  workCard(work, { as = 'link', index = 0 } = {}) {
    const inner = `
      <div class="work-card-image">${this.img(work.imagenPrincipal, work.titulo)}</div>
      <div class="work-card-info">
        <span class="label">${esc(work.categoria)}</span>
        <h3>${esc(work.titulo)}</h3>
        <div class="meta">
          ${work.año ? `<span>${esc(work.año)}</span>` : ''}
          ${work.tecnica ? `<span>${esc(work.tecnica)}</span>` : ''}
        </div>
      </div>`;
    return as === 'button'
      ? `<button type="button" class="work-card fade-in" data-open="${index}" aria-haspopup="dialog">${inner}</button>`
      : `<a class="work-card fade-in" href="#obra/${encodeURIComponent(work.id)}">${inner}</a>`;
  },

  // Tarjeta de serie dentro de un portfolio (con etiqueta del portfolio).
  groupCard(group) {
    const tipo = M.TIPOS[group.tipo];
    const nombre = M.groupTitle(group);
    const desc = group.serie ? group.serie.descripcion : '';
    const rango = M.yearRange(group.works);
    return `
      <a class="work-card fade-in" href="#serie/${encodeURIComponent(M.groupSlug(group))}/${group.tipo}">
        <div class="work-card-image">
          ${this.img(M.groupCover(group), nombre)}
          <span class="tag tag-${group.tipo}">${esc(tipo.titulo)}</span>
        </div>
        <div class="work-card-info">
          <span class="label">${group.kind === 'otras' ? 'Sin serie' : 'Serie'}</span>
          <h3>${esc(nombre)}</h3>
          <div class="meta">
            <span>${this.plural(group.works.length, 'obra', 'obras')}</span>
            ${rango ? `<span>${esc(rango)}</span>` : ''}
          </div>
          ${desc ? `<p class="desc">${esc(desc)}</p>` : ''}
        </div>
      </a>`;
  },

  // mailto con asunto y cuerpo ya armados. Devuelve '' si no hay un email válido.
  mailto(subject, body) {
    const email = this.cat.contact.email;
    if (!email || !EMAIL_RE.test(email)) return '';
    return `mailto:${email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  },

  consultaLink({ asunto, cuerpoSobre, clase = 'btn btn-buy', texto }) {
    const href = this.mailto(
      asunto,
      `Hola,\n\nMe interesa obtener información sobre ${cuerpoSobre}.\n\nQuedo atento/a a su respuesta.\n\nSaludos cordiales.`
    );
    return href
      ? `<a href="${esc(href)}" class="${clase}">${esc(texto)}</a>
         <p class="btn-note">Se abrirá tu cliente de correo con los datos cargados</p>`
      : `<a href="#contacto" class="${clase}">${esc(texto)}</a>`;
  },

  socialLinks(contact) {
    const ig = contact.instagram
      ? `<a href="https://instagram.com/${esc(contact.instagram.replace('@', ''))}" target="_blank" rel="noopener noreferrer">Instagram</a>` : '';
    const fb = sanitizeUrl(contact.facebook)
      ? `<a href="${esc(sanitizeUrl(contact.facebook))}" target="_blank" rel="noopener noreferrer">Facebook</a>` : '';
    return ig + fb;
  },

  // ---------- Inicio ----------

  renderHome() {
    const { cat } = this;
    const bio = cat.bio;
    const contact = cat.contact;
    const recientes = M.publicWorks(cat).sort(M.byRecent).slice(0, 4);
    const cats = bio.imagenesCategorias || {};
    const textoInicio = bio.textoInicio || 'Su práctica abarca la pintura, el dibujo, el grabado y la escultura, cruzando memoria, entorno y materialidad.';

    const portfolioCard = (tipoKey) => {
      const tipo = M.TIPOS[tipoKey];
      const works = M.publicWorks(cat).filter(w => w.tipo === tipoKey).sort(M.byRecent);
      const base = (tipoKey === 'figurativo' ? cat.base.figurativo : cat.base.noFigurativo) || {};
      const cover = base.imagen || works[0]?.imagenPrincipal || '';
      return `
        <a class="category-card portfolio-card" href="#${tipo.ruta}">
          ${this.img(cover, tipo.titulo)}
          <div class="category-overlay">
            <h3>${esc(tipo.titulo)}</h3>
            <span>${works.length ? this.plural(works.length, 'obra', 'obras') : 'Ver portfolio'}</span>
          </div>
        </a>`;
    };

    return `
      <section class="hero">
        <div class="container">
          <div class="hero-grid">
            <div class="hero-content fade-in">
              <div class="hero-rule" aria-hidden="true"></div>
              <h1 class="hero-title">${esc(bio.nombre)}</h1>
              <p class="hero-subtitle">${esc(bio.subtitulo)}</p>
              <p class="hero-text">${esc(textoInicio)}</p>
              <a href="#obras" class="btn">Ver obras</a>
            </div>
            <div class="hero-image fade-in stagger-1">
              ${bio.imagenHero ? this.img(bio.imagenHero, `Obra destacada de ${bio.nombre}`, { eager: true }) : ''}
            </div>
          </div>
        </div>
      </section>

      <section class="portfolios-section">
        <div class="container">
          <div class="section-header">
            <h2>Portfolios</h2>
            <p>Dos modos de recorrer la obra</p>
          </div>
          <div class="portfolio-cards">
            ${portfolioCard('figurativo')}
            ${portfolioCard('no-figurativo')}
          </div>
        </div>
      </section>

      <section class="categories-section">
        <div class="container">
          <div class="section-header">
            <h2>Disciplinas</h2>
            <p>Cuatro lenguajes, una misma búsqueda</p>
          </div>
          <div class="categories-grid">
            ${M.DISCIPLINAS.map(d => `
              <a class="category-card" href="#obras/disciplinas/${encodeURIComponent(d)}">
                ${this.img(cats[d], d)}
                <div class="category-overlay">
                  <h3>${esc(d)}</h3>
                  <span>Ver colección</span>
                </div>
              </a>`).join('')}
          </div>
        </div>
      </section>

      <section class="recent-works">
        <div class="container">
          <div class="section-header">
            <h2>Obras recientes</h2>
            <p>Una selección de la producción más reciente</p>
          </div>
          <div class="works-grid">
            ${recientes.length ? recientes.map(w => this.workCard(w)).join('') : this.emptyState()}
          </div>
          <div class="text-center mt-2">
            <a href="#obras/recientes" class="btn btn-outline">Ver todas las obras</a>
          </div>
        </div>
      </section>

      <section class="section">
        <div class="container container-narrow">
          <div class="section-header">
            <h2>Trayectoria</h2>
          </div>
          <p style="text-align:center; color: var(--color-text-secondary); line-height:1.8; margin-bottom:2rem;">
            ${esc((bio.biografia || '').split('\n\n')[0] || '')}
          </p>
          <div class="text-center">
            <a href="#trayectoria" class="btn btn-outline">Conocer trayectoria completa</a>
          </div>
        </div>
      </section>

      <section class="section contact-band">
        <div class="container container-narrow text-center">
          <h2 style="margin-bottom:1rem;">Contacto</h2>
          <p style="color: var(--color-text-secondary); margin-bottom:2rem;">
            Para consultas sobre obras, exposiciones o proyectos especiales
          </p>
          ${contact.email && EMAIL_RE.test(contact.email)
            ? `<a href="mailto:${esc(contact.email)}" class="btn">${esc(contact.email)}</a>`
            : `<a href="#contacto" class="btn">Ir a Contacto</a>`}
          <div class="footer-social" style="margin-top:2rem;">
            ${this.socialLinks(contact)}
          </div>
        </div>
      </section>
    `;
  },

  // ---------- Portfolios base (Arte Figurativo / No Figurativo) ----------

  renderPortfolioBase(tipoKey) {
    const tipo = M.TIPOS[tipoKey];
    const base = (tipoKey === 'figurativo' ? this.cat.base.figurativo : this.cat.base.noFigurativo) || {};
    const groups = M.groupsForTipo(this.cat, tipoKey);
    const totalObras = M.publicWorks(this.cat).filter(w => w.tipo === tipoKey).length;
    const nSeries = groups.filter(g => g.kind === 'serie').length;

    return `
      <div class="page">
        <div class="container">
          ${this.crumbs(['#home', 'Inicio'], tipo.titulo)}
          <h1 class="page-title">${esc(tipo.titulo)}</h1>
          ${base.descripcion ? `<p class="page-lead">${esc(base.descripcion)}</p>` : ''}
          <div class="page-meta">
            ${nSeries ? `<span>${this.plural(nSeries, 'serie', 'series')}</span>` : ''}
            <span>${this.plural(totalObras, 'obra', 'obras')}</span>
          </div>
          <div class="works-grid">
            ${groups.length ? groups.map(g => this.groupCard(g)).join('') : this.emptyState(`Todavía no hay obras de ${tipo.titulo.toLowerCase()}.`)}
          </div>
        </div>
      </div>`;
  },

  // ---------- Serie ----------

  renderSerie(slug, tipoKey) {
    const group = M.findGroup(this.cat, slug, tipoKey);
    if (!group) {
      this.updateMeta({ title: 'Serie no encontrada — José Mizdraji', description: '', jsonLd: null });
      return `<div class="page"><div class="container"><h1 class="page-title">Serie no encontrada</h1><a href="#obras" class="btn btn-outline mt-2">Volver a obras</a></div></div>`;
    }
    const tipo = M.TIPOS[tipoKey];
    const nombre = M.groupTitle(group);
    const desc = group.serie ? group.serie.descripcion : '';
    const rango = M.yearRange(group.works);

    this.updateMeta({
      title: `${nombre} — ${tipo.titulo} — José Mizdraji`,
      description: (desc || `Obras de ${tipo.titulo.toLowerCase()} de José Mizdraji.`).slice(0, 160),
      jsonLd: null
    });

    const consulta = group.kind === 'serie'
      ? this.consultaLink({
          asunto: `Consulta por la serie "${nombre}"`,
          cuerpoSobre: `la serie "${nombre}" (${tipo.titulo})`,
          clase: 'btn',
          texto: 'Consultar por esta serie'
        })
      : '';

    return `
      <div class="page">
        <div class="container">
          ${this.crumbs(['#home', 'Inicio'], [`#${tipo.ruta}`, tipo.titulo], nombre)}
          <span class="tag tag-${tipoKey} tag-inline" style="margin-bottom:1rem;">${esc(tipo.titulo)}</span>
          <h1 class="page-title">${esc(nombre)}</h1>
          ${desc ? `<p class="page-lead">${esc(desc)}</p>` : ''}
          <div class="page-meta">
            <span>${this.plural(group.works.length, 'obra', 'obras')}</span>
            ${rango ? `<span>${esc(rango)}</span>` : ''}
          </div>
          ${consulta ? `<div style="max-width:360px; margin-bottom:3rem;">${consulta}</div>` : ''}
          <div class="works-grid">
            ${group.works.map(w => this.workCard(w)).join('')}
          </div>
        </div>
      </div>`;
  },

  // ---------- Obras (por series / por disciplina / más recientes) ----------

  renderObras(params) {
    let view = params[0] || 'series';
    let disc = params[1] || '';
    // Compatibilidad con enlaces viejos: #obras/Pinturas
    if (M.DISCIPLINAS.includes(params[0])) { view = 'disciplinas'; disc = params[0]; }
    if (!['series', 'disciplinas', 'recientes'].includes(view)) view = 'series';
    if (disc && !M.DISCIPLINAS.includes(disc)) disc = '';

    const switchLink = (key, label) =>
      `<a class="filter-btn ${view === key ? 'active' : ''}" href="#obras/${key}" ${view === key ? 'aria-current="page"' : ''}>${label}</a>`;

    const works = M.publicWorks(this.cat).sort(M.byRecent);
    let body = '';
    let tabs = '';

    if (view === 'series') {
      const groups = M.allGroups(this.cat);
      body = `<div class="works-grid">${groups.length ? groups.map(g => this.groupCard(g)).join('') : this.emptyState('Todavía no hay series cargadas.')}</div>`;
    } else if (view === 'disciplinas') {
      tabs = `
        <div class="filter-tabs" aria-label="Filtrar por disciplina">
          <a class="filter-btn ${!disc ? 'active' : ''}" href="#obras/disciplinas">Todas</a>
          ${M.DISCIPLINAS.map(d => `<a class="filter-btn ${disc === d ? 'active' : ''}" href="#obras/disciplinas/${encodeURIComponent(d)}">${esc(d)}</a>`).join('')}
        </div>`;
      if (disc) {
        const list = works.filter(w => w.categoria === disc);
        body = `<div class="works-grid">${list.length ? list.map(w => this.workCard(w)).join('') : this.emptyState(`Todavía no hay obras en ${disc}.`)}</div>`;
      } else {
        const blocks = M.DISCIPLINAS.map(d => {
          const list = works.filter(w => w.categoria === d);
          return list.length
            ? `<h2 class="group-title">${esc(d)}</h2><div class="works-grid">${list.map(w => this.workCard(w)).join('')}</div>`
            : '';
        }).join('');
        body = blocks || `<div class="works-grid">${this.emptyState()}</div>`;
      }
    } else {
      body = `<div class="works-grid">${works.length ? works.map(w => this.workCard(w)).join('') : this.emptyState()}</div>`;
    }

    return `
      <div class="page">
        <div class="container">
          ${this.crumbs(['#home', 'Inicio'], 'Obras')}
          <h1 class="page-title">Obras</h1>
          <div class="works-toolbar">
            <div class="view-switch" role="group" aria-label="Cómo ver las obras">
              <span class="view-switch-label">Ver por</span>
              ${switchLink('series', 'Series')}
              ${switchLink('disciplinas', 'Disciplinas')}
              ${switchLink('recientes', 'Más recientes')}
            </div>
            ${tabs}
          </div>
          ${body}
        </div>
      </div>`;
  },

  // ---------- Ficha de obra ----------

  renderObra(id) {
    const { cat } = this;
    const work = cat.worksById.get(id);
    // Las obras ocultas no tienen ficha pública (solo se ven dentro de un portfolio personalizado).
    if (!work || !work.visible) {
      this.updateMeta({ title: 'Obra no encontrada — José Mizdraji', description: '', jsonLd: null });
      return `<div class="page"><div class="container"><h1 class="page-title">Obra no encontrada</h1><a href="#obras" class="btn btn-outline mt-2">Volver a obras</a></div></div>`;
    }

    const series = M.visibleSeriesOf(cat, work);
    this.updateMeta({
      title: `${work.titulo} — José Mizdraji`,
      description: (work.descripcion || `${work.categoria}${work.año ? ', ' + work.año : ''}. Obra de José Mizdraji.`).slice(0, 160),
      jsonLd: {
        '@context': 'https://schema.org',
        '@type': 'VisualArtwork',
        name: work.titulo,
        artform: work.categoria,
        artMedium: work.tecnica,
        dateCreated: work.año ? String(work.año) : undefined,
        description: work.descripcion || undefined,
        image: work.imagenPrincipal ? new URL(normalizePath(work.imagenPrincipal), SITE_URL).toString() : undefined,
        creator: { '@type': 'Person', name: cat.bio.nombre || 'José Mizdraji' }
      }
    });

    const allThumbs = [work.imagenPrincipal, ...work.galeria].filter(Boolean);
    const thumbs = allThumbs.length > 1
      ? allThumbs.map((src, i) => `<img src="${esc(normalizePath(src))}" alt="${esc(work.titulo)} - vista ${i + 1}"
          class="thumb-btn ${i === 0 ? 'active' : ''}" data-src="${esc(normalizePath(src))}" tabindex="0" role="button" loading="lazy">`).join('')
      : '';

    const serieLinks = series.map(s =>
      `<a class="btn-serie-link" href="#serie/${encodeURIComponent(s.slug)}/${work.tipo || 'figurativo'}">${esc(s.nombre)}</a>`).join(' · ');

    const ficha = [
      ['Año', work.año],
      ['Técnica', work.tecnica],
      ['Medidas', work.medidas]
    ].filter(([, v]) => v)
      .map(([k, v]) => `<div class="meta-row"><span class="meta-label">${k}</span><span class="meta-value">${esc(v)}</span></div>`).join('');

    // Otras obras de cada serie (mismo portfolio que esta obra)
    const relacionadas = series.map(s => {
      const g = work.tipo ? M.findGroup(cat, s.slug, work.tipo) : null;
      const otras = g ? g.works.filter(w => w.id !== work.id) : [];
      if (!otras.length) return '';
      return `
        <div class="serie-related">
          <h3>Más obras de la serie <em>${esc(s.nombre)}</em></h3>
          <div class="serie-grid">${otras.map(w => this.workCard(w)).join('')}</div>
          <div style="margin-top:1.5rem;"><a class="more-link" href="#serie/${encodeURIComponent(s.slug)}/${work.tipo}">Ver toda la serie</a></div>
        </div>`;
    }).join('');

    return `
      <div class="artwork-detail">
        <div class="container">
          ${this.crumbs(['#home', 'Inicio'], ['#obras', 'Obras'], work.titulo)}
          <div class="artwork-hero">
            <div class="artwork-gallery">
              <div class="artwork-main-image">
                <img id="main-artwork-img" src="${esc(normalizePath(work.imagenPrincipal))}" alt="${esc(work.titulo)}" loading="eager">
              </div>
              ${thumbs ? `<div class="artwork-thumbs">${thumbs}</div>` : ''}
            </div>
            <div class="artwork-info">
              <span class="label">${esc(work.categoria)}</span>
              <h1>${esc(work.titulo)}</h1>
              ${series.length ? `<p class="artwork-subtitle">${series.length > 1 ? 'Series' : 'Serie'}: ${serieLinks}</p>` : ''}

              <div class="ficha">
                <div class="ficha-title">Ficha técnica</div>
                ${ficha}
              </div>

              ${work.descripcion ? `<div class="artwork-description">${esc(work.descripcion)}</div>` : ''}

              ${this.consultaLink({
                asunto: `Consulta por la obra "${work.titulo}"`,
                cuerpoSobre: `la obra "${work.titulo}"${work.año ? ` (${work.año})` : ''}`,
                texto: 'Consultar por esta obra'
              })}
            </div>
          </div>
          ${relacionadas}
        </div>
      </div>`;
  },

  bindObraDetailEvents() {
    document.querySelectorAll('.thumb-btn').forEach(thumb => {
      const activate = () => {
        const img = document.getElementById('main-artwork-img');
        if (img) img.src = thumb.dataset.src;
        document.querySelectorAll('.artwork-thumbs .thumb-btn').forEach(t => t.classList.remove('active'));
        thumb.classList.add('active');
      };
      thumb.addEventListener('click', activate);
      thumb.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); activate(); }
      });
    });
  },

  // ---------- Trayectoria ----------

  timeline(items) {
    const yr = (v) => v || '—';
    return `<div class="timeline">${(items || []).map(i => `
      <div class="timeline-item">
        <div class="timeline-year">${esc(yr(i.año))}</div>
        <div class="timeline-text"><strong>${esc(i.titulo || '')}</strong>${i.institucion ? `<br>${esc(i.institucion)}` : ''}${i.lugar ? `<br>${esc(i.lugar)}` : ''}${i.editorial ? `<br>${esc(i.editorial)}${i.lugar ? ', ' + esc(i.lugar) : ''}` : ''}</div>
      </div>`).join('')}
    </div>`;
  },

  renderTrayectoria() {
    const bio = this.cat.bio;
    const premios = M.pickFeatured(bio.premios, PREMIOS_VISIBLES);
    const individuales = M.pickFeatured(bio.exposicionesIndividuales, EXPOSICIONES_VISIBLES);
    const colectivas = M.pickFeatured(bio.exposicionesColectivas, EXPOSICIONES_VISIBLES);
    const hayColecciones = Array.isArray(bio.colecciones) && bio.colecciones.length;
    const hayPublicaciones = Array.isArray(bio.publicaciones) && bio.publicaciones.length;

    return `
      <div class="bio-section">
        <div class="container">
          ${this.crumbs(['#home', 'Inicio'], 'Trayectoria')}
          <div class="bio-grid">
            <aside class="bio-sidebar">
              ${bio.fotoPerfil ? `<img src="${esc(normalizePath(bio.fotoPerfil))}" alt="Foto de ${esc(bio.nombre)}" style="width:100%;aspect-ratio:1;object-fit:cover;margin-bottom:1.5rem;border:1px solid var(--color-border-light);" loading="lazy">` : ''}
              <nav aria-label="Secciones de trayectoria">
                <a href="#trayectoria" class="active" data-section="bio-biografia">Biografía</a>
                <a href="#trayectoria" data-section="bio-formacion">Formación</a>
                <a href="#trayectoria" data-section="bio-premios">Premios</a>
                <a href="#trayectoria" data-section="bio-exposiciones">Exposiciones</a>
                ${hayColecciones ? `<a href="#trayectoria" data-section="bio-colecciones">Colecciones</a>` : ''}
                ${hayPublicaciones ? `<a href="#trayectoria" data-section="bio-publicaciones">Publicaciones</a>` : ''}
              </nav>
            </aside>
            <div class="bio-content">
              <section id="bio-biografia">
                <h2>Biografía</h2>
                ${(bio.nacimiento || bio.tituloProfesional) ? `<p style="color:var(--color-text-secondary)">${esc([bio.nacimiento, bio.tituloProfesional].filter(Boolean).join(' — '))}</p>` : ''}
                ${(bio.biografia || '').split('\n\n').map(p => `<p>${esc(p)}</p>`).join('')}
              </section>

              <section id="bio-formacion" style="margin-top:4rem;">
                <h2>Formación</h2>
                ${this.timeline(bio.formacion)}
              </section>

              <section id="bio-premios" style="margin-top:4rem;">
                <h2>Premios y distinciones</h2>
                ${this.timeline(premios.shown)}
                ${premios.hasMore ? `<a class="more-link" href="#premios">Ver todos los premios (${premios.total})</a>` : ''}
              </section>

              <section id="bio-exposiciones" style="margin-top:4rem;">
                <h2>Exposiciones</h2>
                <div class="expo-columns">
                  <div>
                    <h3>Individuales</h3>
                    ${this.timeline(individuales.shown)}
                    ${individuales.hasMore ? `<a class="more-link" href="#exposiciones/individuales">Ver todas (${individuales.total})</a>` : ''}
                  </div>
                  <div>
                    <h3>Colectivas</h3>
                    ${this.timeline(colectivas.shown)}
                    ${colectivas.hasMore ? `<a class="more-link" href="#exposiciones/colectivas">Ver todas (${colectivas.total})</a>` : ''}
                  </div>
                </div>
              </section>

              ${hayColecciones ? `
              <section id="bio-colecciones" style="margin-top:4rem;">
                <h2>Colecciones</h2>
                <div class="timeline">${bio.colecciones.map(c => `<div class="timeline-item"><div class="timeline-text">${esc(c)}</div></div>`).join('')}</div>
              </section>` : ''}

              ${hayPublicaciones ? `
              <section id="bio-publicaciones" style="margin-top:4rem;">
                <h2>Publicaciones</h2>
                ${this.timeline(bio.publicaciones)}
              </section>` : ''}
            </div>
          </div>
        </div>
      </div>`;
  },

  bindTrayectoriaEvents() {
    // Los links del sidebar usan data-section en vez de onclick inline
    // (la política de seguridad no permite JS en línea).
    document.querySelectorAll('.bio-sidebar a[data-section]').forEach(link => {
      link.addEventListener('click', (e) => {
        e.preventDefault();
        const el = document.getElementById(link.dataset.section);
        if (el) {
          const top = el.getBoundingClientRect().top + window.scrollY - 100;
          window.scrollTo({ top, behavior: 'smooth' });
        }
        document.querySelectorAll('.bio-sidebar a').forEach(a => a.classList.remove('active'));
        link.classList.add('active');
      });
    });
  },

  renderPremios() {
    return `
      <div class="page">
        <div class="container container-narrow" style="margin:0 auto;">
          ${this.crumbs(['#home', 'Inicio'], ['#trayectoria', 'Trayectoria'], 'Premios')}
          <h1 class="page-title">Premios y distinciones</h1>
          <div class="page-meta"><span>${this.plural((this.cat.bio.premios || []).length, 'premio', 'premios')}</span></div>
          ${this.timeline(this.cat.bio.premios)}
          <a class="more-link" href="#trayectoria">Volver a Trayectoria</a>
        </div>
      </div>`;
  },

  renderExposiciones(que) {
    const bio = this.cat.bio;
    const tipo = que === 'colectivas' ? 'colectivas' : 'individuales';
    const lista = tipo === 'colectivas' ? bio.exposicionesColectivas : bio.exposicionesIndividuales;
    const otra = tipo === 'colectivas' ? 'individuales' : 'colectivas';
    return `
      <div class="page">
        <div class="container container-narrow" style="margin:0 auto;">
          ${this.crumbs(['#home', 'Inicio'], ['#trayectoria', 'Trayectoria'], `Exposiciones ${tipo}`)}
          <h1 class="page-title">Exposiciones ${tipo}</h1>
          <div class="page-meta"><span>${this.plural((lista || []).length, 'exposición', 'exposiciones')}</span></div>
          ${this.timeline(lista)}
          <div style="display:flex; gap:2rem; flex-wrap:wrap;">
            <a class="more-link" href="#exposiciones/${otra}">Ver exposiciones ${otra}</a>
            <a class="more-link" href="#trayectoria">Volver a Trayectoria</a>
          </div>
        </div>
      </div>`;
  },

  // ---------- Contacto ----------

  renderContacto() {
    const contact = this.cat.contact;
    const emailOk = contact.email && EMAIL_RE.test(contact.email);
    const fb = sanitizeUrl(contact.facebook);
    return `
      <div class="contact-section">
        <div class="container">
          ${this.crumbs(['#home', 'Inicio'], 'Contacto')}
          <div class="contact-grid">
            <div class="contact-info">
              <h2>Contacto</h2>
              <p>Para consultas sobre obras, exposiciones o cualquier otro tema relacionado con mi trabajo, no dudes en escribirme.</p>

              ${emailOk ? `
              <div class="contact-item">
                <div class="icon">&#9993;</div>
                <div><strong>Email</strong><a href="mailto:${esc(contact.email)}">${esc(contact.email)}</a></div>
              </div>` : ''}

              ${contact.instagram ? `
              <div class="contact-item">
                <div class="icon">&#128247;</div>
                <div><strong>Instagram</strong><a href="https://instagram.com/${esc(contact.instagram.replace('@', ''))}" target="_blank" rel="noopener noreferrer">${esc(contact.instagram.startsWith('@') ? contact.instagram : '@' + contact.instagram)}</a></div>
              </div>` : ''}

              ${fb ? `
              <div class="contact-item">
                <div class="icon">f</div>
                <div><strong>Facebook</strong><a href="${esc(fb)}" target="_blank" rel="noopener noreferrer">Ver página</a></div>
              </div>` : ''}

              ${(!emailOk && !contact.instagram && !fb) ? `
              <p style="color:var(--color-text-muted); font-size:0.9rem;">Los datos de contacto todavía no fueron cargados. Se completan desde el panel de administración.</p>` : ''}
            </div>

            <div class="contact-form">
              <form id="contact-form" novalidate>
                <div class="form-group"><label for="contact-name">Nombre</label><input type="text" id="contact-name" name="name" autocomplete="name" required></div>
                <div class="form-group"><label for="contact-email">Email</label><input type="email" id="contact-email" name="email" autocomplete="email" required></div>
                <div class="form-group"><label for="contact-subject">Asunto</label><input type="text" id="contact-subject" name="subject" required></div>
                <div class="form-group"><label for="contact-message">Mensaje</label><textarea id="contact-message" name="message" required></textarea></div>
                <button type="submit" class="btn" style="width:100%; justify-content:center;" ${emailOk ? '' : 'disabled title="Todavía no hay un email de contacto cargado"'}>Enviar mensaje</button>
              </form>
            </div>
          </div>
        </div>
      </div>`;
  },

  bindContactoEvents() {
    const form = document.getElementById('contact-form');
    if (!form) return;
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const to = this.cat.contact.email;
      // El dato viene del panel (usuario confiable), pero se valida igual antes de usarlo en location.href.
      if (!to || !EMAIL_RE.test(to)) return;
      const name = document.getElementById('contact-name').value;
      const email = document.getElementById('contact-email').value;
      const subject = document.getElementById('contact-subject').value;
      const message = document.getElementById('contact-message').value;
      const body = encodeURIComponent(`Nombre: ${name}\nEmail: ${email}\n\n${message}`);
      window.location.href = `mailto:${to}?subject=${encodeURIComponent(subject)}&body=${body}`;
    });
  },

  // ---------- Portfolios personalizados ----------

  renderPortfolioPersonalizado(route) {
    const p = M.findPortfolio(this.cat, route);
    this.setRobots(true);

    if (!p || !p.habilitado) {
      this.updateMeta({ title: 'Portfolio no disponible — José Mizdraji', description: '', jsonLd: null });
      return `
        <div class="page">
          <div class="container container-narrow" style="margin:0 auto; text-align:center;">
            <h1 class="page-title">Este portfolio no está disponible</h1>
            <p class="page-lead" style="margin:0 auto 2rem;">El enlace puede haber vencido o haberse deshabilitado. Si lo necesitás, escribinos y te lo enviamos nuevamente.</p>
            <a href="#home" class="btn btn-outline">Ir al inicio</a>
          </div>
        </div>`;
    }

    const sections = M.resolvePortfolio(this.cat, p);
    const titulo = p.titulo || `Portfolio ${p.enlace}`;
    const todas = sections.flatMap(s => s.works.map(w => ({ work: w, seccion: s })));
    this.lightbox = { items: todas, index: 0, portfolio: p };

    this.updateMeta({
      title: `${titulo} — José Mizdraji`,
      description: (p.descripcion || `Portfolio de José Mizdraji${p.destinatario ? ' para ' + p.destinatario : ''}.`).slice(0, 160),
      jsonLd: null
    });

    let idx = 0;
    const secHtml = sections.map(s => `
      <section class="portfolio-section" aria-labelledby="sec-${idx}">
        <h2 class="group-title" id="sec-${idx++}">${esc(s.titulo)}</h2>
        ${s.descripcion ? `<p class="portfolio-section-desc">${esc(s.descripcion)}</p>` : ''}
        <div class="works-grid">
          ${s.works.map(w => this.workCard(w, { as: 'button', index: todas.findIndex(t => t.work === w && t.seccion === s) })).join('')}
        </div>
      </section>`).join('');

    return `
      <div class="page">
        <div class="container">
          ${this.crumbs(['#home', 'Inicio'], titulo)}
          ${p.destinatario ? `<span class="label" style="display:block; margin-bottom:0.75rem;">${esc(p.destinatario)}</span>` : ''}
          <h1 class="page-title">${esc(titulo)}</h1>
          ${p.descripcion ? `<p class="page-lead">${esc(p.descripcion)}</p>` : ''}
          <div class="page-meta">
            <span>${esc(this.cat.bio.nombre || 'José Mizdraji')}</span>
            <span>${this.plural(todas.length, 'obra', 'obras')}</span>
          </div>


          ${secHtml || this.emptyState('Este portfolio todavía no tiene obras.')}
        </div>

        <dialog class="lightbox" id="lightbox" aria-label="Detalle de la obra"></dialog>
      </div>`;
  },

  bindPortfolioEvents() {
    const dialog = document.getElementById('lightbox');
    if (!dialog) return;

    document.querySelectorAll('[data-open]').forEach(btn => {
      btn.addEventListener('click', () => this.openLightbox(Number(btn.dataset.open)));
    });

    dialog.addEventListener('click', (e) => {
      if (e.target === dialog) dialog.close();                       // clic en el fondo
      if (e.target.closest('[data-lb="close"]')) dialog.close();
      if (e.target.closest('[data-lb="prev"]')) this.stepLightbox(-1);
      if (e.target.closest('[data-lb="next"]')) this.stepLightbox(1);
    });
    dialog.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowLeft') { e.preventDefault(); this.stepLightbox(-1); }
      if (e.key === 'ArrowRight') { e.preventDefault(); this.stepLightbox(1); }
    });

  },

  openLightbox(index) {
    const dialog = document.getElementById('lightbox');
    if (!dialog) return;
    this.lightbox.index = index;
    this.renderLightbox();
    if (!dialog.open) dialog.showModal();
  },

  closeLightbox() {
    const dialog = document.getElementById('lightbox');
    if (dialog && dialog.open) dialog.close();
  },

  stepLightbox(delta) {
    const n = this.lightbox.items.length;
    if (!n) return;
    this.lightbox.index = (this.lightbox.index + delta + n) % n;
    this.renderLightbox();
  },

  renderLightbox() {
    const dialog = document.getElementById('lightbox');
    const { items, index, portfolio } = this.lightbox;
    const item = items[index];
    if (!dialog || !item) return;
    const { work, seccion } = item;
    const ficha = [['Año', work.año], ['Técnica', work.tecnica], ['Medidas', work.medidas]]
      .filter(([, v]) => v)
      .map(([k, v]) => `<div class="meta-row"><span class="meta-label">${k}</span><span class="meta-value">${esc(v)}</span></div>`).join('');
    const nombrePortfolio = portfolio.titulo || `Portfolio ${portfolio.enlace}`;

    // Los controles se crean una sola vez: si se reemplazaran en cada cambio de obra,
    // el botón enfocado desaparecería y las flechas del teclado dejarían de responder.
    if (!dialog.querySelector('.lightbox-controls')) {
      dialog.innerHTML = `
      <div class="lightbox-controls">
        <button type="button" class="lightbox-btn" data-lb="prev" aria-label="Obra anterior">&#8592;</button>
        <button type="button" class="lightbox-btn" data-lb="next" aria-label="Obra siguiente">&#8594;</button>
        <button type="button" class="lightbox-btn" data-lb="close" aria-label="Cerrar">&#10005;</button>
      </div>
      <div class="lightbox-inner"></div>`;
    }
    dialog.querySelector('.lightbox-inner').innerHTML = `
        <div class="lightbox-image">${this.img(work.imagenPrincipal, work.titulo, { eager: true })}</div>
        <div class="lightbox-info">
          <span class="label">${esc(work.categoria)}</span>
          <h2>${esc(work.titulo)}</h2>
          ${seccion.serie ? `<p class="artwork-subtitle">Serie: ${esc(seccion.serie.nombre)}</p>` : ''}
          <div class="ficha">
            <div class="ficha-title">Ficha técnica</div>
            ${ficha}
          </div>
          ${work.descripcion ? `<div class="artwork-description">${esc(work.descripcion)}</div>` : ''}
          ${this.consultaLink({
            asunto: `Consulta por la obra "${work.titulo}"`,
            cuerpoSobre: `la obra "${work.titulo}"${work.año ? ` (${work.año})` : ''}, que vi en el portfolio "${nombrePortfolio}"`,
            texto: 'Consultar por esta obra'
          })}
        </div>`;
  },

};

// Los módulos se ejecutan diferidos (antes de DOMContentLoaded): se arranca una sola vez.
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => App.init(), { once: true });
} else {
  App.init();
}
