# José Mizdraji — Portafolio (GitHub Pages + Sveltia CMS)

Sitio estático (sin backend) para el portafolio del artista visual José Mizdraji, con panel de administración web para cargar/editar/borrar obras y contenido sin tocar código.

**Sitio:** https://jose-mizdraji.github.io/portfolio/
**Panel de administración:** https://jose-mizdraji.github.io/portfolio/admin/

(No lleva `www.` — un subdominio `*.github.io` no acepta ese prefijo salvo con dominio propio apuntado por CNAME.)

Diseñado por Jagā Digital Hub.

## 📁 Estructura

```
portfolio/
├── index.html              # Sitio público (SPA, ruteo por #hash)
├── 404.html                # Página de error, redirige al inicio
├── css/main.css
├── js/app.js               # Toda la lógica del sitio público
├── data/                   # Contenido editable — esto es lo que edita el CMS
│   ├── obras.json          # Catálogo (Pinturas, Dibujos, Grabados, Esculturas)
│   ├── bio.json            # Imágenes del inicio + biografía y trayectoria
│   └── contacto.json       # Datos de contacto
├── admin/                  # Panel de administración (Sveltia CMS)
│   ├── index.html
│   └── config.yml
├── assets/images/          # Todas las fotos subidas desde el panel
├── robots.txt
├── sitemap.xml
└── .nojekyll               # Evita que GitHub Pages procese el sitio con Jekyll
```

## 🔐 Panel de administración — cómo entrar

El panel usa **Sveltia CMS** (sucesor activamente mantenido de Decap/Netlify CMS).

### Por qué no hay un usuario/contraseña propio del sitio

Un sitio 100% estático en GitHub Pages no tiene backend que pueda verificar credenciales de forma segura — cualquier login hecho en JS del lado del cliente se puede leer y saltear desde el navegador. Por eso el acceso está delegado a la autenticación real de GitHub. Es más seguro que un sistema de usuario/contraseña armado a mano.

### Generar el token de acceso

1. Entrar a GitHub con la cuenta **jose-mizdraji**.
2. Ir a https://github.com/settings/personal-access-tokens/new (token *fine-grained*, no "classic").
3. Completar:
   - **Repository access** → *Only select repositories* → `jose-mizdraji/portfolio`
   - **Permissions → Repository permissions → Contents** → `Read and write`
   - **Expiration**: 90 días (renovable)
4. **Generate token** y copiar el valor `github_pat_...`. GitHub lo muestra **una sola vez**.
5. Guardarlo en un gestor de contraseñas compartido (no en un chat, no en un archivo del repo).
6. En `/admin/`, tocar **"Sign In with Token"** y pegarlo.

El token queda en el `localStorage` del navegador. Cada dispositivo necesita pegarlo una vez.

### ⚠️ Cosas a tener en cuenta

- **Cuando venza el token**, el panel deja de funcionar hasta generar uno nuevo. No es un bug.
- **Sveltia no soporta edición simultánea.** Si dos personas editan al mismo tiempo, pueden pisarse cambios. Coordinar quién edita cuándo.
- **Si editás archivos a mano desde la terminal**, hacé `git pull origin main --rebase` antes de pushear — el panel commitea directo a GitHub y tu copia local queda atrás.

## ✏️ Qué se edita desde el panel

| Sección | Contenido |
|---|---|
| **Obras** | Agregar/editar/borrar obras de las 4 categorías, subir fotos, galería por obra, estado (disponible/vendida/reservada), precio opcional |
| **Inicio y Trayectoria** | Imagen hero, foto de perfil, texto del inicio, imágenes de las 4 tarjetas de categoría, biografía, formación, premios, exposiciones |
| **Contacto** | Email, Instagram, Facebook, WhatsApp, ubicación |

Cada cambio queda como un commit en el historial del repo — sirve como respaldo y auditoría.

## 🖼️ Imágenes — recomendaciones

- **Hero (inicio)**: horizontal, 1600×900px o más
- **Foto de perfil**: cuadrada, 600×600px mínimo
- **Tarjetas de categoría**: vertical, ~800×1000px
- **Obras**: ~1200×900px
- **Límite del panel**: 2MB por archivo (configurado en `admin/config.yml`)
- **Nombres de archivo**: evitar espacios y caracteres raros. Usar guiones: `paisaje-interior.jpg` en vez de `paisaje interior ..jpg`. Funcionan igual, pero son frágiles al compartir URLs.

Todas las imágenes van a `assets/images/`. El CMS las sube ahí automáticamente.

### Sobre las rutas de las imágenes

Sveltia guarda las rutas con prefijo absoluto (`/portfolio/assets/images/...`). La función `normalizePath()` en `js/app.js` las convierte a relativas al renderizar, porque el sitio vive en un subdirectorio. **Soporta ambos formatos** (`/assets/...` de commits viejos y `/portfolio/assets/...` de los nuevos), así que no hace falta migrar nada a mano.

**Importante:** no agregar `media_folder`/`public_folder` a nivel de colección o archivo en `admin/config.yml`. Sveltia los interpreta como relativos a la carpeta del entry, así que poner `media_folder: assets/images/obras` dentro de la colección de obras (cuyo archivo es `data/obras.json`) hace que las imágenes terminen en `data/assets/images/obras/`. Usar solo el `media_folder` global de arriba del archivo.

## 🔒 Seguridad

- **CSP** en `index.html` y `admin/index.html` vía `<meta>` tag. Limitación conocida: `frame-ancestors` no funciona en meta tags — protección anti-clickjacking real requiere dominio propio + proxy (Cloudflare).
- **SRI** en el script de Sveltia CMS, versión fijada (`@0.172.4`) con hash SHA-384. Para actualizar: bajar el tarball de `https://registry.npmjs.org/@sveltia/cms`, calcular `openssl dgst -sha384 -binary dist/sveltia-cms.js | openssl base64 -A`, reemplazar versión + hash en `admin/index.html`.
- **Ningún secreto en el repo.** El token vive solo en el navegador.
- **`escapeHtml()`** en todo el contenido dinámico (45 usos), **`sanitizeUrl()`** en URLs arbitrarias (bloquea `javascript:`), validación de formato de email antes de `location.href`.
- **`rel="noopener noreferrer"`** en todos los links externos.
- **Mínimo privilegio**: el token solo puede escribir en este repo.
- Recomendado: activar **2FA** en la cuenta `jose-mizdraji`.

Limitaciones estructurales de GitHub Pages gratuito: no se pueden enviar headers HTTP custom (`X-Frame-Options`, `Permissions-Policy`, etc.). Se resolvería poniendo Cloudflare gratis delante, si en algún momento se compra un dominio propio.

## 🔍 SEO

Hay `<title>`, meta description y JSON-LD (schema.org `Person` / `VisualArtwork`) dinámicos por sección. Pero al ser una SPA con ruteo por `#hash`, Google no indexa `/#obras` ni `/#obra/id` como páginas separadas — por eso `sitemap.xml` solo lista la raíz. Si en algún momento importa que cada obra sea encontrable individualmente, hay que pre-renderizar o migrar a rutas reales (implica agregar un build step).

## 🩹 Troubleshooting

- **"Error al cargar los datos"** → algún JSON en `data/` quedó mal formado. Consola del navegador (F12) para ver el error exacto.
- **El panel no carga / error de login** → el token venció, o no tiene `Contents: Read and write` sobre `jose-mizdraji/portfolio`.
- **Las fotos no se ven** → verificar que el archivo existe en `assets/images/`. Las rutas con `/portfolio/` al inicio son correctas: `normalizePath()` las maneja.
- **"N fields have errors" al guardar** → algún campo requerido quedó vacío. Los campos `año` y `lugar` de las listas son opcionales; `título` no.
- **Los cambios no se reflejan** → GitHub Pages tarda 1-2 minutos en redeployar. `Ctrl+Shift+R` para forzar recarga sin caché.
- **`git push` rechazado** → el panel commiteó algo que no tenés local. `git pull origin main --rebase` y volvé a pushear.

## 📄 Licencia

Proyecto desarrollado para José Mizdraji. Uso exclusivo del artista.
