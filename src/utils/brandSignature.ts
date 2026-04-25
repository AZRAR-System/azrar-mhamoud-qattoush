export const BRAND_SIGNATURE_BASE_YEAR = 2026;
export const BRAND_SIGNATURE_BASE_YEARS = 16;

export function getBrandYears(now: Date = new Date()): number {
  const year = now.getFullYear();
  const years = BRAND_SIGNATURE_BASE_YEARS + (year - BRAND_SIGNATURE_BASE_YEAR);
  return Math.max(BRAND_SIGNATURE_BASE_YEARS, years);
}

export function getOfficialBrandSignature(now: Date = new Date()): string {
  const years = getBrandYears(now);
  return `أزرار للخدمات العقارية – ${years} سنة تفوّق وثقة\nلأن الثقة لا تُشترى… تُبنى.`;
}

function stripKnownBrandLinesFromEnd(message: string): string {
  const normalized = String(message ?? '').replace(/\r\n/g, '\n');
  const lines = normalized.split('\n');

  const isBrandLine = (line: string): boolean => {
    const t = line.trim();
    if (!t) return true;

    if (/^صادر\s+عن\s+(أزرار|خبرني)\s+للخدمات\s+العقارية/.test(t)) return true;
    if (/^(أزرار|خبرني)\s+للخدمات\s+العقارية/.test(t)) return true;

    // Other legacy sign-offs we want to replace with the official signature.
    if (/^(?:إدارة|ادارة)\s+(?:الأملاك|الاملاك)/.test(t)) return true;

    // Old/alternative slogans that were used previously.
    if (/^\d+\s*سنة\s+تفوّق\s+وسيطر(?:ة|ه)/.test(t)) return true;
    if (/^\d+\s*سنة\s+تفوّق\s+وثقة/.test(t)) return true;

    if (/^لأن\s+الثقة\s+لا\s+تُشترى/.test(t)) return true;

    return false;
  };

  // Remove trailing empty lines and any trailing brand signature block.
  let removed = 0;
  while (lines.length > 0 && removed < 10 && isBrandLine(lines[lines.length - 1] || '')) {
    lines.pop();
    removed++;
  }

  // Trim trailing empty lines again.
  while (lines.length > 0 && String(lines[lines.length - 1] || '').trim() === '') {
    lines.pop();
  }

  return lines.join('\n');
}

export function applyOfficialBrandSignature(message: string, now: Date = new Date()): string {
  const normalized = String(message ?? '').replace(/\r\n/g, '\n');
  if (normalized.trim().length === 0) return normalized;

  const signature = getOfficialBrandSignature(now);
  const cleaned = stripKnownBrandLinesFromEnd(normalized).trimEnd();

  if (cleaned.endsWith(signature)) return cleaned;

  return `${cleaned}\n\n${signature}`;
}
