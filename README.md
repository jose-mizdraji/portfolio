# José Mizdraji — Portafolio (GitHub Pages + Sveltia CMS)

Sitio estático (sin backend) para el portafolio del artista visual José Mizdraji, con panel de administración web para cargar/editar/borrar obras y contenido sin tocar código.

URL final: **https://jose-mizdraji.github.io/portfolio/**
(No `www.` — un subdominio `*.github.io` no acepta ese prefijo salvo que compren un dominio propio y lo apunten con CNAME, que es algo aparte.)

## 📁 Estructura

```
portfolio/
├── index.html              # Sitio público (SPA, ruteo por #hash)
├── css/main.css
├── js/app.js                # Toda la lógica del sitio público
├── data/                    # Contenido editable — esto es lo que edita el CMS
│   ├── obras.json           # Catálogo de obras (Pinturas, Dibujos, Grabados, Esculturas)
│   ├── bio.json              # Biografía y trayectoria
│   └── contacto.json         # Datos de contacto
├── admin/                    # Panel de administración (Sveltia CMS)
│   ├── index.html
│   └── config.yml
├── assets/images/obras/       # Acá se guardan las fotos que se suben desde el panel
├── robots.txt
├── sitemap.xml
└── .gitignore
```

## 🚀 Deploy en GitHub Pages

1. En la cuenta **jose-mizdraji** de GitHub, creá un repo público llamado `portfolio`.
2. Subí todo el contenido de este proyecto (manteniendo la estructura de carpetas):
   ```bash
   cd portfolio
   git init
   git add .
   git commit -m "Sitio inicial"
   git branch -M main
   git remote add origin https://github.com/jose-mizdraji/portfolio.git
   git push -u origin main
   ```
3. En el repo: **Settings → Pages → Source → Deploy from a branch → `main` / `/ (root)`**.
4. A los 1-2 minutos el sitio queda online en la URL de arriba.

No hace falta ningún build step, Action ni proceso de compilación — es HTML/CSS/JS servido tal cual.

## 🔐 Panel de administración — cómo entrar

El panel usa **Sveltia CMS** (sucesor activamente mantenido de Decap/Netlify CMS — Decap ya no recibe casi mantenimiento). Se accede en:

**https://jose-mizdraji.github.io/portfolio/admin/**

### Por qué no hay un usuario/contraseña "propio" del sitio

Un sitio 100% estático en GitHub Pages no tiene backend que pueda verificar credenciales de forma segura — cualquier login hecho en JS del lado del cliente se puede leer y saltear desde el navegador. Por eso el acceso está delegado a la autenticación real de GitHub: quien tenga el token de abajo, puede editar el sitio. Es, de hecho, más seguro que un sistema de usuario/contraseña armado a mano.

### Generar el token de acceso (una sola vez)

1. Entrá a GitHub con la cuenta que va a usarse para administrar el sitio (la cuenta **jose-mizdraji**, ya que Gonzalo y José acordaron compartir una misma identidad).
2. Andá a **https://github.com/settings/personal-access-tokens/new** (token *fine-grained*, no "classic").
3. Completá:
   - **Repository access** → *Only select repositories* → `jose-mizdraji/portfolio`
   - **Permissions → Repository permissions → Contents** → `Read and write`
   - (el resto de los permisos quedan en "No access")
   - **Expiration**: 90 días (o el máximo que prefieran — se puede renovar cuando venza, GitHub avisa antes)
4. **Generate token** y copiá el valor que empieza con `github_pat_...`. GitHub lo muestra **una sola vez**.
5. Guardalo en un gestor de contraseñas compartido entre Gonzalo y José (no en un chat, no en un archivo del repo).
6. Andá a `/admin/`, tocá **"Sign In with Token"** (no "Login with GitHub", ese botón no está configurado a propósito) y pegá el token.

El token queda guardado en el `localStorage` del navegador donde iniciaron sesión — si usan dos dispositivos, cada uno necesita pegarlo una vez.

### ⚠️ Ojo con esto (para que no se rompa nada)

- **Cuando venza el token** (a los 90 días si usaron el default), el panel deja de funcionar hasta generar uno nuevo y volver a pegarlo. No es un bug, es la fecha de expiración que se configuró.
- **Sveltia CMS no soporta edición simultánea entre varios usuarios todavía.** Si Gonzalo y José editan al mismo tiempo, pueden pisarse cambios entre sí. Coordinen quién edita cuándo.
- Si en algún momento este flujo por token resulta incómodo (por ejemplo, si terminan siendo más de 2 personas editando), se puede migrar a un login con botón "Ingresar con GitHub" (OAuth) desplegando el ["Sveltia CMS Authenticator"](https://github.com/sveltia/sveltia-cms-auth) oficial en Cloudflare Workers (gratis). Es más trabajo de setup pero mejor UX. Avisen si llegan a ese punto y lo armamos.

## ✏️ Qué se puede editar desde el panel

- **Obras**: agregar, editar y borrar obras de cualquiera de las 4 categorías (Pinturas, Dibujos, Grabados, Esculturas), subir fotos, cambiar el estado (disponible/vendida/reservada), mostrar u ocultar precio, agregar galería de fotos adicionales por obra.
- **Trayectoria**: biografía, formación, premios, exposiciones individuales y colectivas, colecciones, publicaciones.
- **Contacto**: email, Instagram, Facebook, WhatsApp, dirección.

Cada commit que hace el panel queda firmado y verificado por GitHub, y en el historial del repo (`git log`) queda registro de cada cambio con fecha — sirve como respaldo/auditoría.

## ✅ Antes de publicar el sitio — checklist de placeholders

Este proyecto se armó con **datos reales de José Mizdraji donde se pudieron verificar en fuentes públicas**, pero hay campos que se dejaron vacíos o de ejemplo a propósito en vez de inventarlos. Cada archivo JSON tiene un campo `_pending_review` que lista lo que falta (también visible y editable como una lista al final de cada sección en el panel):

- **`data/obras.json`** — las 5 obras que están cargadas son *ejemplos de plantilla* (título con el prefijo `[EJEMPLO]`), no obras reales. Hay que borrarlas desde el panel y cargar el catálogo real.
- **`data/bio.json`** — biografía, formación, premios y exposiciones están completados con datos que verificamos en fuentes públicas (Arte de la Argentina, UNNE Medios, República de Corrientes, entre otras), pero:
  - `colecciones` y `publicaciones` quedaron **vacíos** porque no encontramos museos ni catálogos verificables — José es quien tiene esa información.
  - Varias exposiciones tienen el año vacío porque la fuente no lo especificaba.
  - Vale la pena que José revise todo el archivo una vez, por si alguna fuente de terceros tiene algo desactualizado o incompleto.
- **`data/contacto.json`** — email, Instagram, Facebook y WhatsApp están **vacíos a propósito** (no encontramos cuentas oficiales verificables). El botón de "Consultar por esta obra" y el formulario de contacto no funcionan del todo hasta que se cargue al menos un email.
- **`assets/images/`** — no hay ninguna foto real todavía, ni siquiera del artista o de una obra. Se suben desde el panel (pestaña de cada obra) o arrastrándolas directamente a `assets/images/` en GitHub.

## 🔒 Seguridad — qué se hizo y qué hay que tener en cuenta

- **CSP** (`Content-Security-Policy`) en `index.html` y en `admin/index.html`, vía `<meta>` tag (GitHub Pages no permite mandar headers HTTP custom sin un dominio propio detrás de un proxy). Limitación conocida: la directiva `frame-ancestors` no funciona en un `<meta>` tag — si en algún momento la protección anti-clickjacking importa de verdad, hace falta dominio propio + algo como Cloudflare delante.
- **SRI** (Subresource Integrity) en el script de Sveltia CMS: la versión queda fijada (`@0.172.4`) con un hash SHA-384 calculado a partir del paquete publicado en npm. Si un CDN sirviera un archivo modificado, el navegador se niega a ejecutarlo. Para actualizar de versión: bajar el nuevo tarball de `https://registry.npmjs.org/@sveltia/cms`, calcular `openssl dgst -sha384 -binary dist/sveltia-cms.js | openssl base64 -A`, y reemplazar versión + hash en `admin/index.html`.
- **Ningún secreto vive en el repo.** El token de acceso se pega en el navegador y se guarda en `localStorage`, nunca en un archivo versionado. No hay ningún Worker ni proxy OAuth con client secret hardcodeado (ese fue justamente el bug de la versión anterior del proyecto).
- **Todo el contenido dinámico se escapa** antes de insertarse en el HTML (`escapeHtml()` en `js/app.js`), y los links a obras/categorías usan atributos `href` reales en vez de `onclick` con strings interpolados — evita XSS por esa vía.
- **Mínimo privilegio**: el token de acceso solo puede leer/escribir contenido de este repo puntual, nada más.
- Recomendado (no configurado automáticamente porque depende de la cuenta): activar **2FA** en la cuenta de GitHub `jose-mizdraji`.

## 🔍 SEO — qué mejora y qué limitación queda

Se agregó `<title>` y meta description dinámicos por sección, y datos estructurados (JSON-LD, schema.org `Person` / `VisualArtwork`) inyectados por JS. Pero al ser una SPA con ruteo por `#hash`, buscadores como Google no indexan `/#obras` o `/#obra/id` como páginas separadas de la home — por eso `sitemap.xml` solo lista la raíz. Si en algún momento importa que cada obra sea encontrable individualmente en Google, la solución real es pre-renderizar o migrar a rutas de verdad, lo cual implica agregar un build step (dejamos de ser "cero infraestructura"). Avisen si eso pasa a ser prioridad.

## 🩹 Troubleshooting

- **"Error al cargar los datos"** → algún JSON en `data/` quedó mal formado. Abrí la consola del navegador (F12) para ver el error exacto, o pegá el archivo en un validador de JSON.
- **El panel no carga / da error de login** → confirmá que el token no venció y que tiene permiso `Contents: Read and write` sobre `jose-mizdraji/portfolio`.
- **Las fotos no se ven** → las rutas son relativas (`assets/images/obras/...`), no deberían empezar con `/`.
- **Los cambios no se reflejan** → GitHub Pages tarda 1-2 minutos en redeployar después de cada commit del panel. `Ctrl+Shift+R` para forzar recarga sin caché.

## 📄 Licencia
Proyecto desarrollado para José Mizdraji. Uso exclusivo del artista.
