// ============================================
// Exportación a OpenDocument Text (.odt), armada a mano (ZIP + ODF 1.2).
//
// Dibuja la MISMA maquetación que el PDF y el Word (layout.js): A4 apaisado, cada texto
// en un cuadro de texto, cada foto como imagen y las líneas como filetes. Todo se puede
// editar en LibreOffice Writer. El pie de página es un pie real (con número automático).
//
// Fuentes: Arial y Times New Roman, que son lo mismo que Helvetica y Times del PDF.
// ============================================

import { buildZip } from './zip.js';
import { xml } from './xml.js';
import { editorBox, W, H, M, FOOT_Y } from './layout.js';

const HEAD = '<?xml version="1.0" encoding="UTF-8"?>\n';
const MIME = 'application/vnd.oasis.opendocument.text';
const PT = 25.4 / 72;

const NS = [
  'xmlns:office="urn:oasis:names:tc:opendocument:xmlns:office:1.0"',
  'xmlns:style="urn:oasis:names:tc:opendocument:xmlns:style:1.0"',
  'xmlns:text="urn:oasis:names:tc:opendocument:xmlns:text:1.0"',
  'xmlns:draw="urn:oasis:names:tc:opendocument:xmlns:drawing:1.0"',
  'xmlns:fo="urn:oasis:names:tc:opendocument:xmlns:xsl-fo-compatible:1.0"',
  'xmlns:xlink="http://www.w3.org/1999/xlink"',
  'xmlns:svg="urn:oasis:names:tc:opendocument:xmlns:svg-compatible:1.0"',
  'xmlns:dc="http://purl.org/dc/elements/1.1/"',
  'xmlns:meta="urn:oasis:names:tc:opendocument:xmlns:meta:1.0"'
].join(' ');

const mm = (v) => `${(Math.round(v * 1000) / 1000).toString()}mm`;
const hex = (c) => '#' + c.map(v => v.toString(16).padStart(2, '0')).join('');
const FONTS = {
  helvetica: `fo:font-family="Arial" style:font-family-generic="swiss"`,
  times: `fo:font-family="'Times New Roman'" style:font-family-generic="roman"`
};

// Texto con espacios seguidos (ODF los junta salvo que se marquen).
function odfText(t) {
  return xml(t)
    .replace(/ {2,}/g, (m) => ` <text:s text:c="${m.length - 1}"/>`)
    .replace(/^ /, '<text:s/>');
}

// Posición relativa a la página, para todo lo flotante.
const PAGE_REL = 'style:horizontal-pos="from-left" style:horizontal-rel="page" style:vertical-pos="from-top" style:vertical-rel="page"';

export function buildOdt(layout, images, model) {
  const pictures = [];              // { n, bytes }
  const pictureIndex = new Map();   // ruta → n
  const autoPara = new Map();       // clave → nombre
  const autoText = new Map();
  const autoRect = new Map();
  const autoXml = [];
  let zi = 0;
  let nameN = 0;

  // ----- estilos automáticos de párrafo / texto -----
  function paraStyle(p) {
    const key = [p.left, p.hang, p.pitch, p.after || 0, p.align].join('|');
    if (autoPara.has(key)) return autoPara.get(key);
    const name = `P${autoPara.size + 1}`;
    autoPara.set(key, name);
    const align = p.align === 'right' ? 'end' : p.align === 'center' ? 'center' : 'start';
    autoXml.push(
      `<style:style style:name="${name}" style:family="paragraph" style:parent-style-name="Standard">` +
      `<style:paragraph-properties fo:margin-left="${mm(p.left || 0)}" fo:margin-right="0mm" fo:text-indent="${mm(-(p.hang || 0))}" style:auto-text-indent="false" ` +
      `fo:margin-top="0mm" fo:margin-bottom="${mm((p.after || 0) * PT)}" fo:line-height="${mm(p.pitch * PT)}" fo:text-align="${align}" fo:orphans="1" fo:widows="1"/></style:style>`
    );
    return name;
  }

  function textStyle(r) {
    const key = [r.font, r.style, r.size, r.color.join(','), r.cs || 0, r.upper ? 1 : 0].join('|');
    if (autoText.has(key)) return autoText.get(key);
    const name = `T${autoText.size + 1}`;
    autoText.set(key, name);
    const bold = r.style === 'bold' || r.style === 'bolditalic';
    const italic = r.style === 'italic' || r.style === 'bolditalic';
    autoXml.push(
      `<style:style style:name="${name}" style:family="text"><style:text-properties ${FONTS[r.font] || FONTS.helvetica} fo:font-size="${r.size}pt" ` +
      `fo:color="${hex(r.color)}" fo:font-style="${italic ? 'italic' : 'normal'}" fo:font-weight="${bold ? 'bold' : 'normal'}" style:letter-kerning="false"` +
      `${r.cs ? ` fo:letter-spacing="${mm(r.cs)}"` : ''}${r.upper ? ' fo:text-transform="uppercase"' : ''} fo:language="es" fo:country="AR"/></style:style>`
    );
    return name;
  }

  function runXml(r) {
    if (r.tab) return '<text:tab/>';
    if (r.br) return '<text:line-break/>';
    if (r.field === 'page') return `<text:span text:style-name="${textStyle(r)}"><text:page-number text:select-page="current">${xml(r.t)}</text:page-number></text:span>`;
    if (!r.t) return '';
    return `<text:span text:style-name="${textStyle(r)}">${odfText(r.t)}</text:span>`;
  }

  const paraXml = (p) => `<text:p text:style-name="${paraStyle(p)}">${p.runs.map(runXml).join('')}</text:p>`;

  function rectStyle(color) {
    const key = hex(color);
    if (autoRect.has(key)) return autoRect.get(key);
    const name = `R${autoRect.size + 1}`;
    autoRect.set(key, name);
    autoXml.push(
      `<style:style style:name="${name}" style:family="graphic"><style:graphic-properties draw:stroke="none" draw:fill="solid" draw:fill-color="${key}" ` +
      `style:wrap="none" style:run-through="foreground" ${PAGE_REL} style:protect="none"/></style:style>`
    );
    return name;
  }

  // ----- elementos flotantes (todos anclados a la página) -----
  const itemXml = (item) => {
    zi += 1; nameN += 1;
    if (item.k === 'rect') {
      return `<draw:rect draw:style-name="${rectStyle(item.color)}" draw:name="Línea ${nameN}" text:anchor-type="paragraph" ` +
        `svg:x="${mm(item.x)}" svg:y="${mm(item.y)}" svg:width="${mm(item.w)}" svg:height="${mm(item.h)}" draw:z-index="${zi}"/>`;
    }
    if (item.k === 'text') {
      const { x, w } = editorBox(item);
      return `<draw:frame draw:style-name="grTexto" draw:name="Texto ${nameN}" text:anchor-type="paragraph" svg:x="${mm(x)}" svg:y="${mm(item.top)}" svg:width="${mm(w)}" draw:z-index="${zi}">` +
        `<draw:text-box fo:min-height="${mm(Math.max(item.h, 1))}">${item.paras.map(paraXml).join('')}</draw:text-box></draw:frame>`;
    }
    if (item.k === 'img') {
      const im = images.get(item.path);
      if (!im) return '';
      let n = pictureIndex.get(item.path);
      if (!n) {
        n = pictures.length + 1;
        pictures.push({ n, bytes: im.bytes });
        pictureIndex.set(item.path, n);
      }
      return `<draw:frame draw:style-name="grImagen" draw:name="Imagen ${nameN}" text:anchor-type="paragraph" svg:x="${mm(item.x)}" svg:y="${mm(item.y)}" svg:width="${mm(item.w)}" svg:height="${mm(item.h)}" draw:z-index="${zi}">` +
        `<draw:image xlink:href="Pictures/imagen${n}.jpg" xlink:type="simple" xlink:show="embed" xlink:actuate="onLoad"/>` +
        `<svg:title>${xml(item.alt || '')}</svg:title></draw:frame>`;
    }
    return '';
  };

  const holder = (i) => `<text:p text:style-name="${i === 0 ? 'PagPrimera' : i === 1 ? 'PagSegunda' : 'PagNueva'}">`;
  const body = layout.pages.map((page, i) => `${holder(i)}${page.items.map(itemXml).join('')}</text:p>`).join('');

  const contentXml = `${HEAD}<office:document-content ${NS} office:version="1.2">
  <office:automatic-styles>
    <style:style style:name="PagPrimera" style:family="paragraph" style:parent-style-name="Soporte" style:master-page-name="Portada"/>
    <style:style style:name="PagSegunda" style:family="paragraph" style:parent-style-name="Soporte" style:master-page-name="Pagina"><style:paragraph-properties fo:break-before="page"/></style:style>
    <style:style style:name="PagNueva" style:family="paragraph" style:parent-style-name="Soporte"><style:paragraph-properties fo:break-before="page"/></style:style>
    ${autoXml.join('\n    ')}
  </office:automatic-styles>
  <office:body><office:text>${body}</office:text></office:body>
</office:document-content>`;

  // ----- pie de página (real, con número automático) -----
  const [regla, izq, der] = layout.footer.items;
  const footerRun = izq.paras[0].runs[0];
  const footerPitch = izq.paras[0].pitch * PT;
  const footerH = H - FOOT_Y;                                   // alto de la franja del pie
  const footerPara = `<text:p text:style-name="Pie"><text:span text:style-name="PieTexto">${odfText(footerRun.t)}</text:span>` +
    `<text:tab/><text:span text:style-name="PieTexto"><text:page-number text:select-page="current">2</text:page-number></text:span></text:p>`;
  const footerTextProps = `${FONTS[footerRun.font] || FONTS.helvetica} fo:font-size="${footerRun.size}pt" fo:color="${hex(footerRun.color)}" fo:font-style="normal" style:letter-kerning="false" fo:language="es" fo:country="AR"`;
  // La base del texto del pie queda a 5 mm de la línea (igual que en el PDF).
  const footerTop = izq.top - FOOT_Y;                           // desde la línea hasta el borde superior del renglón

  const stylesXml = `${HEAD}<office:document-styles ${NS} office:version="1.2">
  <office:font-face-decls>
    <style:font-face style:name="Arial" svg:font-family="Arial" style:font-family-generic="swiss"/>
    <style:font-face style:name="Times New Roman" svg:font-family="'Times New Roman'" style:font-family-generic="roman"/>
  </office:font-face-decls>
  <office:styles>
    <style:default-style style:family="paragraph">
      <style:paragraph-properties fo:margin-top="0mm" fo:margin-bottom="0mm" fo:line-height="100%"/>
      <style:text-properties fo:font-family="Arial" style:font-family-generic="swiss" fo:font-size="10pt" fo:language="es" fo:country="AR"/>
    </style:default-style>
    <style:style style:name="Standard" style:family="paragraph" style:class="text"/>
    <style:style style:name="Soporte" style:family="paragraph" style:parent-style-name="Standard">
      <style:paragraph-properties fo:margin-top="0mm" fo:margin-bottom="0mm" fo:line-height="${mm(0.35)}"/>
      <style:text-properties fo:font-size="1pt"/>
    </style:style>
    <style:style style:name="Pie" style:family="paragraph" style:parent-style-name="Standard" style:class="extra">
      <style:paragraph-properties fo:margin-top="${mm(footerTop)}" fo:margin-bottom="0mm" fo:line-height="${mm(footerPitch)}">
        <style:tab-stops><style:tab-stop style:position="${mm(W - 2 * M)}" style:type="right"/></style:tab-stops>
      </style:paragraph-properties>
    </style:style>
    <style:style style:name="PieTexto" style:family="text"><style:text-properties ${footerTextProps}/></style:style>
    <style:style style:name="grTexto" style:family="graphic">
      <style:graphic-properties draw:stroke="none" draw:fill="none" fo:background-color="transparent" fo:padding="0mm" fo:border="none"
        style:wrap="none" style:run-through="foreground" ${PAGE_REL} style:protect="none" style:number-wrapped-paragraphs="no-limit"
        fo:min-height="1mm" draw:textarea-vertical-align="top" draw:auto-grow-height="true" draw:auto-grow-width="false"/>
    </style:style>
    <style:style style:name="grImagen" style:family="graphic">
      <style:graphic-properties draw:stroke="none" draw:fill="none" fo:padding="0mm" fo:border="none" style:wrap="none" style:run-through="foreground" ${PAGE_REL}
        style:protect="none" style:mirror="none" fo:clip="rect(0mm, 0mm, 0mm, 0mm)" draw:luminance="0%" draw:contrast="0%" draw:red="0%" draw:green="0%" draw:blue="0%" draw:gamma="100%" draw:color-inversion="false" draw:image-opacity="100%"/>
    </style:style>
  </office:styles>
  <office:automatic-styles>
    <style:page-layout style:name="pmPortada">
      <style:page-layout-properties fo:page-width="${mm(W)}" fo:page-height="${mm(H)}" style:print-orientation="landscape" fo:margin-top="${mm(M)}" fo:margin-bottom="${mm(M)}" fo:margin-left="${mm(M)}" fo:margin-right="${mm(M)}"/>
    </style:page-layout>
    <style:page-layout style:name="pmPagina">
      <style:page-layout-properties fo:page-width="${mm(W)}" fo:page-height="${mm(H)}" style:print-orientation="landscape" fo:margin-top="${mm(M)}" fo:margin-bottom="0mm" fo:margin-left="${mm(M)}" fo:margin-right="${mm(M)}"/>
      <style:footer-style><style:header-footer-properties fo:min-height="${mm(footerH)}" fo:margin-top="0mm" fo:margin-bottom="0mm" fo:padding="0mm" fo:border-top="${mm(regla.h)} solid ${hex(regla.color)}" fo:border-bottom="none" fo:border-left="none" fo:border-right="none"/></style:footer-style>
    </style:page-layout>
  </office:automatic-styles>
  <office:master-styles>
    <style:master-page style:name="Portada" style:page-layout-name="pmPortada" style:next-style-name="Pagina"/>
    <style:master-page style:name="Pagina" style:page-layout-name="pmPagina">
      <style:footer>${footerPara}</style:footer>
    </style:master-page>
  </office:master-styles>
</office:document-styles>`;

  const iso = new Date().toISOString();
  const metaXml = `${HEAD}<office:document-meta ${NS} office:version="1.2"><office:meta>
    <dc:title>${xml(`${model.titulo} — ${model.artista}`)}</dc:title>
    <meta:initial-creator>${xml(model.artista)}</meta:initial-creator>
    <meta:creation-date>${iso}</meta:creation-date><dc:date>${iso}</dc:date>
  </office:meta></office:document-meta>`;

  const manifest = `${HEAD}<manifest:manifest xmlns:manifest="urn:oasis:names:tc:opendocument:xmlns:manifest:1.0" manifest:version="1.2">
  <manifest:file-entry manifest:full-path="/" manifest:version="1.2" manifest:media-type="${MIME}"/>
  <manifest:file-entry manifest:full-path="content.xml" manifest:media-type="text/xml"/>
  <manifest:file-entry manifest:full-path="styles.xml" manifest:media-type="text/xml"/>
  <manifest:file-entry manifest:full-path="meta.xml" manifest:media-type="text/xml"/>
  ${pictures.map(pc => `<manifest:file-entry manifest:full-path="Pictures/imagen${pc.n}.jpg" manifest:media-type="image/jpeg"/>`).join('\n  ')}
</manifest:manifest>`;

  return buildZip([
    { name: 'mimetype', data: MIME },   // tiene que ser el primero y sin comprimir
    { name: 'META-INF/manifest.xml', data: manifest },
    { name: 'content.xml', data: contentXml },
    { name: 'styles.xml', data: stylesXml },
    { name: 'meta.xml', data: metaXml },
    ...pictures.map(pc => ({ name: `Pictures/imagen${pc.n}.jpg`, data: pc.bytes }))
  ], MIME);
}
