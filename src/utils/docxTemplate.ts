import PizZip from 'pizzip';
import Docxtemplater from 'docxtemplater';
import { arabicNumberToWords } from '@/utils/arabicNumber';

export type DocxMergeResult =
  | { ok: true; bytes: Uint8Array }
  | { ok: false; message: string };

export function fillDocxTemplate(templateArrayBuffer: ArrayBuffer, data: Record<string, any>): DocxMergeResult {
  try {
    const zip = new PizZip(new Uint8Array(templateArrayBuffer));

    const doc = new Docxtemplater(zip, {
      paragraphLoop: true,
      linebreaks: true,
      delimiters: { start: '{{', end: '}}' },
      nullGetter: () => '',
    });

    doc.render(data || {});

    const out = doc.getZip().generate({
      type: 'uint8array',
      compression: 'DEFLATE',
    });

    return { ok: true, bytes: out };
  } catch (e: any) {
    // docxtemplater can throw complex objects; keep message safe.
    const msg =
      e?.message ||
      e?.properties?.explanation ||
      e?.properties?.errors?.[0]?.properties?.explanation ||
      'فشل إنشاء ملف Word من القالب';
    return { ok: false, message: String(msg) };
  }
}

type ContractDocxData = {
  ownerName?: string;
  ownerNationalId?: string;
  tenantName?: string;
  tenantNationalId?: string;
  propertyType?: string;
  propertyDescriptor?: string;
  region?: string;
  plotNo?: string;
  plateNo?: string;
  apartmentNo?: string;
  basinName?: string;
  boundaries?: string;
  startDate?: string;
  rentValueNumber?: number;
  rentValueWords?: string;
  installmentValueNumber?: number;
  electricitySubscriptionNo?: string;
  electricitySubscriptionName?: string;
  waterSubscriptionNo?: string;
  waterSubscriptionName?: string;
  rentBillsCount?: number;
  rentBillValue?: number;
  rentBillEveryText?: string;
  rentBillsStartDate?: string;
  depositDueDate?: string;
  signatureDate?: string;
};

const replaceStarRunsSequential = (input: string, replacements: Array<string | number | undefined | null>) => {
  const norm = (v: any) => {
    if (v === undefined || v === null) return '';
    const s = String(v);
    return s;
  };

  let idx = 0;
  return input.replace(/\*{2,}/g, () => {
    const v = idx < replacements.length ? replacements[idx++] : undefined;
    return norm(v);
  });
};

const replaceParenStarRunsSequential = (input: string, replacements: Array<string | number | undefined | null>) => {
  const norm = (v: any) => {
    if (v === undefined || v === null) return '';
    return String(v);
  };

  let idx = 0;
  // Only replace star-runs inside parentheses first to avoid touching other masked content.
  let out = input.replace(/\([^\)]*\*{2,}[^\)]*\)/g, (m) => {
    const rep = idx < replacements.length ? replacements[idx++] : undefined;
    // Replace only the star run inside this parentheses block
    return m.replace(/\*{2,}/g, () => norm(rep));
  });

  return out;
};

export function fillContractMaskedDocxTemplate(templateArrayBuffer: ArrayBuffer, data: ContractDocxData): DocxMergeResult {
  try {
    const zip = new PizZip(new Uint8Array(templateArrayBuffer));
    const xmlPath = 'word/document.xml';
    const xmlText = zip.file(xmlPath)?.asText();
    if (!xmlText) return { ok: false, message: 'قالب Word غير صالح (document.xml غير موجود)' };

    const parser = new DOMParser();
    const xml = parser.parseFromString(xmlText, 'application/xml');

    const paragraphs = Array.from(xml.getElementsByTagName('w:p'));
    for (const p of paragraphs) {
      const textNodes = Array.from(p.getElementsByTagName('w:t')) as Element[];
      if (textNodes.length === 0) continue;
      const original = textNodes.map(n => n.textContent || '').join('');
      if (!original.includes('*')) continue;

      let updated = original;

      // (1) Owner
      if (original.includes('المؤجر :-')) {
        updated = replaceStarRunsSequential(updated, [data.ownerName, data.ownerNationalId]);
      }

      // (2) Tenant
      else if (original.includes('المستأج')) {
        updated = replaceStarRunsSequential(updated, [data.tenantName, data.tenantNationalId]);
      }

      // (3) Property type line
      else if (original.includes('جنس المأجور')) {
        updated = replaceStarRunsSequential(updated, [data.propertyType, data.propertyDescriptor]);
      }

      // (4) Property location line
      else if (original.includes('موقع المأجور')) {
        updated = replaceStarRunsSequential(updated, [data.region, data.plotNo, data.plateNo, data.apartmentNo, data.basinName]);
      }

      // (5) Boundaries
      else if (original.includes('حدود المأجور')) {
        updated = replaceStarRunsSequential(updated, [data.boundaries]);
      }

      // (6) Start date
      else if (original.includes('تاريخ ابتداء') && original.includes('الإيج')) {
        updated = replaceStarRunsSequential(updated, [data.startDate]);
      }

      // (7) Rent value + words
      else if (original.includes('بـــــدل') || original.includes('بدل الإيج')) {
        const rentNumber = data.rentValueNumber ?? '';
        const rentWords = (data.rentValueWords || (typeof data.rentValueNumber === 'number' ? arabicNumberToWords(data.rentValueNumber) : '')) || '';
        updated = replaceStarRunsSequential(updated, [rentNumber, rentWords]);
      }

      // (8) How to pay (installment value)
      else if (original.includes('كيفية أداء البدل')) {
        updated = replaceStarRunsSequential(updated, [data.installmentValueNumber]);
      }

      // (9) Utilities numbers & names
      else if (original.includes('تزود بالكهرباء') || original.includes('تزود بالمياه')) {
        // This paragraph has multiple masked blocks in parentheses; replace them in order.
        updated = replaceParenStarRunsSequential(updated, [
          data.electricitySubscriptionNo,
          data.electricitySubscriptionName,
          data.waterSubscriptionNo,
          data.waterSubscriptionName,
        ]);
      }

      // (10) Bills/notes paragraph
      else if (original.includes('قدم المستأجر عدد') && original.includes('كمبيالة')) {
        // Replace the masked parenthesis blocks in order:
        // (***) count, (*** دينارًا), (******) start date, (******) deposit due date
        updated = replaceParenStarRunsSequential(updated, [
          data.rentBillsCount,
          data.rentBillValue !== undefined ? `${data.rentBillValue} دينارًا أردنيًا` : undefined,
          data.rentBillsStartDate,
          data.depositDueDate,
        ]);
        // Replace the (كل ........) part using a simple direct replace.
        if (data.rentBillEveryText) {
          updated = updated.replace(/\(كل\s*\.+\)/g, `(كل ${data.rentBillEveryText})`);
        }
      }

      // (11) Signature date
      else if (original.includes('حرر هذا العقد') && original.includes('بتاريخ')) {
        updated = replaceParenStarRunsSequential(updated, [data.signatureDate]);
      }

      if (updated !== original) {
        // Keep formatting by writing everything into the first text node and clearing the rest.
        textNodes[0].textContent = updated;
        for (let i = 1; i < textNodes.length; i++) textNodes[i].textContent = '';
      }
    }

    const serialized = new XMLSerializer().serializeToString(xml);
    zip.file(xmlPath, serialized);

    const out = zip.generate({
      type: 'uint8array',
      compression: 'DEFLATE',
    });

    return { ok: true, bytes: out };
  } catch (e: any) {
    const msg = e?.message || 'فشل إنشاء ملف Word من القالب';
    return { ok: false, message: String(msg) };
  }
}
