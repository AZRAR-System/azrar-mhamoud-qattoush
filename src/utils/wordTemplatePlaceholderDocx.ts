import PizZip from 'pizzip';
import type { WordTemplateType } from '@/components/settings/settingsTypes';

function escXml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** Minimal OOXML paragraph using the same prefix as standard WordprocessingML. */
function wP(text: string): string {
  return `<w:p><w:r><w:t xml:space="preserve">${escXml(text)}</w:t></w:r></w:p>`;
}

/**
 * Inserts a short “variable reference” block at the top of word/document.xml so placeholders stay visible in Word.
 * Returns null if the package cannot be patched (caller should fall back to the raw buffer).
 */
export function prependPlaceholderGuideToDocx(
  templateArrayBuffer: ArrayBuffer,
  lines: string[]
): Uint8Array | null {
  try {
    const zip = new PizZip(new Uint8Array(templateArrayBuffer));
    const xmlPath = 'word/document.xml';
    const xmlText = zip.file(xmlPath)?.asText();
    if (!xmlText) return null;

    const guide: string[] = [
      wP('— مرجع المتغيرات (للتعديل في Word) —'),
      ...lines.map((l) => wP(l)),
      wP(''),
    ];
    const inserted = xmlText.replace(/<w:body[^>]*>/, (open) => `${open}${guide.join('')}`);
    if (inserted === xmlText) return null;

    zip.file(xmlPath, inserted);
    const out = zip.generate({ type: 'uint8array', compression: 'DEFLATE' });
    return out;
  } catch {
    return null;
  }
}

export function applyPlaceholderGuideToDocx(
  templateArrayBuffer: ArrayBuffer,
  lines: string[]
): Uint8Array {
  const patched = prependPlaceholderGuideToDocx(templateArrayBuffer, lines);
  return patched ?? new Uint8Array(templateArrayBuffer);
}

export function getPlaceholderGuideLines(type: WordTemplateType): string[] {
  if (type === 'contracts') {
    return [
      '{{اسم_المؤجر}}',
      '{{اسم_المستأجر}}',
      '{{عنوان_العقار}}',
      '{{مدة_العقد}}',
      '{{قيمة_الإيجار}}',
      '{{تاريخ_البداية}}',
      '{{شروط_إضافية}}',
    ];
  }
  if (type === 'installments') {
    return [
      '{{رقم_العقد}}',
      '{{اسم_المستأجر}}',
      '{{العقار}}',
      '{{مبلغ_القسط}}',
      '{{تاريخ_الاستحقاق}}',
      '{{المدفوع}}',
      '{{المتبقي}}',
    ];
  }
  return [
    '{{رقم_المحضر}}',
    '{{تاريخ_التسليم}}',
    '{{اسم_المستأجر}}',
    '{{العقار}}',
    '{{ملاحظات_التسليم}}',
    '{{توقيع_المستلم}}',
  ];
}
