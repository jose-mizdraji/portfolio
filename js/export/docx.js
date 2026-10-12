// ============================================
// Exportación a Word (.docx), armada a mano (ZIP + WordprocessingML).
// A4 vertical, pensado para que el artista lo pueda EDITAR:
// títulos con estilos reales (aparecen en el panel de navegación),
// fotos como imágenes en línea y una obra por página.
// ============================================

import { buildZip } from './zip.js';
import { xml, paragraphs, fitCm, capitalize } from './xml.js';
import { fichaFilas, resumenSeccion } from './model.js';

const NS = [
  'xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"',
  'xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"',
  'xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing"',
  'xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"',
  'xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture"'
].join(' ');

const HEAD = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n';
const EMU_PER_CM = 360000;
const ACCENT = '8B7355';
const MUTED = '6E6E6A';

const STYLES = `${HEAD}<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:docDefaults>
    <w:rPrDefault><w:rPr><w:rFonts w:ascii="Calibri" w:hAnsi="Calibri" w:eastAsia="Calibri" w:cs="Calibri"/><w:sz w:val="22"/><w:szCs w:val="22"/><w:lang w:val="es-AR" w:eastAsia="en-US" w:bidi="ar-SA"/></w:rPr></w:rPrDefault>
    <w:pPrDefault><w:pPr><w:spacing w:after="120" w:line="288" w:lineRule="auto"/></w:pPr></w:pPrDefault>
  </w:docDefaults>
  <w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/><w:qFormat/></w:style>
  <w:style w:type="paragraph" w:styleId="Title"><w:name w:val="Title"/><w:basedOn w:val="Normal"/><w:next w:val="Normal"/><w:qFormat/>
    <w:pPr><w:spacing w:before="0" w:after="160" w:line="240" w:lineRule="auto"/></w:pPr>
    <w:rPr><w:rFonts w:ascii="Cambria" w:hAnsi="Cambria" w:cs="Cambria"/><w:sz w:val="84"/><w:szCs w:val="84"/></w:rPr></w:style>
  <w:style w:type="paragraph" w:styleId="Subtitle"><w:name w:val="Subtitle"/><w:basedOn w:val="Normal"/><w:next w:val="Normal"/><w:qFormat/>
    <w:pPr><w:spacing w:before="240" w:after="120"/></w:pPr>
    <w:rPr><w:rFonts w:ascii="Cambria" w:hAnsi="Cambria" w:cs="Cambria"/><w:i/><w:iCs/><w:sz w:val="40"/><w:szCs w:val="40"/></w:rPr></w:style>
  <w:style w:type="paragraph" w:styleId="Heading1"><w:name w:val="heading 1"/><w:basedOn w:val="Normal"/><w:next w:val="Normal"/><w:qFormat/>
    <w:pPr><w:keepNext/><w:spacing w:before="0" w:after="160" w:line="240" w:lineRule="auto"/><w:outlineLvl w:val="0"/></w:pPr>
    <w:rPr><w:rFonts w:ascii="Cambria" w:hAnsi="Cambria" w:cs="Cambria"/><w:sz w:val="64"/><w:szCs w:val="64"/></w:rPr></w:style>
  <w:style w:type="paragraph" w:styleId="Heading2"><w:name w:val="heading 2"/><w:basedOn w:val="Normal"/><w:next w:val="Normal"/><w:qFormat/>
    <w:pPr><w:keepNext/><w:spacing w:before="60" w:after="80" w:line="240" w:lineRule="auto"/><w:outlineLvl w:val="1"/></w:pPr>
    <w:rPr><w:rFonts w:ascii="Cambria" w:hAnsi="Cambria" w:cs="Cambria"/><w:sz w:val="44"/><w:szCs w:val="44"/></w:rPr></w:style>
  <w:style w:type="paragraph" w:customStyle="1" w:styleId="Etiqueta"><w:name w:val="Etiqueta"/><w:basedOn w:val="Normal"/><w:qFormat/>
    <w:pPr><w:spacing w:before="0" w:after="60"/></w:pPr>
    <w:rPr><w:caps/><w:color w:val="${ACCENT}"/><w:spacing w:val="40"/><w:sz w:val="17"/><w:szCs w:val="17"/></w:rPr></w:style>
  <w:style w:type="paragraph" w:customStyle="1" w:styleId="Detalle"><w:name w:val="Detalle"/><w:basedOn w:val="Normal"/><w:qFormat/>
    <w:rPr><w:color w:val="${MUTED}"/><w:sz w:val="20"/><w:szCs w:val="20"/></w:rPr></w:style>
  <w:style w:type="paragraph" w:styleId="Footer"><w:name w:val="footer"/><w:basedOn w:val="Normal"/>
    <w:pPr><w:tabs><w:tab w:val="right" w:pos="9638"/></w:tabs><w:spacing w:after="0"/></w:pPr>
    <w:rPr><w:color w:val="${MUTED}"/><w:sz w:val="17"/><w:szCs w:val="17"/></w:rPr></w:style>
</w:styles>`;

// ----- helpers de contenido -----

const run = (text, { b, i, color } = {}) => {
  const props = `${b ? '<w:b/>' : ''}${i ? '<w:i/>' : ''}${color ? `<w:color w:val="${color}"/>` : ''}`;
  return `<w:r>${props ? `<w:rPr>${props}</w:rPr>` : ''}<w:t xml:space="preserve">${xml(text)}</w:t></w:r>`;
};

const para = (inner, { style, jc, before, after, breakBefore, keepNext } = {}) => {
  const ppr = [
    style ? `<w:pStyle w:val="${style}"/>` : '',
    keepNext ? '<w:keepNext/>' : '',
    breakBefore ? '<w:pageBreakBefore/>' : '',
    (before !== undefined || after !== undefined)
      ? `<w:spacing${before !== undefined ? ` w:before="${before}"` : ''}${after !== undefined ? ` w:after="${after}"` : ''}/>` : '',
    jc ? `<w:jc w:val="${jc}"/>` : ''
  ].join('');
  return `<w:p>${ppr ? `<w:pPr>${ppr}</w:pPr>` : ''}${inner}</w:p>`;
};

const text = (t, opts, runOpts) => para(run(t, runOpts), opts);
const textBlock = (t, opts, runOpts) => paragraphs(t).map(line => text(line, opts, runOpts)).join('');

function drawing(rid, n, widthCm, heightCm, descr) {
  const cx = Math.round(widthCm * EMU_PER_CM);
  const cy = Math.round(heightCm * EMU_PER_CM);
  return `<w:r><w:drawing><wp:inline distT="0" distB="0" distL="0" distR="0">
    <wp:extent cx="${cx}" cy="${cy}"/><wp:docPr id="${n}" name="Imagen ${n}" descr="${xml(descr)}"/>
    <wp:cNvGraphicFramePr><a:graphicFrameLocks noChangeAspect="1"/></wp:cNvGraphicFramePr>
    <a:graphic><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture">
      <pic:pic><pic:nvPicPr><pic:cNvPr id="${n}" name="imagen${n}.jpg"/><pic:cNvPicPr/></pic:nvPicPr>
        <pic:blipFill><a:blip r:embed="rIdImg${n}"/><a:stretch><a:fillRect/></a:stretch></pic:blipFill>
        <pic:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="${cx}" cy="${cy}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></pic:spPr>
      </pic:pic></a:graphicData></a:graphic></wp:inline></w:drawing></w:r>`;
}

export function buildDocx(model, images) {
  const media = [];            // { n, bytes }
  const mediaIndex = new Map(); // ruta → n (una misma foto no se guarda dos veces)
  const body = [];

  // ----- Portada -----
  body.push(text('Portfolio', { style: 'Etiqueta', before: 2400 }));
  body.push(text(model.artista, { style: 'Title' }));
  if (model.subtitulo) body.push(text(model.subtitulo, { style: 'Detalle', after: 360 }));
  body.push(text(model.titulo, { style: 'Subtitle' }));
  if (model.destinatario) body.push(text(model.destinatario, {}, { color: '1A1A1A' }));
  body.push(textBlock(model.descripcion, { style: 'Detalle' }));
  body.push(text(capitalize(model.fecha), { style: 'Detalle', before: 1200, after: 0 }));
  body.push(text(model.url, { style: 'Detalle' }));

  // ----- Secciones -----
  const unaSolaSinTexto = model.secciones.length === 1 && !model.secciones[0].descripcion;
  // Cada bloque (separador de serie, obra, contacto) arranca en página nueva.
  const brk = () => true;

  for (const sec of model.secciones) {
    if (!unaSolaSinTexto) {
      body.push(text(sec.esSerie ? 'Serie' : 'Obras', { style: 'Etiqueta', breakBefore: brk(), before: 2400 }));
      body.push(text(sec.titulo, { style: 'Heading1' }));
      body.push(text(resumenSeccion(sec), { style: 'Detalle', after: 240 }));
      body.push(textBlock(sec.descripcion, {}));
    }

    for (const o of sec.obras) {
      body.push(text(o.disciplina, { style: 'Etiqueta', breakBefore: brk() }));
      body.push(text(o.titulo, { style: 'Heading2' }));
      if (o.serie) body.push(text(`Serie: ${o.serie}`, { style: 'Detalle', after: 160 }, { i: true }));

      const im = images.get(o.imagen);
      if (im) {
        let n = mediaIndex.get(o.imagen);
        if (!n) {
          n = media.length + 1;
          media.push({ n, bytes: im.bytes });
          mediaIndex.set(o.imagen, n);
        }
        const { w, h } = fitCm(im, 16.5, 13.5);
        body.push(para(drawing(n, n, w, h, o.titulo), { jc: 'center', before: 120, after: 200, keepNext: true }));
      } else {
        body.push(text('Imagen no disponible', { style: 'Detalle' }, { i: true }));
      }

      for (const [k, v] of fichaFilas(o)) {
        body.push(para(run(`${k}: `, { b: true }) + run(v), { after: 40 }));
      }
      body.push(textBlock(o.descripcion, { before: 160 }));
    }
  }

  // ----- Contacto -----
  body.push(text('Contacto', { style: 'Etiqueta', breakBefore: brk(), before: 2400 }));
  body.push(text(model.artista, { style: 'Heading1' }));
  for (const [k, v] of [['Email', model.contacto.email], ['Instagram', model.contacto.instagram], ['Facebook', model.contacto.facebook], ['Portfolio en línea', model.url]]) {
    if (v) body.push(para(run(`${k}: `, { b: true }) + run(v), { after: 80 }));
  }

  const documentXml = `${HEAD}<w:document ${NS}><w:body>${body.join('')}
    <w:sectPr><w:footerReference w:type="default" r:id="rIdFooter"/><w:pgSz w:w="11906" w:h="16838"/>
    <w:pgMar w:top="1134" w:right="1134" w:bottom="1134" w:left="1134" w:header="567" w:footer="567" w:gutter="0"/><w:titlePg/></w:sectPr>
  </w:body></w:document>`;

  const footerXml = `${HEAD}<w:ftr ${NS}><w:p><w:pPr><w:pStyle w:val="Footer"/></w:pPr>${run(`${model.artista}  ·  ${model.titulo}`)}<w:r><w:tab/></w:r><w:fldSimple w:instr=" PAGE "><w:r><w:t>2</w:t></w:r></w:fldSimple></w:p></w:ftr>`;

  const rels = [
    '<Relationship Id="rIdStyles" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>',
    '<Relationship Id="rIdFooter" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/footer" Target="footer1.xml"/>',
    ...media.map(m => `<Relationship Id="rIdImg${m.n}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="media/imagen${m.n}.jpg"/>`)
  ].join('');

  const iso = new Date().toISOString();
  const files = [
    { name: '[Content_Types].xml', data: `${HEAD}<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
      <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
      <Default Extension="xml" ContentType="application/xml"/>
      <Default Extension="jpg" ContentType="image/jpeg"/>
      <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
      <Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/>
      <Override PartName="/word/footer1.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.footer+xml"/>
      <Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/>
    </Types>` },
    { name: '_rels/.rels', data: `${HEAD}<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
      <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
      <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/>
    </Relationships>` },
    { name: 'docProps/core.xml', data: `${HEAD}<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
      <dc:title>${xml(`${model.titulo} — ${model.artista}`)}</dc:title><dc:creator>${xml(model.artista)}</dc:creator>
      <dcterms:created xsi:type="dcterms:W3CDTF">${iso}</dcterms:created><dcterms:modified xsi:type="dcterms:W3CDTF">${iso}</dcterms:modified>
    </cp:coreProperties>` },
    { name: 'word/document.xml', data: documentXml },
    { name: 'word/styles.xml', data: STYLES },
    { name: 'word/footer1.xml', data: footerXml },
    { name: 'word/_rels/document.xml.rels', data: `${HEAD}<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${rels}</Relationships>` },
    ...media.map(m => ({ name: `word/media/imagen${m.n}.jpg`, data: m.bytes }))
  ];

  return buildZip(files, 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
}
