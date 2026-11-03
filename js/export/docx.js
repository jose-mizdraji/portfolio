// ============================================
// Exportación a Word (.docx), armada a mano (ZIP + WordprocessingML).
//
// Dibuja la MISMA maquetación que el PDF (layout.js): A4 apaisado, cada texto en un
// cuadro de texto, cada foto como imagen y las líneas como filetes. Todo se puede
// editar en Word: se hace clic en un texto y se escribe; se hace clic derecho en una
// foto → «Cambiar imagen». El pie de página es un pie real (con número automático).
//
// Fuentes: Arial y Times New Roman, que son lo mismo que Helvetica y Times del PDF.
// ============================================

import { buildZip } from './zip.js';
import { xml } from './xml.js';
import { editorBox } from './layout.js';

const NS = [
  'xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"',
  'xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"',
  'xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing"',
  'xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"',
  'xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture"',
  'xmlns:wps="http://schemas.microsoft.com/office/word/2010/wordprocessingShape"',
  'xmlns:mc="http://schemas.openxmlformats.org/markup-compatibility/2006"'
].join(' ');

const HEAD = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n';
const PT = 25.4 / 72;                        // mm por punto
const emu = (mm) => Math.round(mm * 36000);
const twipsPt = (pt) => Math.round(pt * 20);
const twipsMm = (mm) => Math.round((mm / 25.4) * 1440);
const hex = (c) => c.map(v => v.toString(16).padStart(2, '0')).join('').toUpperCase();

const FONTS = { helvetica: 'Arial', times: 'Times New Roman' };

const STYLES = `${HEAD}<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:docDefaults>
    <w:rPrDefault><w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:eastAsia="Arial" w:cs="Arial"/><w:sz w:val="20"/><w:szCs w:val="20"/><w:lang w:val="es-AR" w:eastAsia="en-US" w:bidi="ar-SA"/></w:rPr></w:rPrDefault>
    <w:pPrDefault><w:pPr><w:spacing w:before="0" w:after="0" w:line="240" w:lineRule="auto"/></w:pPr></w:pPrDefault>
  </w:docDefaults>
  <w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/><w:qFormat/></w:style>
  <w:style w:type="paragraph" w:styleId="Footer"><w:name w:val="footer"/><w:basedOn w:val="Normal"/></w:style>
</w:styles>`;

const SETTINGS = `${HEAD}<w:settings xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:zoom w:percent="100"/>
  <w:defaultTabStop w:val="720"/>
  <w:characterSpacingControl w:val="doNotCompress"/>
  <w:compat><w:compatSetting w:name="compatibilityMode" w:uri="http://schemas.microsoft.com/office/word" w:val="15"/></w:compat>
</w:settings>`;

// ----- texto -----

function rPr(r) {
  const bold = r.style === 'bold' || r.style === 'bolditalic';
  const italic = r.style === 'italic' || r.style === 'bolditalic';
  const font = FONTS[r.font] || 'Arial';
  return '<w:rPr>' +
    `<w:rFonts w:ascii="${font}" w:hAnsi="${font}" w:eastAsia="${font}" w:cs="${font}"/>` +
    (bold ? '<w:b/><w:bCs/>' : '') +
    (italic ? '<w:i/><w:iCs/>' : '') +
    (r.upper ? '<w:caps/>' : '') +
    `<w:color w:val="${hex(r.color)}"/>` +
    (r.cs ? `<w:spacing w:val="${twipsPt(r.cs / PT)}"/>` : '') +
    `<w:sz w:val="${Math.round(r.size * 2)}"/><w:szCs w:val="${Math.round(r.size * 2)}"/>` +
    '</w:rPr>';
}

function runXml(r) {
  if (r.tab) return '<w:r><w:tab/></w:r>';
  if (r.br) return '<w:r><w:br/></w:r>';
  const props = rPr(r);
  if (r.field === 'page') {
    return `<w:fldSimple w:instr=" PAGE "><w:r>${props}<w:t>${xml(r.t)}</w:t></w:r></w:fldSimple>`;
  }
  return `<w:r>${props}<w:t xml:space="preserve">${xml(r.t)}</w:t></w:r>`;
}

function paraXml(p) {
  const ppr = [
    p.hang ? `<w:tabs><w:tab w:val="left" w:pos="${twipsMm(p.left)}"/></w:tabs>` : '',
    `<w:spacing w:before="0" w:after="${twipsPt(p.after || 0)}" w:line="${twipsPt(p.pitch)}" w:lineRule="exact"/>`,
    p.left || p.hang ? `<w:ind w:left="${twipsMm(p.left)}"${p.hang ? ` w:hanging="${twipsMm(p.hang)}"` : ''}/>` : '',
    p.align === 'right' ? '<w:jc w:val="right"/>' : p.align === 'center' ? '<w:jc w:val="center"/>' : ''
  ].join('');
  return `<w:p><w:pPr>${ppr}</w:pPr>${p.runs.map(runXml).join('')}</w:p>`;
}

// ----- elementos flotantes (todos anclados a la página) -----

function anchor(id, z, x, y, w, h, name, graphic) {
  return `<wp:anchor distT="0" distB="0" distL="0" distR="0" simplePos="0" relativeHeight="${z}" behindDoc="0" locked="0" layoutInCell="1" allowOverlap="1">` +
    '<wp:simplePos x="0" y="0"/>' +
    `<wp:positionH relativeFrom="page"><wp:posOffset>${emu(x)}</wp:posOffset></wp:positionH>` +
    `<wp:positionV relativeFrom="page"><wp:posOffset>${emu(y)}</wp:posOffset></wp:positionV>` +
    `<wp:extent cx="${emu(w)}" cy="${emu(h)}"/><wp:effectExtent l="0" t="0" r="0" b="0"/><wp:wrapNone/>` +
    `<wp:docPr id="${id}" name="${xml(name)}"/>` +
    graphic + '</wp:anchor>';
}

function shapeGraphic(w, h, spPrFill, bodyContent) {
  return '<a:graphic><a:graphicData uri="http://schemas.microsoft.com/office/word/2010/wordprocessingShape"><wps:wsp>' +
    bodyContent.head +
    `<wps:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="${emu(w)}" cy="${emu(h)}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom>${spPrFill}<a:ln><a:noFill/></a:ln></wps:spPr>` +
    bodyContent.tail +
    '</wps:wsp></a:graphicData></a:graphic>';
}

function wrapRun(drawing) {
  return `<w:r><mc:AlternateContent><mc:Choice Requires="wps"><w:drawing>${drawing}</w:drawing></mc:Choice></mc:AlternateContent></w:r>`;
}

function textBoxXml(item, id, z) {
  const body = {
    head: '<wps:cNvSpPr txBox="1"/>',
    tail: `<wps:txbx><w:txbxContent>${item.paras.map(paraXml).join('')}</w:txbxContent></wps:txbx>` +
      '<wps:bodyPr rot="0" vert="horz" wrap="square" lIns="0" tIns="0" rIns="0" bIns="0" anchor="t" anchorCtr="0"><a:spAutoFit/></wps:bodyPr>'
  };
  const h = Math.max(item.h, 1);
  const { x, w } = editorBox(item);
  return wrapRun(anchor(id, z, x, item.top, w, h, `Texto ${id}`, shapeGraphic(w, h, '<a:noFill/>', body)));
}

function rectXml(item, id, z) {
  const body = { head: '<wps:cNvSpPr/>', tail: '<wps:bodyPr rot="0" vert="horz" wrap="square" lIns="0" tIns="0" rIns="0" bIns="0" anchor="t" anchorCtr="0"><a:noAutofit/></wps:bodyPr>' };
  const fill = `<a:solidFill><a:srgbClr val="${hex(item.color)}"/></a:solidFill>`;
  return wrapRun(anchor(id, z, item.x, item.y, item.w, item.h, `Línea ${id}`, shapeGraphic(item.w, item.h, fill, body)));
}

function imageXml(item, id, z, rid) {
  const graphic = '<a:graphic><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture">' +
    `<pic:pic><pic:nvPicPr><pic:cNvPr id="${id}" name="Imagen ${id}"/><pic:cNvPicPr/></pic:nvPicPr>` +
    `<pic:blipFill><a:blip r:embed="${rid}"/><a:stretch><a:fillRect/></a:stretch></pic:blipFill>` +
    `<pic:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="${emu(item.w)}" cy="${emu(item.h)}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></pic:spPr>` +
    '</pic:pic></a:graphicData></a:graphic>';
  const a = anchor(id, z, item.x, item.y, item.w, item.h, `Imagen ${id}`, `<wp:cNvGraphicFramePr><a:graphicFrameLocks noChangeAspect="1"/></wp:cNvGraphicFramePr>${graphic}`)
    .replace(`<wp:docPr id="${id}" name="Imagen ${id}"/>`, `<wp:docPr id="${id}" name="Imagen ${id}" descr="${xml(item.alt || '')}"/>`);
  return `<w:r><w:drawing>${a}</w:drawing></w:r>`;
}

// Un párrafo casi invisible que "sostiene" todos los elementos de una página.
const HOLDER_PPR = '<w:spacing w:before="0" w:after="0" w:line="20" w:lineRule="exact"/><w:rPr><w:sz w:val="2"/><w:szCs w:val="2"/></w:rPr>';

export function buildDocx(layout, images, model) {
  const media = [];             // { n, bytes }
  const mediaIndex = new Map(); // ruta → n (una misma foto no se guarda dos veces)
  let id = 0;
  let z = 251650000;

  const itemXml = (item) => {
    id += 1; z += 1;
    if (item.k === 'rect') return rectXml(item, id, z);
    if (item.k === 'text') return textBoxXml(item, id, z);
    if (item.k === 'img') {
      const im = images.get(item.path);
      if (!im) return '';
      let n = mediaIndex.get(item.path);
      if (!n) {
        n = media.length + 1;
        media.push({ n, bytes: im.bytes });
        mediaIndex.set(item.path, n);
      }
      return imageXml(item, id, z, `rIdImg${n}`);
    }
    return '';
  };

  const body = layout.pages.map((page, i) =>
    `<w:p><w:pPr>${i > 0 ? '<w:pageBreakBefore/>' : ''}${HOLDER_PPR}</w:pPr>${page.items.map(itemXml).join('')}</w:p>`
  ).join('');

  const footerBody = `<w:p><w:pPr><w:pStyle w:val="Footer"/>${HOLDER_PPR}</w:pPr>${layout.footer.items.map(itemXml).join('')}</w:p>`;

  const documentXml = `${HEAD}<w:document ${NS}><w:body>${body}
    <w:sectPr><w:footerReference w:type="default" r:id="rIdFooter"/><w:footerReference w:type="first" r:id="rIdFooterFirst"/>
    <w:pgSz w:w="16838" w:h="11906" w:orient="landscape"/>
    <w:pgMar w:top="567" w:right="567" w:bottom="567" w:left="567" w:header="0" w:footer="0" w:gutter="0"/><w:titlePg/></w:sectPr>
  </w:body></w:document>`;

  const footerXml = `${HEAD}<w:ftr ${NS}>${footerBody}</w:ftr>`;
  const footerFirstXml = `${HEAD}<w:ftr ${NS}><w:p><w:pPr><w:pStyle w:val="Footer"/>${HOLDER_PPR}</w:pPr></w:p></w:ftr>`;

  const rels = [
    '<Relationship Id="rIdStyles" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>',
    '<Relationship Id="rIdSettings" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/settings" Target="settings.xml"/>',
    '<Relationship Id="rIdFooter" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/footer" Target="footer1.xml"/>',
    '<Relationship Id="rIdFooterFirst" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/footer" Target="footer2.xml"/>',
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
      <Override PartName="/word/settings.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.settings+xml"/>
      <Override PartName="/word/footer1.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.footer+xml"/>
      <Override PartName="/word/footer2.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.footer+xml"/>
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
    { name: 'word/settings.xml', data: SETTINGS },
    { name: 'word/footer1.xml', data: footerXml },
    { name: 'word/footer2.xml', data: footerFirstXml },
    { name: 'word/_rels/document.xml.rels', data: `${HEAD}<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${rels}</Relationships>` },
    ...media.map(m => ({ name: `word/media/imagen${m.n}.jpg`, data: m.bytes }))
  ];

  return buildZip(files, 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
}
