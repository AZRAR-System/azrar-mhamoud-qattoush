import type { SystemSettings } from '@/types';
import type { UnifiedHeaderFooter } from '@/services/printing/unifiedPrint';

export type PrintPreviewZoom = 0.75 | 1 | 1.25;

export const PRINT_PREVIEW_ZOOMS: readonly PrintPreviewZoom[] = [0.75, 1, 1.25];

export type PrintMarginsMm = { top: number; right: number; bottom: number; left: number };

export const DEFAULT_PRINT_MARGINS_MM: PrintMarginsMm = {
  top: 20,
  right: 20,
  bottom: 20,
  left: 20,
};

export type PrintPreviewDocxContext = {
  templateName?: string;
  data: Record<string, unknown>;
  defaultFileName?: string;
  headerFooter?: UnifiedHeaderFooter;
};

export function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function buildInlineLetterheadHtml(settings: SystemSettings): string {
  if (settings.letterheadEnabled === false) return '';

  const companyName = String(settings.companyName || '').trim();
  const slogan = String(settings.companySlogan || '').trim();
  const address = String(settings.companyAddress || '').trim();
  const phone = String(settings.companyPhone || '').trim();
  const email = String(settings.companyEmail || '').trim();
  const website = String(settings.companyWebsite || '').trim();
  const taxNumber = String(settings.taxNumber || '').trim();
  const commercialRegister = String(settings.commercialRegister || '').trim();
  const companyIdentityText = String(settings.companyIdentityText || '').trim();
  const logoUrl = String(settings.logoUrl || '').trim();

  const hasAny =
    companyName ||
    slogan ||
    address ||
    phone ||
    email ||
    website ||
    taxNumber ||
    commercialRegister ||
    companyIdentityText ||
    logoUrl;
  if (!hasAny) return '';

  const logoBlock = logoUrl
    ? `<div style="width:64px;height:64px;border:1px solid #e5e7eb;border-radius:8px;overflow:hidden;background:#fff;display:flex;align-items:center;justify-content:center;">
         <img src="${escapeHtml(logoUrl)}" alt="logo" style="width:100%;height:100%;object-fit:contain;" />
       </div>`
    : '';

  const idBlock =
    taxNumber || commercialRegister || companyIdentityText
      ? `<div style="font-size:11px;color:#475569;text-align:left;line-height:1.5;">
           ${companyIdentityText ? `<div style="white-space:pre-line;">${escapeHtml(companyIdentityText)}</div>` : ''}
           ${taxNumber ? `<div>الرقم الضريبي: ${escapeHtml(taxNumber)}</div>` : ''}
           ${commercialRegister ? `<div>السجل التجاري: ${escapeHtml(commercialRegister)}</div>` : ''}
         </div>`
      : '';

  return `<header class="lh" style="border-bottom:1px solid #e5e7eb;padding-bottom:8px;margin-bottom:12px;">
    <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:16px;">
      <div style="display:flex;align-items:flex-start;gap:16px;min-width:0;flex:1;">
        ${logoBlock}
        <div style="min-width:0;">
          ${companyName ? `<div style="font-size:20px;font-weight:800;color:#0f172a;">${escapeHtml(companyName)}</div>` : ''}
          ${slogan ? `<div style="font-size:14px;font-weight:700;color:#475569;margin-top:2px;">${escapeHtml(slogan)}</div>` : ''}
          <div style="font-size:11px;color:#475569;margin-top:8px;line-height:1.6;">
            ${address ? `<div>${escapeHtml(address)}</div>` : ''}
            <div style="display:flex;flex-wrap:wrap;gap:6px 12px;">
              ${phone ? `<span>هاتف: ${escapeHtml(phone)}</span>` : ''}
              ${email ? `<span>إيميل: ${escapeHtml(email)}</span>` : ''}
              ${website ? `<span>موقع: ${escapeHtml(website)}</span>` : ''}
            </div>
          </div>
        </div>
      </div>
      ${idBlock}
    </div>
  </header>`;
}

/** Standalone HTML for main-process print/PDF (inline letterhead; body is trusted app HTML). */
export function buildFullPrintHtmlDocument(
  settings: SystemSettings,
  bodyInnerHtml: string,
  opts: { orientation: 'portrait' | 'landscape'; marginsMm: PrintMarginsMm }
): string {
  const { orientation, marginsMm: m } = opts;
  const pageSizeDecl = orientation === 'landscape' ? 'A4 landscape' : 'A4 portrait';
  const letterhead = buildInlineLetterheadHtml(settings);

  return `<!DOCTYPE html>
<html dir="rtl" lang="ar">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>print</title>
<style>
  @page {
    size: ${pageSizeDecl};
    margin: ${m.top}mm ${m.right}mm ${m.bottom}mm ${m.left}mm;
  }
  * { box-sizing: border-box; }
  body { margin: 0; padding: 0; color: #0f172a; background: #fff; font-family: "Tajawal", system-ui, -apple-system, "Segoe UI", Arial, sans-serif; font-size: 12px; line-height: 1.6; }
  main.doc-body { overflow-wrap: anywhere; word-break: break-word; }
  main.doc-body table { border-collapse: collapse; width: 100%; }
  main.doc-body th, main.doc-body td { border: 1px solid #e5e7eb; padding: 6px 8px; vertical-align: top; }
</style>
</head>
<body>
${letterhead}
<main class="doc-body">${bodyInnerHtml}</main>
</body>
</html>`;
}
