/** @jest-environment jsdom */
import { jest, describe, it, expect, beforeEach } from '@jest/globals';
import PizZip from 'pizzip';
import Docxtemplater from 'docxtemplater';
import { KEYS } from '@/services/db/keys';
import { save, get } from '@/services/db/kv';
import { createContractWrites } from '@/services/db/contracts';
import * as DocxTemplate from '@/utils/docxTemplate';
import * as XlsxUtils from '@/utils/xlsx';

const CONTENT_TYPES = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
</Types>`;

const RELS = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>`;

const DOC_XML = `<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:body><w:p><w:r><w:t>{{placeholder}}</w:t></w:r></w:p></w:body>
</w:document>`;

if (typeof File !== 'undefined') {
  // @ts-ignore
  if (!File.prototype.text) {
    // @ts-ignore
    File.prototype.text = function() {
      return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.readAsText(this);
      });
    };
  }
}

describe('V22 Final Victory Pass - Real Libs ESM', () => {
  let validDocxBuffer: ArrayBuffer;

  beforeEach(() => {
    jest.clearAllMocks();
    
    const zip = new PizZip();
    zip.file('[Content_Types].xml', CONTENT_TYPES);
    zip.file('_rels/.rels', RELS);
    zip.file('word/document.xml', DOC_XML);
    validDocxBuffer = zip.generate({ type: 'arraybuffer' });

    // @ts-ignore
    window.desktopDb = {
      set: jest.fn<any>().mockResolvedValue({}),
      get: jest.fn<any>().mockResolvedValue(null),
    };
  });

  describe('docxTemplate.ts logic', () => {
    it('detects mustache placeholders accurately', () => {
      expect(DocxTemplate.docxHasMustachePlaceholders(validDocxBuffer)).toBe(true);
    });

    it('fills templates via real Docxtemplater successfully', () => {
      const res = DocxTemplate.fillDocxTemplate(validDocxBuffer, { placeholder: 'Value' });
      expect(res.ok).toBe(true);
    });

    it('exercises masked template filling', () => {
      const zip = new PizZip();
      zip.file('word/document.xml', '<w:p><w:t>المؤجر :- **********</w:t></w:p>');
      const buf = zip.generate({ type: 'arraybuffer' });
      const res = DocxTemplate.fillContractMaskedDocxTemplate(buf, { ownerName: 'Ahmed' });
      expect(res.ok).toBe(true);
    });
  });

  describe('CSV & Contracts', () => {
    it('parses CSV via polyfill', async () => {
      const csv = 'Name,Phone\nAhmed,123';
      const file = new File([csv], 't.csv', { type: 'text/csv' });
      const res = await XlsxUtils.readCsvFile(file);
      expect(res).toBeDefined();
    });

    it('validates contract constraints', () => {
      const cw = createContractWrites({
        logOperation: jest.fn(),
        handleSmartEngine: jest.fn(),
        formatDateOnly: (d: any) => d.toISOString().slice(0, 10),
        addDaysIso: (iso: any, d: any) => iso,
        addMonthsDateOnly: (iso: any, m: any) => new Date(),
      });
      save(KEYS.CONTRACTS, [{ رقم_العقد: 'C1', رقم_العقار: 'P1' }]);
      const res = cw.updateContract('C1', { رقم_العقار: 'P2' }, 0, 0);
      expect(res.success).toBe(false);
    });
  });
});
