# José Mizdraji — Portafolio (GitHub Pages + Sveltia CMS)

Sitio estático (sin backend) para el portafolio del artista visual José Mizdraji, con panel de administración web para cargar y editar obras, series y portfolios sin tocar código, y un **generador de portfolios personalizados**: cada uno se publica como página web con su propio enlace para compartir, y desde el panel (**Enlaces y descargas**) se copia el enlace y se baja en PDF, Word y OpenDocument.

**Sitio:** https://jose-mizdraji.github.io/portfolio/
**Panel de administración:** https://jose-mizdraji.github.io/portfolio/admin/

(No lleva `www.` — un subdominio `*.github.io` no acepta ese prefijo salvo con dominio propio apuntado por CNAME.)

Diseñado por Jagā Digital Hub.

## 📁 Estructura

```
portfolio/
├── index.html                    # Sitio público (SPA, ruteo por #hash, módulos ES)
├── 404.html                      # Traduce /portfolio-XXX a la app; el resto vuelve al inicio
├── css/main.css                  # Estilos (modo claro por defecto + modo oscuro)
├── js/
│   ├── app.js                    # Vistas y eventos del sitio público
│   ├── model.js                  # Lógica pura: series, portfolios, qué obras entran dónde
│   ├── util.js                   # escapeHtml, sanitizeUrl, normalizePath, slugify
│   ├── theme.js                  # Modo claro/oscuro (se carga en el <head>, sin parpadeo)
│   ├── export/                   # Descargas (las usa solo la página «Enlaces y descargas» del panel)
│   │   ├── index.js              # Punto de entrada: arma el documento y lo guarda
│   │   ├── model.js              # Estructura común a los tres formatos
│   │   ├── images.js             # Reduce las fotos a JPEG antes de incrustarlas
│   │   ├── pdf.js                # PDF (jsPDF)
│   │   ├── docx.js               # Word, armado a mano (WordprocessingML)
│   │   ├── odt.js                # OpenDocument, armado a mano (ODF 1.2)
│   │   ├── zip.js, xml.js        # Utilidades de los dos anteriores
│   └── vendor/jspdf.umd.min.js   # jsPDF 4.2.1 (MIT) — copia local, ver «Seguridad»
├── data/                         # Contenido editable — esto es lo que edita el CMS
│   ├── obras.json                # Catálogo: cada obra es figurativa/no figurativa, tiene series y visibilidad
│   ├── series.json               # Series: nombre, descripción, visibilidad
│   ├── portfolios-base.json      # Descripción/imagen de «Arte Figurativo» y «Arte No Figurativo»
│   ├── portfolios-personalizados.json   # Portfolios a medida (MALBA, MET, Louvre…)
│   ├── bio.json                  # Imágenes del inicio + biografía y trayectoria
│   └── contacto.json             # Mail, Instagram, Facebook
├── admin/                        # Panel de administración (Sveltia CMS)
│   ├── index.html                # Carga Sveltia + portfolio-extras.js
│   ├── config.yml                # Qué se puede editar y cómo
│   ├── portfolio-extras.js       # Ítem «Enlaces y descargas» en el menú + aviso con el enlace al crear un portfolio
│   ├── portfolios.html / .css / .js   # Página «Enlaces y descargas»: copiar enlaces y descargar PDF/Word/ODT
├── assets/
│   ├── images/                   # Todas las fotos subidas desde el panel
│   └── icons/                    # Favicon (detalle del nido, identidad visual de José) y apple-touch-icon
├── robots.txt
├── sitemap.xml
└── .nojekyll                     # Evita que GitHub Pages procese el sitio con Jekyll
```

No hay paso de compilación: lo que está en el repo es lo que se publica.

## 🗂️ Cómo está organizado el contenido

### Dos portfolios base

La división principal del sitio es por **portfolio**, no por disciplina:

- **Arte Figurativo** → `#arte-figurativo`
- **Arte No Figurativo** → `#arte-no-figurativo`

Cada obra se clasifica en uno u otro con el campo **«Portfolio al que pertenece»**. La disciplina (Pinturas, Dibujos, Grabados, Esculturas) es un dato aparte que se muestra sobre el título de la obra y sirve para ordenar la página *Obras*.

### Series

Una **serie** tiene nombre, descripción, imagen de portada opcional y un interruptor «Visible en el sitio». Son transtemporales y transdisciplinarias: una obra puede estar en varias series (o en ninguna).

- **La misma serie puede aparecer en los dos portfolios** con contenido distinto: dentro de *Arte Figurativo* la serie muestra solo sus obras figurativas, y dentro de *Arte No Figurativo*, solo las no figurativas. Cada tarjeta de serie indica a qué portfolio pertenece.
- Las obras que no están en ninguna serie visible aparecen en un grupo **«Otras obras»**.
- Si se **oculta una serie**, deja de mostrarse y sus obras pasan a «Otras obras» (no se borra nada).
- La URL de una serie se arma con su nombre (`#serie/muros-de-mi-ciudad/figurativo`). Si dos series tuvieran el mismo nombre, la segunda lleva un sufijo numérico.

### Obras

- Subtítulo `Serie: <nombre>` bajo el título (la disciplina va arriba).
- **Ficha técnica**: año, técnica y medidas, más la descripción si hay una. Ya no se muestran precio ni estado.
- Botón **«Consultar por esta obra»** (y «Consultar por esta serie» en las series): abre el cliente de correo con el asunto y el texto ya cargados, dirigido al mail de contacto.
- Interruptor **«Visible en el sitio»**: oculta la obra sin borrarla ni perder sus datos. Una obra oculta no se ve en las páginas públicas, pero **sí se puede incluir a mano en un portfolio personalizado**.
- La página **Obras** pregunta primero cómo mirar: *por serie*, *por disciplina* o *más recientes*, y ordena las tarjetas según eso. (Se quitaron la búsqueda y el orden manual de la versión anterior.)

### Trayectoria

- **Premios**: se muestran los marcados como «Destacado» (si no se marcó ninguno, los primeros 5) y un enlace «Ver todos» a la página completa.
- **Exposiciones**: dos columnas, *Individuales* y *Colectivas*, con las destacadas (o las primeras 6 de cada una) y «Ver todas».

### Contacto

Solo el mail (`mizdrajijose@gmail.com`), Instagram y Facebook, más el formulario de mensaje. Sin teléfono ni ubicación.

## 🧩 Administrar portfolios (el generador)

En el panel: **Administrar portfolios → Portfolios personalizados**. Cada portfolio es un ítem de la lista:

| Campo | Para qué sirve |
|---|---|
| **Enlace** | Lo que va después de `portfolio-`. Si ponés `MET-2026`, el portfolio queda en `…/portfolio-MET-2026`. Solo letras, números y guiones. |
| **Habilitado** | Apagado, el enlace deja de funcionar («Este portfolio no está disponible») pero el portfolio queda guardado para reactivarlo. |
| **Título / Destinatario / Descripción** | Textos de la portada. Destinatario y descripción son opcionales. |
| **Tipo de contenido** | *Arte figurativo*, *Arte no figurativo* o *Mixto*. En los dos primeros, cada serie incluye solo obras de ese tipo; en *Mixto*, de ambos. |
| **Series y obras** | Lista de secciones, en el orden en que se cargan. Cada sección elige una **serie** y, si se quiere, **obras puntuales**. |

Reglas de las secciones:

- **Sin obras elegidas** → entran todas las obras *visibles* de esa serie (filtradas por el tipo del portfolio).
- **Con obras elegidas** → entran exactamente esas, **incluso las ocultas** en el sitio. Así una misma serie puede tener obras distintas en cada portfolio.
- **Sin serie** → sección «Otras obras» con las obras sueltas que se elijan.

Para **borrar** un portfolio, se elimina su ítem de la lista y se guarda. Para **crear** uno, «Agregar» al final de la lista.

### Entregar el enlace: al crear y en «Enlaces y descargas»

El enlace completo (`https://…/portfolio-MET-2026`) es lo que se le pasa a quien tiene que ver el portfolio. Hay dos lugares donde se obtiene, ambos con botón **Copiar enlace**:

1. **Al guardar un portfolio nuevo** (o cambiarle el enlace), el panel muestra un aviso con el enlace completo listo para copiar. Si se guarda un portfolio ya existente, el aviso no vuelve a aparecer.
2. **Menú lateral → «Enlaces y descargas»** (debajo de «Administrar portfolios», o directo en `/admin/portfolios.html`). Lista todos los portfolios publicados —el último creado primero— con su enlace, un enlace alternativo por si el principal no abre, y las **descargas**.

Los archivos para descargar viven **solo en el panel**, no en la página pública que se comparte: quien recibe el enlace ve el portfolio y nada más.

- **PDF** (A4 horizontal), **Word** (`.docx`) y **OpenDocument** (`.odt`), con portada, secciones por serie, una obra por página con su ficha técnica y página de contacto.
- Los archivos se generan **en el navegador**; no se sube nada a ningún servidor. Se llaman `Jose-Mizdraji_portfolio-<enlace>.<ext>`.
- Usan lo que está **publicado** en el sitio: un portfolio recién guardado aparece en la lista y en su enlace entre 1 y 2 minutos después (lo que tarda GitHub Pages en redeployar). Mientras tanto, «Actualizar lista» lo vuelve a buscar.

Cada portfolio publicado, además, tiene su **página web** en `#portfolio-<enlace>` (se ve igual con `/portfolio-<enlace>`, ver más abajo), con lightbox para recorrer las obras (flechas del teclado, Esc para cerrar) y marcada `noindex`: se le pide a los buscadores que no la indexen.

> `admin/portfolios.html` es una página de lectura: no tiene claves ni escribe nada, y muestra datos que ya son públicos. Cualquiera que conozca su dirección puede verla, igual que el resto del sitio; por eso no hay nada sensible ahí.

### Cómo funcionan las URLs «lindas»

GitHub Pages no tiene ruteo del lado del servidor. Cuando alguien entra a `https://…/portfolio-MET-2026`, GitHub no encuentra ese archivo y sirve `404.html`; ese archivo detecta el patrón `portfolio-<algo>` y redirige al instante a `index.html#portfolio-MET-2026`. Funciona igual bajo `github.io/portfolio/` que en la raíz de un dominio propio (por ejemplo `josemizdraji.com/portfolio-MET-2026`). El enlace no distingue mayúsculas de minúsculas. Técnicamente la respuesta HTTP es un 404, así que **compartir el enlace funciona, pero no es indexable** (justamente lo que se busca para portfolios a medida).

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
| **Obras** | Alta/edición/baja de obras: título, portfolio (figurativo / no figurativo), disciplina, año, técnica, medidas, descripción opcional, series, visibilidad, imagen principal y galería |
| **Series** | Nombre, descripción, imagen de portada opcional, visibilidad |
| **Administrar portfolios** | Portfolios personalizados (crear, habilitar/deshabilitar, borrar, elegir series y obras) y descripción/imagen de los dos portfolios base |
| **Inicio y Trayectoria** | Imagen hero, foto de perfil, texto del inicio, imágenes de las 4 disciplinas, biografía, formación, premios y exposiciones (con la marca «Destacado»), colecciones, publicaciones |
| **Contacto** | Email, Instagram, Facebook |

Cada cambio queda como un commit en el historial del repo — sirve como respaldo y auditoría.

### Relaciones entre obras y series

Las series de una obra y las obras de un portfolio se eligen desde una lista desplegable que lee `data/series.json` y `data/obras.json`; internamente se guarda el **ID** (las series usan un identificador automático, las obras el ID que se les puso al crearlas). Por eso se puede **renombrar una serie sin romper nada**. Dos cuidados:

- **No cambiar el ID de una obra** una vez que está en un portfolio personalizado: si pasa, esa obra deja de aparecer en el portfolio y hay que volver a elegirla.
- **Preferir ocultar una serie antes que borrarla.** Una serie oculta se puede seguir usando en portfolios personalizados; una serie borrada hace que las secciones de los portfolios que la usaban dejen de mostrarse.

## 🖼️ Imágenes — recomendaciones

- **Hero (inicio)**: horizontal, 1600×900px o más
- **Foto de perfil**: cuadrada, 600×600px mínimo
- **Tarjetas de portfolio y de disciplina**: vertical, ~800×1000px
- **Obras**: ~1200×900px
- **Límite del panel**: 2MB por archivo (configurado en `admin/config.yml`)
- **Nombres de archivo**: evitar espacios y caracteres raros. Usar guiones: `paisaje-interior.jpg` en vez de `paisaje interior ..jpg`. Funcionan igual, pero son frágiles al compartir URLs.

Todas las imágenes van a `assets/images/`. El CMS las sube ahí automáticamente.

Las descargas (PDF/Word/ODT) usan **la imagen principal de cada obra**, reducida a un máximo de 1600–1800px de lado. No incluyen la galería.

### Sobre las rutas de las imágenes

Sveltia guarda las rutas con prefijo absoluto (`/portfolio/assets/images/...`). La función `normalizePath()` en `js/util.js` las convierte a relativas al renderizar, porque el sitio vive en un subdirectorio. **Soporta ambos formatos** (`/assets/...` de commits viejos y `/portfolio/assets/...` de los nuevos), así que no hace falta migrar nada a mano.

**Importante:** no agregar `media_folder`/`public_folder` a nivel de colección o archivo en `admin/config.yml`. Sveltia los interpreta como relativos a la carpeta del entry, así que poner `media_folder: assets/images/obras` dentro de la colección de obras (cuyo archivo es `data/obras.json`) hace que las imágenes terminen en `data/assets/images/obras/`. Usar solo el `media_folder` global de arriba del archivo.

## 🪹 Favicon

El ícono de la pestaña es un detalle del cuadro del nido, parte de la identidad visual de José. Los archivos están en `assets/icons/` (`favicon.ico` con 16, 32 y 48 px, `favicon-16x16.png`, `favicon-32x32.png` y `apple-touch-icon.png` de 180 px para la pantalla de inicio del iPhone) y se enlazan en `index.html`, `admin/index.html` y `admin/portfolios.html`. Como es una pintura con mucho detalle, a 16 px se lee como una textura ocre y marrón más que como un nido; a 32 px y más se reconoce. Para reemplazarlo, generar de nuevo esos cuatro archivos con los mismos nombres.

## 🌗 Modo oscuro

Botón en la barra superior. **El sitio siempre arranca en modo claro**, aunque el sistema operativo esté en oscuro; si alguien elige el modo oscuro, el navegador lo recuerda (`localStorage`). El tema se aplica con el atributo `data-theme` en `<html>` desde `js/theme.js`, antes de pintar, para que no haya destello.

## 🔒 Seguridad

- **CSP** en `index.html`, `admin/index.html` y `admin/portfolios.html` vía `<meta>` tag. En el sitio público es estricta: `script-src 'self'` (sin scripts ni manejadores `onclick`/`onerror` en línea), `connect-src 'self'`, `img-src 'self' data:`. Limitación conocida: `frame-ancestors` no funciona en meta tags — protección anti-clickjacking real requiere dominio propio + proxy (Cloudflare).
- **jsPDF está vendorizado** (`js/vendor/`, con su licencia) en vez de cargarse desde un CDN, para no abrir la CSP a terceros ni depender de que el CDN esté disponible. Para actualizarlo: reemplazar el archivo por la nueva versión de `jspdf.umd.min.js` y volver a probar la descarga de PDF.
- **SRI** en el script de Sveltia CMS, versión fijada (`@0.172.4`) con hash SHA-384. Para actualizar: bajar el tarball de `https://registry.npmjs.org/@sveltia/cms`, calcular `openssl dgst -sha384 -binary dist/sveltia-cms.js | openssl base64 -A`, reemplazar versión + hash en `admin/index.html`. **Después de actualizar, revisar `admin/portfolio-extras.js`**: agrega el ítem «Enlaces y descargas» al menú lateral de Sveltia copiando un ítem existente, y eso depende de cómo Sveltia arma su menú. Si tras actualizar el ítem desaparece, el resto del panel sigue funcionando y la página sigue disponible en `/admin/portfolios.html`.
- **Ningún secreto en el repo.** El token vive solo en el navegador.
- **`escapeHtml()`** en todo el contenido dinámico, **`sanitizeUrl()`** en URLs arbitrarias (bloquea `javascript:`), validación de formato de email antes de armar los enlaces `mailto:`. En los archivos DOCX/ODT/PDF generados, el texto se escapa/limpia antes de escribirse.
- **`rel="noopener noreferrer"`** en todos los links externos.
- **Mínimo privilegio**: el token solo puede escribir en este repo.
- Recomendado: activar **2FA** en la cuenta `jose-mizdraji`.

Limitaciones estructurales de GitHub Pages gratuito: no se pueden enviar headers HTTP custom (`X-Frame-Options`, `Permissions-Policy`, etc.). Se resolvería poniendo Cloudflare gratis delante, si en algún momento se compra un dominio propio.

### ⚠️ «Oculto» o «deshabilitado» no es «privado»

El repositorio es público y el sitio es estático: **los archivos `data/*.json` y las imágenes de `assets/images/` se pueden leer directamente** por cualquiera que conozca la dirección, incluso los de obras ocultas o portfolios deshabilitados. Ocultar una obra o deshabilitar un portfolio la saca del sitio, pero **no sirve para esconder información sensible**. Para eso haría falta un repositorio privado (GitHub Pages privado requiere plan de pago) o un backend con autenticación.

## 🔍 SEO

Hay `<title>`, meta description y JSON-LD (schema.org `Person` / `VisualArtwork`) dinámicos por sección. Pero al ser una SPA con ruteo por `#hash`, Google no indexa `/#obras` ni `/#obra/id` como páginas separadas — por eso `sitemap.xml` solo lista la raíz. Si en algún momento importa que cada obra sea encontrable individualmente, hay que pre-renderizar o migrar a rutas reales (implica agregar un build step). Los portfolios personalizados llevan `noindex` a propósito.

## 🩹 Troubleshooting

- **"Error al cargar los datos"** → algún JSON en `data/` quedó mal formado. Consola del navegador (F12) para ver el error exacto.
- **El panel no carga / error de login** → el token venció, o no tiene `Contents: Read and write` sobre `jose-mizdraji/portfolio`.
- **Las fotos no se ven** → verificar que el archivo existe en `assets/images/`. Las rutas con `/portfolio/` al inicio son correctas: `normalizePath()` las maneja.
- **"N fields have errors" al guardar** → algún campo requerido quedó vacío. `año`, `lugar`, `descripción` de la obra y la serie/obras de una sección son opcionales; `título`, `enlace` y el nombre de la serie no.
- **Un portfolio muestra «no está disponible»** → revisar que esté **Habilitado** y que el enlace del panel coincida con el de la URL (sin el prefijo `portfolio-`).
- **Una obra no aparece en ningún lado** → mirar si está marcada como no visible; las obras ocultas solo se ven dentro de un portfolio personalizado que las incluya a mano.
- **La descarga no arranca o falla** → se hace desde «Enlaces y descargas» en el panel. Probar con un navegador actualizado; el mensaje bajo los botones indica el error. Si el portfolio tiene muchas obras con fotos pesadas, puede tardar unos segundos.
- **El enlace de un portfolio nuevo no abre, o no está en «Enlaces y descargas»** → GitHub Pages tarda 1-2 minutos en publicar lo que se guarda. Esperar y tocar «Actualizar lista» (o recargar el enlace).
- **El aviso con el enlace no apareció al guardar** → solo aparece cuando el enlace es nuevo. Para un portfolio ya existente, el enlace está siempre en «Enlaces y descargas».
- **El ícono de la pestaña no cambia** → los navegadores guardan el favicon muy agresivamente; probar en una ventana privada o recargar con `Ctrl+Shift+R`.
- **Los cambios no se reflejan** → GitHub Pages tarda 1-2 minutos en redeployar. `Ctrl+Shift+R` para forzar recarga sin caché.
- **`git push` rechazado** → el panel commiteó algo que no tenés local. `git pull origin main --rebase` y volvé a pushear.

## 📄 Licencia

Proyecto desarrollado para José Mizdraji. Uso exclusivo del artista. La librería `js/vendor/jspdf.umd.min.js` se distribuye bajo licencia MIT (ver `js/vendor/jspdf.LICENSE.txt`).
