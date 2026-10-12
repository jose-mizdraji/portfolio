// ============================================
// Exportación a OpenDocument Text (.odt), armada a mano (ZIP + ODF 1.2).
// Mismo contenido y orden que el .docx: portada (sin pie), separador por
// serie, una obra por página con su foto y ficha técnica, contacto.
// ============================================

import { buildZip } from './zip.js';
import { xml, paragraphs, fitCm, capitalize } from './xml.js';
import { fichaFilas, resumenSeccion } from './model.js';

const HEAD = '<?xml version="1.0" encoding="UTF-8"?>\n';
const MIME = 'application/vnd.oasis.opendocument.text';
const ACCENT = '#8b7355';
const MUTED = '#6e6e6a';

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

const STYLES = (model) => `${HEAD}<office:document-styles ${NS} office:version="1.2">
  <office:styles>
    <style:default-style style:family="paragraph">
      <style:paragraph-properties fo:margin-bottom="0.21cm" fo:line-height="120%"/>
      <style:text-properties fo:font-family="Calibri" fo:font-size="11pt" fo:language="es" fo:country="AR"/>
    </style:default-style>
    <style:style style:name="Standard" style:family="paragraph" style:class="text"/>
    <style:style style:name="Title" style:family="paragraph" style:parent-style-name="Standard" style:class="chapter">
      <style:paragraph-properties fo:margin-top="0cm" fo:margin-bottom="0.3cm" fo:line-height="100%"/>
      <style:text-properties fo:font-family="Cambria" fo:font-size="42pt"/>
    </style:style>
    <style:style style:name="Subtitle" style:family="paragraph" style:parent-style-name="Standard" style:class="chapter">
      <style:paragraph-properties fo:margin-top="0.5cm" fo:margin-bottom="0.2cm"/>
      <style:text-properties fo:font-family="Cambria" fo:font-size="20pt" fo:font-style="italic"/>
    </style:style>
    <style:style style:name="Heading_20_1" style:display-name="Heading 1" style:family="paragraph" style:parent-style-name="Standard" style:next-style-name="Standard" style:default-outline-level="1" style:class="text">
      <style:paragraph-properties fo:margin-top="0cm" fo:margin-bottom="0.3cm" fo:line-height="100%" fo:keep-with-next="always"/>
      <style:text-properties fo:font-family="Cambria" fo:font-size="32pt"/>
    </style:style>
    <style:style style:name="Heading_20_2" style:display-name="Heading 2" style:family="paragraph" style:parent-style-name="Standard" style:next-style-name="Standard" style:default-outline-level="2" style:class="text">
      <style:paragraph-properties fo:margin-top="0.1cm" fo:margin-bottom="0.15cm" fo:line-height="100%" fo:keep-with-next="always"/>
      <style:text-properties fo:font-family="Cambria" fo:font-size="22pt"/>
    </style:style>
    <style:style style:name="Etiqueta" style:family="paragraph" style:parent-style-name="Standard">
      <style:paragraph-properties fo:margin-bottom="0.1cm"/>
      <style:text-properties fo:font-size="8.5pt" fo:text-transform="uppercase" fo:letter-spacing="0.06cm" fo:color="${ACCENT}"/>
    </style:style>
    <style:style style:name="Detalle" style:family="paragraph" style:parent-style-name="Standard">
      <style:text-properties fo:font-size="10pt" fo:color="${MUTED}"/>
    </style:style>
    <style:style style:name="Footer" style:family="paragraph" style:parent-style-name="Standard" style:class="extra">
      <style:paragraph-properties fo:margin-bottom="0cm">
        <style:tab-stops><style:tab-stop style:position="17cm" style:type="right"/></style:tab-stops>
      </style:paragraph-properties>
      <style:text-properties fo:font-size="8.5pt" fo:color="${MUTED}"/>
    </style:style>
  </office:styles>
  <office:automatic-styles>
    <style:page-layout style:name="pm1">
      <style:page-layout-properties fo:page-width="21cm" fo:page-height="29.7cm" style:print-orientation="portrait" fo:margin-top="2cm" fo:margin-bottom="1.6cm" fo:margin-left="2cm" fo:margin-right="2cm"/>
      <style:footer-style><style:header-footer-properties fo:min-height="0.5cm" fo:margin-top="0.5cm"/></style:footer-style>
    </style:page-layout>
    <style:page-layout style:name="pm2">
      <style:page-layout-properties fo:page-width="21cm" fo:page-height="29.7cm" style:print-orientation="portrait" fo:margin-top="2cm" fo:margin-bottom="2cm" fo:margin-left="2cm" fo:margin-right="2cm"/>
    </style:page-layout>
  </office:automatic-styles>
  <office:master-styles>
    <style:master-page style:name="Cover" style:page-layout-name="pm2" style:next-style-name="Standard"/>
    <style:master-page style:name="Standard" style:page-layout-name="pm1">
      <style:footer><text:p text:style-name="Footer">${xml(model.artista)} · ${xml(model.titulo)}<text:tab/><text:page-number text:select-page="current">2</text:page-number></text:p></style:footer>
    </style:master-page>
  </office:master-styles>
</office:document-styles>`;

const AUTO_STYLES = `
  <style:style style:name="Cover_label" style:family="paragraph" style:parent-style-name="Etiqueta" style:master-page-name="Cover">
    <style:paragraph-properties fo:margin-top="6cm"/>
  </style:style>
  <style:style style:name="Label_first" style:family="paragraph" style:parent-style-name="Etiqueta" style:master-page-name="Standard">
    <style:paragraph-properties fo:margin-top="6cm"/>
  </style:style>
  <style:style style:name="Label_break" style:family="paragraph" style:parent-style-name="Etiqueta">
    <style:paragraph-properties fo:break-before="page"/>
  </style:style>
  <style:style style:name="Label_break_top" style:family="paragraph" style:parent-style-name="Etiqueta">
    <style:paragraph-properties fo:break-before="page" fo:margin-top="6cm"/>
  </style:style>
  <style:style style:name="Label_first_obra" style:family="paragraph" style:parent-style-name="Etiqueta" style:master-page-name="Standard"/>
  <style:style style:name="Gap_before" style:family="paragraph" style:parent-style-name="Detalle">
    <style:paragraph-properties fo:margin-top="3cm" fo:margin-bottom="0cm"/>
  </style:style>
  <style:style style:name="Detalle_after" style:family="paragraph" style:parent-style-name="Detalle">
    <style:paragraph-properties fo:margin-bottom="0.5cm"/>
  </style:style>
  <style:style style:name="Ficha" style:family="paragraph" style:parent-style-name="Standard">
    <style:paragraph-properties fo:margin-bottom="0.08cm"/>
  </style:style>
  <style:style style:name="Descripcion" style:family="paragraph" style:parent-style-name="Standard">
    <style:paragraph-properties fo:margin-top="0.35cm"/>
  </style:style>
  <style:style style:name="Imagen" style:family="paragraph" style:parent-style-name="Standard">
    <style:paragraph-properties fo:text-align="center" fo:margin-top="0.2cm" fo:margin-bottom="0.4cm" fo:keep-with-next="always"/>
  </style:style>
  <style:style style:name="T_bold" style:family="text"><style:text-properties fo:font-weight="bold"/></style:style>
  <style:style style:name="T_italic" style:family="text"><style:text-properties fo:font-style="italic"/></style:style>
  <style:style style:name="fr1" style:family="graphic">
    <style:graphic-properties style:wrap="none" style:vertical-pos="top" style:vertical-rel="baseline" style:horizontal-pos="center" style:horizontal-rel="paragraph" fo:padding="0cm" fo:border="none"/>
  </style:style>`;

export function buildOdt(model, images) {
  const pictures = [];             // { n, bytes }
  const pictureIndex = new Map();  // ruta → n
  const body = [];

  const p = (t, style, inner) => `<text:p${style ? ` text:style-name="${style}"` : ''}>${inner ?? xml(t)}</text:p>`;
  const block = (t, style) => paragraphs(t).map(line => p(line, style)).join('');
  const h = (t, level, style) => `<text:h text:style-name="${style}" text:outline-level="${level}">${xml(t)}</text:h>`;

  // El primer salto después de la portada cambia a la página maestra "Standard" (con pie);
  // los siguientes son saltos de página comunes.
  let primerSalto = true;
  const etiqueta = (t, { arriba = false, obra = false } = {}) => {
    let style;
    if (primerSalto) { style = obra ? 'Label_first_obra' : 'Label_first'; primerSalto = false; }
    else style = obra ? 'Label_break' : (arriba ? 'Label_break_top' : 'Label_break');
    return p(t, style);
  };

  // ----- Portada -----
  body.push(p('Portfolio', 'Cover_label'));
  body.push(p(model.artista, 'Title'));
  if (model.subtitulo) body.push(p(model.subtitulo, 'Detalle_after'));
  body.push(p(model.titulo, 'Subtitle'));
  if (model.destinatario) body.push(p(model.destinatario, 'Standard'));
  body.push(block(model.descripcion, 'Detalle'));
  body.push(p(capitalize(model.fecha), 'Gap_before'));
  body.push(p(model.url, 'Detalle'));

  // ----- Secciones -----
  const unaSolaSinTexto = model.secciones.length === 1 && !model.secciones[0].descripcion;
  for (const sec of model.secciones) {
    if (!unaSolaSinTexto) {
      body.push(etiqueta(sec.esSerie ? 'Serie' : 'Obras', { arriba: true }));
      body.push(h(sec.titulo, 1, 'Heading_20_1'));
      body.push(p(resumenSeccion(sec), 'Detalle_after'));
      body.push(block(sec.descripcion, 'Standard'));
    }

    for (const o of sec.obras) {
      body.push(etiqueta(o.disciplina, { obra: true }));
      body.push(h(o.titulo, 2, 'Heading_20_2'));
      if (o.serie) body.push(p('', 'Detalle_after', `<text:span text:style-name="T_italic">Serie: ${xml(o.serie)}</text:span>`));

      const im = images.get(o.imagen);
      if (im) {
        let n = pictureIndex.get(o.imagen);
        if (!n) {
          n = pictures.length + 1;
          pictures.push({ n, bytes: im.bytes });
          pictureIndex.set(o.imagen, n);
        }
        const { w, h: hh } = fitCm(im, 16.5, 13.5);
        body.push(p('', 'Imagen',
          `<draw:frame draw:style-name="fr1" draw:name="Imagen${n}" text:anchor-type="as-char" svg:width="${w.toFixed(2)}cm" svg:height="${hh.toFixed(2)}cm" draw:z-index="0">` +
          `<draw:image xlink:href="Pictures/imagen${n}.jpg" xlink:type="simple" xlink:show="embed" xlink:actuate="onLoad"/>` +
          `<svg:title>${xml(o.titulo)}</svg:title></draw:frame>`));
      } else {
        body.push(p('', 'Detalle', `<text:span text:style-name="T_italic">Imagen no disponible</text:span>`));
      }

      for (const [k, v] of fichaFilas(o)) {
        body.push(p('', 'Ficha', `<text:span text:style-name="T_bold">${xml(k)}:</text:span> ${xml(v)}`));
      }
      body.push(block(o.descripcion, 'Descripcion'));
    }
  }

  // ----- Contacto -----
  body.push(etiqueta('Contacto', { arriba: true }));
  body.push(h(model.artista, 1, 'Heading_20_1'));
  for (const [k, v] of [['Email', model.contacto.email], ['Instagram', model.contacto.instagram], ['Facebook', model.contacto.facebook], ['Portfolio en línea', model.url]]) {
    if (v) body.push(p('', 'Ficha', `<text:span text:style-name="T_bold">${xml(k)}:</text:span> ${xml(v)}`));
  }

  const contentXml = `${HEAD}<office:document-content ${NS} office:version="1.2">
  <office:automatic-styles>${AUTO_STYLES}</office:automatic-styles>
  <office:body><office:text>${body.join('')}</office:text></office:body>
</office:document-content>`;

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
    { name: 'styles.xml', data: STYLES(model) },
    { name: 'meta.xml', data: metaXml },
    ...pictures.map(pc => ({ name: `Pictures/imagen${pc.n}.jpg`, data: pc.bytes }))
  ], MIME);
}
