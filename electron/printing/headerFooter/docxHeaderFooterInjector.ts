import type PizZip from 'pizzip';
import { HEADER_FOOTER_PAGE_TOKEN } from './headerFooterEngine';
import type { HeaderFooterResolved } from './types';

const escapeXml = (v: string): string =>
  String(v ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');

const getTextFile = (zip: PizZip, filePath: string): string => {
  const f = zip.file(filePath);
  if (!f) return '';
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (f as any).asText?.() ?? '';
  } catch {
    return '';
  }
};

const setTextFile = (zip: PizZip, filePath: string, text: string): void => {
  zip.file(filePath, text);
};

const ensureOverride = (typesXml: string, partName: string, contentType: string): string => {
  if (typesXml.includes(`PartName="${partName}"`)) return typesXml;
  const override = `<Override PartName="${partName}" ContentType="${contentType}"/>`;
  const idx = typesXml.lastIndexOf('</Types>');
  if (idx === -1) return typesXml;
  return typesXml.slice(0, idx) + override + typesXml.slice(idx);
};

const parseRelationships = (
  relsXml: string
): Array<{ id: string; type: string; target: string }> => {
  const out: Array<{ id: string; type: string; target: string }> = [];
  const re = /<Relationship\s+[^>]*Id="([^"]+)"[^>]*Type="([^"]+)"[^>]*Target="([^"]+)"[^>]*\/>/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(relsXml))) {
    const id = m[1];
    const type = m[2];
    const target = m[3];
    if (!id || !type || !target) continue;
    out.push({ id, type, target });
  }
  return out;
};

const pickNextRid = (rels: Array<{ id: string }>): string => {
  let max = 0;
  for (const r of rels) {
    const m = /^rId(\d+)$/.exec(r.id);
    if (!m) continue;
    const n = Number(m[1]);
    if (Number.isFinite(n) && n > max) max = n;
  }
  return `rId${max + 1}`;
};

const ensureRelationship = (
  relsXml: string,
  type: 'header' | 'footer',
  target: string
): { xml: string; id: string } => {
  const rels = parseRelationships(relsXml);
  const typeUrl = `http://schemas.openxmlformats.org/officeDocument/2006/relationships/${type}`;

  const existing = rels.find((r) => r.type === typeUrl && r.target === target);
  if (existing) return { xml: relsXml, id: existing.id };

  const id = pickNextRid(rels);
  const rel = `<Relationship Id="${id}" Type="${typeUrl}" Target="${target}"/>`;

  const idx = relsXml.lastIndexOf('</Relationships>');
  if (idx === -1) return { xml: relsXml, id };

  return { xml: relsXml.slice(0, idx) + rel + relsXml.slice(idx), id };
};

const buildHeaderXml = (lines: string[]): string => {
  const paras = lines
    .map((line) => {
      const t = escapeXml(line);
      return `<w:p><w:pPr><w:jc w:val="right"/><w:bidi/></w:pPr><w:r><w:rPr><w:rtl/></w:rPr><w:t xml:space="preserve">${t}</w:t></w:r></w:p>`;
    })
    .join('');

  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:hdr xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">${paras}</w:hdr>`;
};

const buildFooterXml = (line: string): string => {
  const parts = String(line || '').split(HEADER_FOOTER_PAGE_TOKEN);
  const before = escapeXml(parts[0] ?? '');
  const after = escapeXml(parts.slice(1).join(HEADER_FOOTER_PAGE_TOKEN) ?? '');

  const pageField = `<w:fldSimple w:instr=" PAGE \\* MERGEFORMAT "><w:r><w:rPr><w:noProof/></w:rPr><w:t>1</w:t></w:r></w:fldSimple>`;

  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:ftr xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><w:p><w:pPr><w:jc w:val="right"/><w:bidi/></w:pPr><w:r><w:rPr><w:rtl/></w:rPr><w:t xml:space="preserve">${before}</w:t></w:r>${pageField}<w:r><w:rPr><w:rtl/></w:rPr><w:t xml:space="preserve">${after}</w:t></w:r></w:p></w:ftr>`;
};

const upsertHeaderFooterRefsInLastSectPr = (
  documentXml: string,
  headerRid?: string,
  footerRid?: string
): string => {
  const start = documentXml.lastIndexOf('<w:sectPr');
  if (start === -1) return documentXml;

  const end = documentXml.indexOf('</w:sectPr>', start);
  if (end === -1) return documentXml;

  const sect = documentXml.slice(start, end);
  const cleaned = sect
    .replace(/<w:headerReference\b[^>]*\/>/g, '')
    .replace(/<w:footerReference\b[^>]*\/>/g, '');

  const refs = [
    headerRid ? `<w:headerReference w:type="default" r:id="${headerRid}"/>` : '',
    footerRid ? `<w:footerReference w:type="default" r:id="${footerRid}"/>` : '',
  ]
    .filter(Boolean)
    .join('');

  const nextSect = cleaned + refs;
  return documentXml.slice(0, start) + nextSect + documentXml.slice(end);
};

export const injectHeaderFooterIntoDocxZip = (
  zip: PizZip,
  resolved: HeaderFooterResolved
): void => {
  const wantsHeader = resolved.headerEnabled && resolved.headerLines.length > 0;
  const wantsFooter = resolved.footerEnabled && resolved.footerLine.trim().length > 0;
  if (!wantsHeader && !wantsFooter) return;

  // Write parts
  if (wantsHeader) setTextFile(zip, 'word/header1.xml', buildHeaderXml(resolved.headerLines));
  if (wantsFooter) setTextFile(zip, 'word/footer1.xml', buildFooterXml(resolved.footerLine));

  // Content types
  const typesPath = '[Content_Types].xml';
  let typesXml = getTextFile(zip, typesPath);
  if (typesXml) {
    if (wantsHeader) {
      typesXml = ensureOverride(
        typesXml,
        '/word/header1.xml',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.header+xml'
      );
    }
    if (wantsFooter) {
      typesXml = ensureOverride(
        typesXml,
        '/word/footer1.xml',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.footer+xml'
      );
    }
    setTextFile(zip, typesPath, typesXml);
  }

  // Relationships
  const relsPath = 'word/_rels/document.xml.rels';
  let relsXml = getTextFile(zip, relsPath);
  if (!relsXml) return;

  let headerRid: string | undefined;
  let footerRid: string | undefined;

  if (wantsHeader) {
    const ensured = ensureRelationship(relsXml, 'header', 'header1.xml');
    relsXml = ensured.xml;
    headerRid = ensured.id;
  }

  if (wantsFooter) {
    const ensured = ensureRelationship(relsXml, 'footer', 'footer1.xml');
    relsXml = ensured.xml;
    footerRid = ensured.id;
  }

  setTextFile(zip, relsPath, relsXml);

  // Document sectPr references
  const docPath = 'word/document.xml';
  const docXml = getTextFile(zip, docPath);
  if (!docXml) return;

  const nextDocXml = upsertHeaderFooterRefsInLastSectPr(docXml, headerRid, footerRid);
  setTextFile(zip, docPath, nextDocXml);
};
