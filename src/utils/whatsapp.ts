import { applyOfficialBrandSignature } from '@/utils/brandSignature';
import { openExternalUrl } from '@/utils/externalLink';

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null;

const hasUnknownProp = <K extends string>(
  obj: Record<string, unknown>,
  key: K
): obj is Record<string, unknown> & Record<K, unknown> =>
  Object.prototype.hasOwnProperty.call(obj, key);

export type WhatsAppLinkOptions = {
  /**
   * If true, will remove a leading "00" international prefix (e.g. 00962...).
   * Defaults to true.
   */
  stripInternationalPrefix00?: boolean;

  /**
   * Country code to auto-prepend for *local-format* numbers only (e.g. 07xxxxxxxx).
   * If omitted, no country code will be added.
   */
  defaultCountryCode?: string;

  /**
   * Link target:
   * - 'web': always generate https://api.whatsapp.com/send
   * - 'desktop': generate whatsapp://send deep link (WhatsApp Desktop)
   * - 'auto': desktop when running in Electron, otherwise web
   *
   * Default: 'web' (to preserve browser behavior).
   */
  target?: 'web' | 'desktop' | 'auto';
};

export type WhatsAppMultiOpenOptions = WhatsAppLinkOptions & {
  /** Delay between opening multiple numbers (ms). Default: 10 seconds. */
  delayMs?: number;
};

const isDesktopEnv = (): boolean => {
  if (typeof window === 'undefined') return false;
  const w: unknown = window;
  if (!isRecord(w)) return false;
  if (!hasUnknownProp(w, 'desktopDb')) return false;
  return Boolean(w.desktopDb);
};

export function normalizeWhatsAppPhone(phone: string, options?: WhatsAppLinkOptions): string {
  const strip00 = options?.stripInternationalPrefix00 ?? true;
  const defaultCountryCode = String(options?.defaultCountryCode || '').trim();
  let digits = String(phone || '')
    .trim()
    .replace(/\D/g, '');
  if (!digits) return '';

  // Handle international dialing prefix (e.g. 00962...) without guessing a country code.
  if (strip00 && digits.startsWith('00')) digits = digits.slice(2);

  // If caller provided a default country code and the number is already international with it, keep.
  if (defaultCountryCode && digits.startsWith(defaultCountryCode)) return digits;

  // Smart local -> international (only when it looks local)
  // Examples (Jordan):
  // - 07xxxxxxxx  => 9627xxxxxxxx
  // - 7xxxxxxxx   => 9627xxxxxxxx
  // For other already-international numbers (e.g. 971..., 20...), we keep as-is.
  if (defaultCountryCode) {
    if (digits.startsWith('0')) {
      const withoutLeadingZeros = digits.replace(/^0+/, '');
      if (!withoutLeadingZeros) return '';
      if (withoutLeadingZeros.startsWith(defaultCountryCode)) return withoutLeadingZeros;
      return `${defaultCountryCode}${withoutLeadingZeros}`;
    }

    // For numbers that don't start with 0 and aren't already international:
    // If the number length matches a typical local mobile length (7-10 digits), prepend country code.
    // This covers most countries where local numbers are dialed without a trunk prefix.
    if (digits.length >= 7 && digits.length <= 10) {
      return `${defaultCountryCode}${digits}`;
    }
  }

  return digits;
}

export function buildWhatsAppLink(
  message: string,
  phoneNumber: string,
  options?: WhatsAppLinkOptions
): string {
  const normalized = normalizeWhatsAppPhone(phoneNumber, options);
  if (!normalized) return '';

  const raw = String(message ?? '');
  const text = raw.trim().length > 0 ? applyOfficialBrandSignature(raw) : raw;

  const target = options?.target ?? 'web';
  const effectiveTarget = target === 'auto' ? (isDesktopEnv() ? 'desktop' : 'web') : target;

  if (effectiveTarget === 'desktop') {
    try {
      const url = new URL('whatsapp://send');
      url.searchParams.set('phone', normalized);
      if (text) url.searchParams.set('text', text);
      return url.toString();
    } catch {
      const encodedMessage = encodeURIComponent(text);
      return `whatsapp://send?phone=${normalized}&text=${encodedMessage}`;
    }
  }

  // NOTE:
  // Some environments can show emoji as mojibake (e.g. "ðŸ…") if the query encoding
  // is not interpreted as UTF-8 end-to-end. Using URLSearchParams produces standard
  // application/x-www-form-urlencoded encoding (UTF-8) which WhatsApp handles reliably.
  try {
    const url = new URL('https://api.whatsapp.com/send');
    url.searchParams.set('phone', normalized);
    url.searchParams.set('text', text);
    url.searchParams.set('type', 'phone_number');
    url.searchParams.set('app_absent', '0');
    return url.toString();
  } catch {
    const encodedMessage = encodeURIComponent(text);
    return `https://api.whatsapp.com/send?phone=${normalized}&text=${encodedMessage}`;
  }
}

export function collectWhatsAppPhones(
  phones: Array<string | null | undefined>,
  options?: WhatsAppLinkOptions
): string[] {
  const uniq = new Set<string>();
  for (const p of phones) {
    const normalized = normalizeWhatsAppPhone(String(p ?? ''), options);
    if (!normalized) continue;
    uniq.add(normalized);
  }
  return Array.from(uniq);
}

export function buildWhatsAppLinks(
  message: string,
  phones: Array<string | null | undefined>,
  options?: WhatsAppLinkOptions
): string[] {
  const list = collectWhatsAppPhones(phones, options);
  return list.map((p) =>
    buildWhatsAppLink(message, p, { ...options, defaultCountryCode: undefined })
  );
}

export async function openWhatsAppForPhones(
  message: string,
  phones: Array<string | null | undefined>,
  options?: WhatsAppMultiOpenOptions
): Promise<void> {
  const delayMs = options?.delayMs ?? 10_000;
  const normalizedPhones = collectWhatsAppPhones(phones, options);
  const target = options?.target ?? (isDesktopEnv() ? 'desktop' : 'web');
  const links = normalizedPhones.map((p) =>
    buildWhatsAppLink(message, p, { ...options, target, defaultCountryCode: undefined })
  );

  for (let i = 0; i < links.length; i++) {
    const link = links[i];
    if (!link) continue;
    openExternalUrl(link);
    if (i < links.length - 1 && delayMs > 0) {
      await new Promise((r) => setTimeout(r, delayMs));
    }
  }
}
