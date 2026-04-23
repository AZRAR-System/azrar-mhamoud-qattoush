import { openExternalUrl } from '@/utils/externalLink';

describe('External Link Utility - URL Safety Suite', () => {
  let openSpy: jest.SpyInstance;

  beforeEach(() => {
    // Mock window.open
    openSpy = jest.spyOn(window, 'open').mockImplementation(() => ({ opener: {} } as Window));
  });

  afterEach(() => {
    openSpy.mockRestore();
  });

  test('openExternalUrl - opens valid https link', () => {
    openExternalUrl('https://google.com');
    expect(openSpy).toHaveBeenCalledWith(
      'https://google.com/',
      '_blank',
      'noopener,noreferrer'
    );
  });

  test('openExternalUrl - blocks dangerous protocols', () => {
    const res = openExternalUrl('javascript:alert(1)');
    expect(res).toBeNull();
    expect(openSpy).not.toHaveBeenCalled();
  });

  test('openExternalUrl - allows mailto and tel', () => {
    openExternalUrl('mailto:test@example.com');
    expect(openSpy).toHaveBeenCalledWith('mailto:test@example.com', '_blank', expect.any(String));
    
    openExternalUrl('tel:+962791234567');
    expect(openSpy).toHaveBeenCalledWith('tel:+962791234567', '_blank', expect.any(String));
  });

  test('openExternalUrl - respects target and features', () => {
    openExternalUrl('https://example.com', { target: 'myWin', features: 'width=500' });
    expect(openSpy).toHaveBeenCalledWith(
      'https://example.com/',
      'myWin',
      'noopener,noreferrer,width=500'
    );
  });

  test('openExternalUrl - returns null for empty or invalid URL', () => {
    expect(openExternalUrl('')).toBeNull();
    expect(openExternalUrl('not-a-url')).toBeNull();
  });
});
