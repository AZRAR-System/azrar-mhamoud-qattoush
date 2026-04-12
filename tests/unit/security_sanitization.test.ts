import { describe, test, expect } from '@jest/globals';
import { sanitizeDocxHtml } from '@/utils/sanitizeHtml';

describe('Security Sanitization', () => {
  test('sanitizeDocxHtml strips dangerous tags', () => {
    const dirty = '<div><script>alert(1)</script><iframe src="malicious.com"></iframe><p>Safe content</p></div>';
    const clean = sanitizeDocxHtml(dirty);
    expect(clean).not.toContain('<script>');
    expect(clean).not.toContain('<iframe>');
    expect(clean).toContain('<p>Safe content</p>');
  });

  test('sanitizeDocxHtml handles links correctly', () => {
    const dirty = '<a href="https://google.com">Search</a><a href="javascript:alert(1)">XSS</a>';
    const clean = sanitizeDocxHtml(dirty);
    expect(clean).toContain('target="_blank"');
    expect(clean).toContain('rel="noopener noreferrer"');
    expect(clean).toContain('href="https://google.com"');
    expect(clean).not.toContain('href="javascript:alert(1)"');
  });

  test('sanitizeDocxHtml allows mailto and tel links', () => {
    const dirty = '<a href="mailto:test@example.com">Email</a><a href="tel:+123">Call</a>';
    const clean = sanitizeDocxHtml(dirty);
    expect(clean).toContain('href="mailto:test@example.com"');
    expect(clean).toContain('href="tel:+123"');
  });

  test('sanitizeDocxHtml allows image data and blob urls', () => {
    const dirty = '<img src="data:image/png;base64,123"><img src="blob:http://localhost/123">';
    const clean = sanitizeDocxHtml(dirty);
    expect(clean).toContain('src="data:image/png;base64,123"');
    expect(clean).toContain('src="blob:http://localhost/123"');
  });
  
  test('sanitizeDocxHtml handles empty or null input', () => {
    expect(sanitizeDocxHtml('')).toBe('');
    // @ts-ignore
    expect(sanitizeDocxHtml(null)).toBe('');
  });
});
