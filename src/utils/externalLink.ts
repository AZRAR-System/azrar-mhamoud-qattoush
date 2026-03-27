export type OpenExternalUrlOptions = {
  /** Window target. Default: '_blank'. */
  target?: string;

  /** Extra window.open features; `noopener,noreferrer` is always enforced. */
  features?: string;

  /** Allow relative URLs (resolved against current origin). Default: false. */
  allowRelative?: boolean;

  /** Allowed protocols (with trailing colon). Default: http/https/mailto/tel/whatsapp. */
  allowedProtocols?: string[];
};

const DEFAULT_ALLOWED_PROTOCOLS = ['http:', 'https:', 'mailto:', 'tel:', 'whatsapp:'];

function normalizeFeatures(extra?: string): string {
  const base = 'noopener,noreferrer';
  const raw = String(extra || '').trim();
  if (!raw) return base;
  const combined = `${base},${raw}`;
  // Deduplicate + normalize spacing
  const uniq = Array.from(
    new Set(
      combined
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean)
    )
  );
  return uniq.join(',');
}

function isAllowedProtocol(protocol: string, allowed: string[]): boolean {
  const p = String(protocol || '').toLowerCase();
  return allowed.map((x) => String(x).toLowerCase()).includes(p);
}

/**
 * Safely opens an external URL in a new window/tab.
 * - Enforces `noopener,noreferrer`
 * - Blocks dangerous protocols (e.g. `javascript:`, `data:`, `file:`)
 */
export function openExternalUrl(url: string, options?: OpenExternalUrlOptions): Window | null {
  const raw = String(url || '').trim();
  if (!raw) return null;

  const allowedProtocols = options?.allowedProtocols ?? DEFAULT_ALLOWED_PROTOCOLS;

  let parsed: URL;
  try {
    if (options?.allowRelative) {
      parsed = new URL(raw, window.location.href);
    } else {
      parsed = new URL(raw);
    }
  } catch {
    return null;
  }

  if (!isAllowedProtocol(parsed.protocol, allowedProtocols)) return null;

  const target = String(options?.target || '_blank');
  const features = normalizeFeatures(options?.features);

  const win = window.open(parsed.toString(), target, features);
  try {
    if (win) win.opener = null;
  } catch {
    // ignore
  }
  return win;
}

/**
 * Opens a blank window safely (used for printing or controlled rendering).
 */
export function openSafeBlankWindow(
  options?: Omit<OpenExternalUrlOptions, 'allowRelative'>
): Window | null {
  const target = String(options?.target || '_blank');
  const features = normalizeFeatures(options?.features);
  const win = window.open('about:blank', target, features);
  try {
    if (win) win.opener = null;
  } catch {
    // ignore
  }
  return win;
}
