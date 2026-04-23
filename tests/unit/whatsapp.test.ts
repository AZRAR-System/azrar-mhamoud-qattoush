import { 
  normalizeWhatsAppPhone, 
  buildWhatsAppLink, 
  collectWhatsAppPhones,
  buildWhatsAppLinks
} from '@/utils/whatsapp';

describe('WhatsApp Utility - Link Generation Suite', () => {
  describe('normalizeWhatsAppPhone', () => {
    test('removes non-digits and leading 00', () => {
      expect(normalizeWhatsAppPhone('00962791234567')).toBe('962791234567');
      expect(normalizeWhatsAppPhone('+962 79 123 4567')).toBe('962791234567');
    });

    test('handles local Jordan format with defaultCountryCode', () => {
      const options = { defaultCountryCode: '962' };
      expect(normalizeWhatsAppPhone('0791234567', options)).toBe('962791234567');
      expect(normalizeWhatsAppPhone('791234567', options)).toBe('962791234567');
    });
  });

  describe('buildWhatsAppLink', () => {
    test('generates web link by default', () => {
      const link = buildWhatsAppLink('Hello', '962791234567');
      expect(link).toContain('https://api.whatsapp.com/send');
      expect(link).toContain('phone=962791234567');
      expect(link).toContain('text=Hello');
    });

    test('generates desktop link when requested', () => {
      const link = buildWhatsAppLink('Hello', '962791234567', { target: 'desktop' });
      expect(link).toContain('whatsapp://send');
    });
  });

  describe('Bulk Operations', () => {
    test('collectWhatsAppPhones - unique and normalized', () => {
      const raw = ['0791', '0791', '0792'];
      const collected = collectWhatsAppPhones(raw, { defaultCountryCode: '962' });
      expect(collected).toHaveLength(2);
      expect(collected).toContain('962791');
      expect(collected).toContain('962792');
    });

    test('buildWhatsAppLinks - returns array of links', () => {
      const links = buildWhatsAppLinks('Msg', ['0791', '0792'], { defaultCountryCode: '962' });
      expect(links).toHaveLength(2);
      expect(links[0]).toContain('phone=962791');
    });
  });
});
