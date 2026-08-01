// ============================================
// JOSÉ MIZDRAJI — SPA (GitHub Pages, sin backend)
// Carga datos desde JSON estáticos en /data.
// Editable en producción vía Sveltia CMS (/admin).
// ============================================

const SITE_URL = 'https://jose-mizdraji.github.io/portfolio/';
const CATEGORIES = ['Pinturas', 'Dibujos', 'Grabados', 'Esculturas'];

const App = {
  currentRoute: '',
  currentFilter: 'todas',
  currentSerie: '',
  currentSort: 'recientes',
  searchQuery: '',
  data: { works: [], bio: {}, contact: {} },
  loaded: false,

  async init() {
    await this.loadData();
    this.bindEvents();
    this.handleRoute();
    this.setupHeader();
  },

  async loadData() {
    try {
      const [worksRes, bioRes, contactRes] = await Promise.all([
        fetch('data/obras.json'),
        fetch('data/bio.json'),
        fetch('data/contacto.json')
      ]);
      const worksJson = await worksRes.json();
      // obras.json guarda { "obras": [...] } porque así es como el CMS
      // (Sveltia/Decap) persiste un campo "list" dentro de un archivo.
      this.data.works = Array.isArray(worksJson) ? worksJson : (worksJson.obras || []);
      this.data.bio = await bioRes.json();
      this.data.contact = await contactRes.json();
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

  bindEvents() {
    window.addEventListener('hashchange', () => this.handleRoute());
    window.addEventListener('scroll', () => this.handleScroll());
    document.addEventListener('click', (e) => {
      if (e.target.closest('.mobile-toggle')) {
        const nav = document.querySelector('.main-nav');
        const btn = e.target.closest('.mobile-toggle');
        const open = nav.classList.toggle('open');
        btn.setAttribute('aria-expanded', String(open));
      }
      if (e.target.closest('.main-nav a')) {
        document.querySelector('.main-nav').classList.remove('open');
      }
    });
  },

  setupHeader() {
    // El efecto de scroll del header se maneja en handleScroll().
  },

  handleScroll() {
    const header = document.querySelector('.site-header');
    if (window.scrollY > 50) header.classList.add('scrolled');
    else header.classList.remove('scrolled');
  },

  handleRoute() {
    if (!this.loaded) return;
    const hash = window.location.hash || '#home';
    const [route, param] = hash.replace('#', '').split('/');
    this.currentRoute = route;

    document.querySelectorAll('.main-nav a').forEach(a => {
      a.classList.toggle('active', a.getAttribute('href') === '#' + route);
    });

    window.scrollTo(0, 0);

    const main = document.getElementById('app-main');
    switch (route) {
      case 'home': case '':
        main.innerHTML = this.renderHome();
        this.updateMeta({
          title: 'José Mizdraji — Artista Visual',
          description: `Portafolio oficial de José Mizdraji, artista visual correntino. ${CATEGORIES.join(', ')}.`,
          jsonLd: this.personJsonLd()
        });
        break;
      case 'obras':
        if (param && CATEGORIES.includes(decodeURIComponent(param))) {
          this.currentFilter = decodeURIComponent(param);
        }
        main.innerHTML = this.renderObras();
        this.bindObrasEvents();
        this.updateMeta({
          title: 'Obras — José Mizdraji',
          description: 'Catálogo de obras de José Mizdraji: pinturas, dibujos, grabados y esculturas.',
          jsonLd: null
        });
        break;
      case 'obra':
        main.innerHTML = this.renderObra(param);
        this.bindObraDetailEvents();
        break; // updateMeta se llama dentro de renderObra (necesita datos de la obra)
      case 'trayectoria':
        main.innerHTML = this.renderTrayectoria();
        this.bindTrayectoriaEvents();
        this.updateMeta({
          title: 'Trayectoria — José Mizdraji',
          description: 'Biografía, formación, premios y exposiciones de José Mizdraji.',
          jsonLd: this.personJsonLd()
        });
        break;
      case 'contacto':
        main.innerHTML = this.renderContacto();
        this.bindContactoEvents();
        this.updateMeta({
          title: 'Contacto — José Mizdraji',
          description: 'Contacto de José Mizdraji, artista visual correntino.',
          jsonLd: null
        });
        break;
      default:
        main.innerHTML = this.renderHome();
    }
  },

  // ---------- SEO dinámico ----------
  // Nota honesta: como el sitio es una SPA con ruteo por #hash, esto mejora
  // el <title>/meta description que ve alguien que abre el link, pero los
  // buscadores en general NO indexan fragmentos #hash como páginas separadas.
  // Si en algún momento el SEO por obra individual es prioritario, la
  // solución real es pre-renderizar o migrar a rutas de verdad (con un
  // pequeño build step), no un parche de JS.
  updateMeta({ title, description, jsonLd }) {
    if (title) document.title = title;
    if (description) {
      let meta = document.querySelector('meta[name="description"]');
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

  personJsonLd() {
    const bio = this.data.bio;
    return {
      '@context': 'https://schema.org',
      '@type': 'Person',
      name: bio.nombre || 'José Mizdraji',
      jobTitle: bio.tituloProfesional || 'Artista visual',
      description: bio.subtitulo || '',
      url: SITE_URL
    };
  },

  // ---------- Home ----------
  renderHome() {
    const works = this.data.works.slice(0, 4);
    const bio = this.data.bio;
    const contact = this.data.contact;

    // Imágenes leídas desde bio.json (editables desde el panel CMS)
    const heroImg = bio.imagenHero || '';
    const cats = bio.imagenesCategorias || {};
    const textoInicio = bio.textoInicio || 'Su práctica abarca la pintura, el dibujo, el grabado y la escultura, cruzando memoria, entorno y materialidad.';

    return `
      <section class="hero">
        <div class="container">
          <div class="hero-grid">
            <div class="hero-content fade-in">
              <div class="hero-label">Artista Visual</div>
              <h1 class="hero-title">${this.escapeHtml(bio.nombre)}</h1>
              <p class="hero-subtitle">${this.escapeHtml(bio.subtitulo)}</p>
              <p class="hero-text">${this.escapeHtml(textoInicio)}</p>
              <a href="#obras" class="btn">Ver obras</a>
            </div>
            <div class="hero-image fade-in stagger-1">
              ${heroImg
                ? `<img src="${this.escapeHtml(this.normalizePath(heroImg))}" alt="Obra destacada de ${this.escapeHtml(bio.nombre)}" loading="eager" onerror="this.parentElement.style.display='none'">`
                : '<div class="hero-placeholder" style="width:100%;aspect-ratio:4/3;background:linear-gradient(135deg,#e8e6e1,#c5bfb5);"></div>'}
            </div>
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
            ${CATEGORIES.map(cat => {
              const imgSrc = cats[cat] || '';
              return `
              <a class="category-card" href="#obras/${encodeURIComponent(cat)}">
                ${imgSrc
                  ? `<img src="${this.escapeHtml(this.normalizePath(imgSrc))}" alt="${this.escapeHtml(cat)}" loading="lazy" onerror="this.style.display='none'">`
                  : ''}
                <div class="category-overlay">
                  <h3>${this.escapeHtml(cat)}</h3>
                  <span>Ver colección</span>
                </div>
              </a>`;
            }).join('')}
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
            ${works.length ? works.map(w => this.renderWorkCard(w)).join('') : this.renderEmptyState()}
          </div>
          <div class="text-center mt-2">
            <a href="#obras" class="btn btn-outline">Ver todas las obras</a>
          </div>
        </div>
      </section>

      <section class="section">
        <div class="container container-narrow">
          <div class="section-header">
            <h2>Trayectoria</h2>
          </div>
          <p style="text-align:center; color: var(--color-text-secondary); line-height:1.8; margin-bottom:2rem;">
            ${this.escapeHtml((bio.biografia || '').split('\n\n')[0] || '')}
          </p>
          <div class="text-center">
            <a href="#trayectoria" class="btn btn-outline">Conocer trayectoria completa</a>
          </div>
        </div>
      </section>

      <section class="section" style="background: var(--color-bg-alt);">
        <div class="container container-narrow text-center">
          <h2 style="margin-bottom:1rem;">Contacto</h2>
          <p style="color: var(--color-text-secondary); margin-bottom:2rem;">
            Para consultas sobre obras disponibles, exposiciones o proyectos especiales
          </p>
          ${contact.email
            ? `<a href="mailto:${this.escapeHtml(contact.email)}" class="btn">${this.escapeHtml(contact.email)}</a>`
            : `<a href="#contacto" class="btn">Ir a Contacto</a>`}
          <div class="footer-social" style="margin-top:2rem; justify-content:center;">
            ${contact.instagram ? `<a href="https://instagram.com/${this.escapeHtml(contact.instagram.replace('@', ''))}" target="_blank" rel="noopener noreferrer">Instagram</a>` : ''}
            ${contact.facebook ? `<a href="${this.escapeHtml(this.sanitizeUrl(contact.facebook))}" target="_blank" rel="noopener noreferrer">Facebook</a>` : ''}
          </div>
        </div>
      </section>
    `;
  },

  renderEmptyState(message = 'Todavía no hay obras cargadas en esta categoría.') {
    return `<div class="empty-state" style="grid-column: 1 / -1;"><h3>Sin resultados</h3><p>${this.escapeHtml(message)}</p></div>`;
  },

  renderWorkCard(work) {
    const statusClass = work.estado === 'vendida' ? 'vendida' : work.estado === 'reservada' ? 'reservada' : '';
    const statusText = work.estado === 'disponible' ? 'Disponible' : work.estado === 'vendida' ? 'Vendida' : 'Reservada';
    return `
      <a class="work-card fade-in" href="#obra/${encodeURIComponent(work.id)}">
        <div class="work-card-image">
          <img src="${this.escapeHtml(this.normalizePath(work.imagenPrincipal))}" alt="${this.escapeHtml(work.titulo)}" loading="lazy" onerror="this.parentElement.style.background='linear-gradient(135deg,#e8e6e1,#d5d0c8)'">
          <span class="work-status ${statusClass}">${statusText}</span>
        </div>
        <div class="work-card-info">
          <h3>${this.escapeHtml(work.titulo)}</h3>
          <div class="meta">
            <span>${this.escapeHtml(work.categoria)}</span>
            <span>${this.escapeHtml(String(work.año ?? ''))}</span>
            <span>${this.escapeHtml(work.tecnica)}</span>
          </div>
        </div>
      </a>
    `;
  },

  // ---------- Obras (listado + filtro + búsqueda + orden) ----------
  renderObras() {
    return `
      <div class="section">
        <div class="container">
          <div class="breadcrumbs">
            <a href="#home">Inicio</a> <span>/</span> Obras
          </div>
          <div class="section-header" style="text-align:left; margin-bottom:2rem;">
            <h1 style="font-size: clamp(2rem, 4vw, 3rem);">Obras</h1>
          </div>
          <div class="works-toolbar">
            <div class="filter-tabs" role="tablist" aria-label="Filtrar por disciplina">
              <button class="filter-btn ${this.currentFilter === 'todas' && !this.currentSerie ? 'active' : ''}" data-filter="todas">Todas</button>
              ${CATEGORIES.map(cat => `
                <button class="filter-btn ${this.currentFilter === cat && !this.currentSerie ? 'active' : ''}" data-filter="${this.escapeHtml(cat)}">${this.escapeHtml(cat)}</button>
              `).join('')}
            </div>
            ${(() => {
              const series = [...new Set(this.data.works.map(w => (w.serie||'').trim()).filter(Boolean))].sort((a,b) => a.localeCompare(b));
              return series.length ? `
              <div class="filter-tabs filter-tabs-series" role="group" aria-label="Filtrar por serie">
                <span class="filter-series-label">Serie</span>
                ${series.map(s => `<button class="filter-btn filter-btn-serie ${this.currentSerie === s ? 'active' : ''}" data-serie="${this.escapeHtml(s)}">${this.escapeHtml(s)}</button>`).join('')}
              </div>` : '';
            })()}
            <div class="works-toolbar-bottom">
              <div class="search-box">
                <label for="obra-search" class="visually-hidden">Buscar obra</label>
                <input type="text" id="obra-search" placeholder="Buscar obra..." value="${this.escapeHtml(this.searchQuery)}">
              </div>
              <div style="display:flex;gap:1rem;align-items:center;">
                <label for="obra-sort" class="visually-hidden">Ordenar obras</label>
                <select class="sort-select" id="obra-sort">
                  <option value="recientes" ${this.currentSort === 'recientes' ? 'selected' : ''}>Más recientes</option>
                  <option value="antiguas" ${this.currentSort === 'antiguas' ? 'selected' : ''}>Más antiguas</option>
                  <option value="titulo" ${this.currentSort === 'titulo' ? 'selected' : ''}>Título</option>
                </select>
              </div>
            </div>
          </div>
          <div class="works-grid" id="obras-grid">
            ${this.renderObrasGrid()}
          </div>
        </div>
      </div>
    `;
  },

  renderObrasGrid() {
    let works = [...this.data.works];

    if (this.currentSerie) {
      // Filtro por serie — muestra todas las disciplinas de esa serie
      works = works.filter(w => (w.serie || '').trim() === this.currentSerie);
    } else if (this.currentFilter !== 'todas') {
      works = works.filter(w => w.categoria === this.currentFilter);
    }

    if (this.searchQuery) {
      const q = this.searchQuery.toLowerCase();
      works = works.filter(w =>
        (w.titulo || '').toLowerCase().includes(q) ||
        (w.tecnica || '').toLowerCase().includes(q) ||
        (w.descripcion || '').toLowerCase().includes(q) ||
        (w.serie || '').toLowerCase().includes(q)
      );
    }

    if (this.currentSort === 'recientes') {
      works.sort((a, b) => (b.año - a.año) || new Date(b.fechaCarga) - new Date(a.fechaCarga));
    } else if (this.currentSort === 'antiguas') {
      works.sort((a, b) => (a.año - b.año) || new Date(a.fechaCarga) - new Date(b.fechaCarga));
    } else if (this.currentSort === 'titulo') {
      works.sort((a, b) => (a.titulo || '').localeCompare(b.titulo || ''));
    }

    if (works.length === 0) return this.renderEmptyState('No se encontraron obras con esos filtros.');
    return works.map(w => this.renderWorkCard(w)).join('');
  },

  bindObrasEvents() {
    // Botones de disciplina: limpian la serie seleccionada
    document.querySelectorAll('.filter-btn[data-filter]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        this.currentSerie = '';
        this.currentFilter = e.target.dataset.filter;
        document.querySelectorAll('.filter-btn[data-filter]').forEach(b => b.classList.remove('active'));
        e.target.classList.add('active');
        document.querySelectorAll('.filter-btn-serie').forEach(b => b.classList.remove('active'));
        document.getElementById('obras-grid').innerHTML = this.renderObrasGrid();
      });
    });

    // Botones de serie: limpian el filtro de disciplina
    document.querySelectorAll('.filter-btn-serie').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const serie = e.target.dataset.serie;
        if (this.currentSerie === serie) {
          // segundo clic en la misma serie → deseleccionar (volver a Todas)
          this.currentSerie = '';
          this.currentFilter = 'todas';
          e.target.classList.remove('active');
          document.querySelector('.filter-btn[data-filter="todas"]').classList.add('active');
        } else {
          this.currentSerie = serie;
          this.currentFilter = 'todas';
          document.querySelectorAll('.filter-btn[data-filter]').forEach(b => b.classList.remove('active'));
          document.querySelectorAll('.filter-btn-serie').forEach(b => b.classList.remove('active'));
          e.target.classList.add('active');
        }
        document.getElementById('obras-grid').innerHTML = this.renderObrasGrid();
      });
    });

    const searchInput = document.getElementById('obra-search');
    if (searchInput) {
      searchInput.addEventListener('input', (e) => {
        this.searchQuery = e.target.value;
        document.getElementById('obras-grid').innerHTML = this.renderObrasGrid();
      });
    }

    const sortSelect = document.getElementById('obra-sort');
    if (sortSelect) {
      sortSelect.addEventListener('change', (e) => {
        this.currentSort = e.target.value;
        document.getElementById('obras-grid').innerHTML = this.renderObrasGrid();
      });
    }
  },

  // ---------- Ficha de obra individual ----------
  renderObra(id) {
    const work = this.data.works.find(w => w.id === id);
    if (!work) {
      this.updateMeta({ title: 'Obra no encontrada — José Mizdraji', description: '', jsonLd: null });
      return `<div class="section container"><h1>Obra no encontrada</h1><a href="#obras" class="btn btn-outline mt-2">Volver a obras</a></div>`;
    }

    this.updateMeta({
      title: `${work.titulo} — José Mizdraji`,
      description: (work.descripcion || '').slice(0, 160),
      jsonLd: {
        '@context': 'https://schema.org',
        '@type': 'VisualArtwork',
        name: work.titulo,
        artform: work.categoria,
        artMedium: work.tecnica,
        dateCreated: String(work.año || ''),
        description: work.descripcion || '',
        image: work.imagenPrincipal ? new URL(work.imagenPrincipal, SITE_URL).toString() : undefined,
        creator: { '@type': 'Person', name: this.data.bio.nombre || 'José Mizdraji' }
      }
    });

    const contact = this.data.contact;
    const statusClass = work.estado === 'vendida' ? 'vendida' : work.estado === 'reservada' ? 'reservada' : '';
    const statusText = work.estado === 'disponible' ? 'Disponible' : work.estado === 'vendida' ? 'Vendida' : 'Reservada';
    const mailtoSubject = encodeURIComponent(`Consulta por la obra "${work.titulo}"`);
    const mailtoBody = encodeURIComponent(`Hola,\n\nMe interesa obtener información sobre la obra "${work.titulo}" (${work.año}).\n\nQuedo atento/a a su respuesta.\n\nSaludos cordiales.`);
    const mailtoLink = contact.email ? `mailto:${this.escapeHtml(contact.email)}?subject=${mailtoSubject}&body=${mailtoBody}` : null;

    // Bug 2 fix: la imagen principal siempre va primero en los thumbs.
    // Antes solo se mostraban los items de work.galeria, así que después de
    // hacer click en una galería no había forma de volver a la imagen principal.
    const allThumbs = [
      work.imagenPrincipal,
      ...((work.galeria && work.galeria.length > 0) ? work.galeria : [])
    ].filter(Boolean);

    const galleryThumbs = allThumbs.length > 1
      ? allThumbs.map((img, i) => `<img
          src="${this.escapeHtml(this.normalizePath(img))}"
          alt="${this.escapeHtml(work.titulo)} - vista ${i + 1}"
          class="thumb-btn ${i === 0 ? 'active' : ''}"
          data-src="${this.escapeHtml(this.normalizePath(img))}"
          tabindex="0" role="button" loading="lazy">`).join('')
      : '';

    return `
      <div class="artwork-detail">
        <div class="container">
          <div class="breadcrumbs">
            <a href="#home">Inicio</a> <span>/</span> <a href="#obras">Obras</a> <span>/</span> ${this.escapeHtml(work.titulo)}
          </div>
          <div class="artwork-hero">
            <div class="artwork-gallery">
              <div class="artwork-main-image">
                <img id="main-artwork-img" src="${this.escapeHtml(this.normalizePath(work.imagenPrincipal))}" alt="${this.escapeHtml(work.titulo)}" loading="eager" onerror="this.parentElement.innerHTML='<div style=\\'padding:4rem;color:var(--color-text-muted)\\'>Imagen no disponible</div>'">
              </div>
              ${galleryThumbs ? `<div class="artwork-thumbs">${galleryThumbs}</div>` : ''}
            </div>
            <div class="artwork-info">
              <span class="label">${this.escapeHtml(work.categoria)}</span>
              <h1>${this.escapeHtml(work.titulo)}</h1>
              <p class="year">${this.escapeHtml(String(work.año ?? ''))}${work.serie
                ? ` · <button class="btn-serie-link" data-serie="${this.escapeHtml(work.serie)}">↳ ${this.escapeHtml(work.serie)}</button>`
                : ''}</p>

              <div class="artwork-meta">
                <div class="meta-row"><span class="meta-label">Técnica</span><span class="meta-value">${this.escapeHtml(work.tecnica)}</span></div>
                <div class="meta-row"><span class="meta-label">Materiales</span><span class="meta-value">${this.escapeHtml(work.materiales)}</span></div>
                <div class="meta-row"><span class="meta-label">Medidas</span><span class="meta-value">${this.escapeHtml(work.medidas)}</span></div>
                <div class="meta-row"><span class="meta-label">Estado</span><span class="meta-value" style="text-transform:capitalize;">${statusText}</span></div>
                ${work.mostrarPrecio && work.precio ? `<div class="meta-row"><span class="meta-label">Precio</span><span class="meta-value">USD ${Number(work.precio).toLocaleString()}</span></div>` : ''}
              </div>

              <div class="artwork-description">
                <p>${this.escapeHtml(work.descripcion)}</p>
              </div>

              ${work.estado === 'disponible'
                ? (mailtoLink
                    ? `<a href="${this.escapeHtml(mailtoLink)}" class="btn btn-buy">Consultar por esta obra</a>
                       <p style="font-size:0.75rem; color:var(--color-text-muted); margin-top:0.75rem; text-align:center;">Se abrirá tu cliente de correo con los datos de la obra</p>`
                    : `<a href="#contacto" class="btn btn-buy">Consultar por esta obra</a>`)
                : work.estado === 'reservada'
                  ? `<button class="btn btn-buy" disabled style="opacity:0.5; cursor:not-allowed;">Obra reservada</button>`
                  : `<button class="btn btn-buy" disabled style="opacity:0.5; cursor:not-allowed;">Obra vendida</button>`
              }
            </div>
          </div>
          ${(() => {
            if (!work.serie) return '';
            const serieWorks = this.data.works.filter(w => w.serie === work.serie && w.id !== work.id);
            if (!serieWorks.length) return '';
            return `
              <div class="serie-related">
                <h3>Más obras de esta serie: <em>${this.escapeHtml(work.serie)}</em></h3>
                <div class="serie-grid">
                  ${serieWorks.map(w => this.renderWorkCard(w)).join('')}
                </div>
              </div>`;
          })()}
        </div>
      </div>
    `;
  },

  bindObraDetailEvents() {
    // Link de serie en detalle de obra → navega a Obras filtrado por esa serie
    document.querySelectorAll('.btn-serie-link').forEach(btn => {
      btn.addEventListener('click', () => {
        this.currentSerie = btn.dataset.serie;
        this.currentFilter = 'todas';
        window.location.hash = '#obras';
      });
    });

    document.querySelectorAll('.thumb-btn').forEach(thumb => {
      const activate = () => this.setMainImage(thumb.dataset.src, thumb);
      thumb.addEventListener('click', activate);
      thumb.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); activate(); }
      });
    });
  },

  setMainImage(src, thumb) {
    const img = document.getElementById('main-artwork-img');
    if (img) img.src = src;
    document.querySelectorAll('.artwork-thumbs .thumb-btn').forEach(t => t.classList.remove('active'));
    thumb.classList.add('active');
  },

  // ---------- Trayectoria ----------
  renderTrayectoria() {
    const bio = this.data.bio;
    const yr = (v) => v || '—';
    const timelineBlock = (items) => `
      <div class="timeline">${(items || []).map(i => `
        <div class="timeline-item">
          <div class="timeline-year">${this.escapeHtml(yr(i.año))}</div>
          <div class="timeline-text"><strong>${this.escapeHtml(i.titulo || '')}</strong>${i.institucion ? `<br>${this.escapeHtml(i.institucion)}` : ''}${i.lugar ? `<br>${this.escapeHtml(i.lugar)}` : ''}${i.editorial ? `<br>${this.escapeHtml(i.editorial)}${i.lugar ? ', ' + this.escapeHtml(i.lugar) : ''}` : ''}</div>
        </div>`).join('')}
      </div>`;

    return `
      <div class="bio-section">
        <div class="container">
          <div class="breadcrumbs">
            <a href="#home">Inicio</a> <span>/</span> Trayectoria
          </div>
          <div class="bio-grid">
            <aside class="bio-sidebar">
              ${bio.fotoPerfil ? `<img src="${this.escapeHtml(this.normalizePath(bio.fotoPerfil))}" alt="Foto de ${this.escapeHtml(bio.nombre)}" style="width:100%;aspect-ratio:1;object-fit:cover;margin-bottom:1.5rem;border:1px solid var(--color-border-light);" loading="lazy">` : ''}
              <nav aria-label="Secciones de trayectoria">
                <a href="#trayectoria" class="active" data-section="bio-biografia">Biografía</a>
                <a href="#trayectoria" data-section="bio-formacion">Formación</a>
                <a href="#trayectoria" data-section="bio-premios">Premios</a>
                <a href="#trayectoria" data-section="bio-individuales">Exposiciones Individuales</a>
                <a href="#trayectoria" data-section="bio-colectivas">Exposiciones Colectivas</a>
                ${(bio.colecciones && bio.colecciones.length) ? `<a href="#trayectoria" data-section="bio-colecciones">Colecciones</a>` : ''}
                ${(bio.publicaciones && bio.publicaciones.length) ? `<a href="#trayectoria" data-section="bio-publicaciones">Publicaciones</a>` : ''}
              </nav>
            </aside>
            <div class="bio-content">
              <section id="bio-biografia">
                <h2>Biografía</h2>
                ${(bio.nacimiento || bio.tituloProfesional) ? `<p style="color:var(--color-text-secondary)">${this.escapeHtml([bio.nacimiento, bio.tituloProfesional].filter(Boolean).join(' — '))}</p>` : ''}
                ${(bio.biografia || '').split('\n\n').map(p => `<p>${this.escapeHtml(p)}</p>`).join('')}
              </section>

              <section id="bio-formacion" style="margin-top:4rem;">
                <h2>Formación</h2>
                ${timelineBlock(bio.formacion)}
              </section>

              <section id="bio-premios" style="margin-top:4rem;">
                <h2>Premios y Distinciones</h2>
                ${timelineBlock(bio.premios)}
              </section>

              <section id="bio-individuales" style="margin-top:4rem;">
                <h2>Exposiciones Individuales</h2>
                ${timelineBlock(bio.exposicionesIndividuales)}
              </section>

              <section id="bio-colectivas" style="margin-top:4rem;">
                <h2>Exposiciones Colectivas</h2>
                ${timelineBlock(bio.exposicionesColectivas)}
              </section>

              ${(bio.colecciones && bio.colecciones.length) ? `
              <section id="bio-colecciones" style="margin-top:4rem;">
                <h2>Colecciones</h2>
                <div class="timeline">${bio.colecciones.map(c => `<div class="timeline-item"><div class="timeline-text">${this.escapeHtml(c)}</div></div>`).join('')}</div>
              </section>` : ''}

              ${(bio.publicaciones && bio.publicaciones.length) ? `
              <section id="bio-publicaciones" style="margin-top:4rem;">
                <h2>Publicaciones</h2>
                ${timelineBlock(bio.publicaciones)}
              </section>` : ''}
            </div>
          </div>
        </div>
      </div>
    `;
  },

  bindTrayectoriaEvents() {
    // Los links del sidebar usan data-section en vez de onclick inline
    // porque App es const (no window.App) y los handlers inline no pueden encontrarlo.
    document.querySelectorAll('.bio-sidebar a[data-section]').forEach(link => {
      link.addEventListener('click', (e) => {
        e.preventDefault();
        const sectionId = link.dataset.section;
        const el = document.getElementById(sectionId);
        if (el) {
          const top = el.getBoundingClientRect().top + window.scrollY - 100;
          window.scrollTo({ top, behavior: 'smooth' });
        }
        document.querySelectorAll('.bio-sidebar a').forEach(a => a.classList.remove('active'));
        link.classList.add('active');
      });
    });
  },

  scrollToSection(id, event) {
    if (event) event.preventDefault();
    const el = document.getElementById(id);
    if (el) {
      const offset = 100;
      const top = el.getBoundingClientRect().top + window.pageYOffset - offset;
      window.scrollTo({ top, behavior: 'smooth' });
    }
    document.querySelectorAll('.bio-sidebar a').forEach(a => a.classList.remove('active'));
    if (event) event.target.classList.add('active');
  },

  // ---------- Contacto ----------
  renderContacto() {
    const contact = this.data.contact;
    return `
      <div class="contact-section">
        <div class="container">
          <div class="breadcrumbs">
            <a href="#home">Inicio</a> <span>/</span> Contacto
          </div>
          <div class="contact-grid">
            <div class="contact-info">
              <h2>Contacto</h2>
              <p>Para consultas sobre obras disponibles, adquisiciones, exposiciones o cualquier otro tema relacionado con mi trabajo, no dudes en escribirme.</p>

              ${contact.email ? `
              <div class="contact-item">
                <div class="icon">&#9993;</div>
                <div><strong>Email</strong><a href="mailto:${this.escapeHtml(contact.email)}">${this.escapeHtml(contact.email)}</a></div>
              </div>` : ''}

              ${contact.instagram ? `
              <div class="contact-item">
                <div class="icon">&#128247;</div>
                <div><strong>Instagram</strong><a href="https://instagram.com/${this.escapeHtml(contact.instagram.replace('@', ''))}" target="_blank" rel="noopener noreferrer">${this.escapeHtml(contact.instagram)}</a></div>
              </div>` : ''}

              ${contact.facebook ? `
              <div class="contact-item">
                <div class="icon">f</div>
                <div><strong>Facebook</strong><a href="${this.escapeHtml(this.sanitizeUrl(contact.facebook))}" target="_blank" rel="noopener noreferrer">Ver página</a></div>
              </div>` : ''}

              ${contact.whatsapp ? `
              <div class="contact-item">
                <div class="icon">&#128241;</div>
                <div><strong>WhatsApp</strong><a href="https://wa.me/${this.escapeHtml(contact.whatsapp.replace(/\D/g, ''))}" target="_blank" rel="noopener noreferrer">${this.escapeHtml(contact.whatsapp)}</a></div>
              </div>` : ''}

              ${contact.direccion ? `
              <div class="contact-item">
                <div class="icon">&#128205;</div>
                <div><strong>Ubicación</strong><span>${this.escapeHtml(contact.direccion)}</span></div>
              </div>` : ''}

              ${(!contact.email && !contact.instagram && !contact.facebook && !contact.whatsapp) ? `
              <p style="color:var(--color-text-muted); font-size:0.9rem;">Los datos de contacto todavía no fueron cargados. Se completan desde el panel de administración (<code>data/contacto.json</code>).</p>` : ''}
            </div>

            <div class="contact-form">
              <form id="contact-form" novalidate>
                <div class="form-group"><label for="contact-name">Nombre</label><input type="text" id="contact-name" name="name" autocomplete="name" required></div>
                <div class="form-group"><label for="contact-email">Email</label><input type="email" id="contact-email" name="email" autocomplete="email" required></div>
                <div class="form-group"><label for="contact-subject">Asunto</label><input type="text" id="contact-subject" name="subject" required></div>
                <div class="form-group"><label for="contact-message">Mensaje</label><textarea id="contact-message" name="message" required></textarea></div>
                <button type="submit" class="btn" style="width:100%; justify-content:center;" ${contact.email ? '' : 'disabled title="Todavía no hay un email de contacto cargado"'}>Enviar mensaje</button>
              </form>
            </div>
          </div>
        </div>
      </div>
    `;
  },

  bindContactoEvents() {
    const form = document.getElementById('contact-form');
    if (form) {
      form.addEventListener('submit', (e) => {
        e.preventDefault();
        const contact = this.data.contact;
        if (!contact.email) return;
        // Validar que contact.email tiene formato email antes de usarlo en location.href.
        // El dato viene del CMS (usuario confiable), pero la validación es defensa en profundidad.
        const emailRegex = /^[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}$/;
        if (!emailRegex.test(contact.email)) {
          console.warn('Email de contacto con formato inválido — verificar en el panel CMS.');
          return;
        }
        const name = document.getElementById('contact-name').value;
        const email = document.getElementById('contact-email').value;
        const subject = document.getElementById('contact-subject').value;
        const message = document.getElementById('contact-message').value;
        const body = encodeURIComponent(`Nombre: ${name}\nEmail: ${email}\n\n${message}`);
        window.location.href = `mailto:${contact.email}?subject=${encodeURIComponent(subject)}&body=${body}`;
      });
    }
  },

  // ---------- Utilidades ----------

  // Sveltia CMS (y Decap) guardan rutas de imagen con "/" inicial absoluto
  // desde la raíz del dominio. En un sitio deployado en subdirectorio
  // (/portfolio/) eso rompe las imágenes porque el navegador busca en
  // https://jose-mizdraji.github.io/assets/... en vez de .../portfolio/assets/...
  // Esta función normaliza ambas variantes a ruta relativa (sin "/" inicial),
  // lo que siempre funciona correctamente desde index.html.
  //
  // Ejemplos de entrada → salida:
  //   "/assets/images/obras/foto.jpg"    → "assets/images/obras/foto.jpg"
  //   "/portfolio/assets/images/foto.jpg" → "assets/images/foto.jpg"  (futuro, si se corrige config.yml)
  //   "assets/images/obras/foto.jpg"     → sin cambio (ya es relativa)
  //   ""  / null / undefined             → ""
  normalizePath(path) {
    if (!path) return '';
    // Quitar cualquier "/" o secuencia de directorios al inicio hasta llegar a "assets/"
    return path.replace(/^(\/portfolio)?\//, '');
  },

  // Valida que una URL sea https:// o http:// antes de usarla en un href.
  // escapeHtml() NO protege contra href="javascript:..." porque ese string
  // no tiene caracteres HTML especiales. Esta función sí lo bloquea.
  sanitizeUrl(url) {
    if (!url) return '';
    const trimmed = String(url).trim();
    if (/^https?:\/\//i.test(trimmed)) return trimmed;
    return ''; // bloquear javascript:, data:, y cualquier otro protocolo
  },

  escapeHtml(str) {
    if (str === null || str === undefined) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }
};

document.addEventListener('DOMContentLoaded', () => App.init());
