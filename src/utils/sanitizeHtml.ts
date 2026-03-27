import DOMPurify from 'dompurify';

let hooksInstalled = false;

function isSchemeRelativeUrl(raw: string): boolean {
  return /^\s*\/\//.test(raw);
}

function isRelativeOrAnchorUrl(raw: string): boolean {
  const s = String(raw || '');
  // Allow anchor and typical relative URLs, but not scheme-relative (//example.com).
  return (
    (/^\s*#/.test(s) ||
      /^\s*\//.test(s) ||
      /^\s*\.\.?\//.test(s) ||
      /^\s*[^:\s?#]+([?#]|$)/.test(s)) &&
    !isSchemeRelativeUrl(s)
  );
}

function hasKnownScheme(raw: string): boolean {
  return /^\s*[a-z][a-z0-9+.-]*:/i.test(String(raw || ''));
}

function isAllowedHref(href: string): boolean {
  const s = String(href || '').trim();
  if (!s) return false;
  if (isSchemeRelativeUrl(s)) return false;
  if (isRelativeOrAnchorUrl(s)) return true;
  if (!hasKnownScheme(s)) return false;
  return /^\s*(https?:|mailto:|tel:|whatsapp:)/i.test(s);
}

function isAllowedSrc(src: string): boolean {
  const s = String(src || '').trim();
  if (!s) return false;
  if (isSchemeRelativeUrl(s)) return false;
  if (/^\s*data:image\//i.test(s)) return true;
  if (/^\s*blob:/i.test(s)) return true;
  if (isRelativeOrAnchorUrl(s)) return true;
  if (!hasKnownScheme(s)) return false;
  return /^\s*https?:/i.test(s);
}

function ensureHooksInstalled() {
  if (hooksInstalled) return;
  hooksInstalled = true;

  DOMPurify.addHook('afterSanitizeAttributes', (node) => {
    if (!(node instanceof Element)) return;

    const href = node.getAttribute('href');
    if (href && !isAllowedHref(href)) node.removeAttribute('href');

    const src = node.getAttribute('src');
    if (src && !isAllowedSrc(src)) node.removeAttribute('src');

    if (node.tagName === 'A') {
      // Only force new-tab for clearly external links.
      const href2 = node.getAttribute('href') || '';
      if (/^\s*(https?:|mailto:|tel:|whatsapp:)/i.test(href2)) {
        node.setAttribute('target', '_blank');
        node.setAttribute('rel', 'noopener noreferrer');
      }
    }
  });
}

export function sanitizeDocxHtml(dirtyHtml: string): string {
  ensureHooksInstalled();

  return DOMPurify.sanitize(String(dirtyHtml || ''), {
    USE_PROFILES: { html: true },
    // Strip high-risk tags that aren't needed for DOCX viewing.
    FORBID_TAGS: [
      'script',
      'style',
      'iframe',
      'object',
      'embed',
      'link',
      'meta',
      'base',
      'form',
      'input',
      'button',
      'textarea',
      'select',
      'option',
    ],
    // Remove inline styles to reduce attack surface (CSS URLs, etc.).
    FORBID_ATTR: ['style', 'srcset'],
  });
}
