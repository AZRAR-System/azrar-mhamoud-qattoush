import { describe, it, expect, jest } from '@jest/globals';
import { 
  normalizeWhatsAppPhone, 
  buildWhatsAppLink, 
  collectWhatsAppPhones, 
  buildWhatsAppLinks 
} from '@/utils/whatsapp';

// Mock dependency
jest.mock('@/utils/externalLink', () => ({
  openExternalUrl: jest.fn(),
}));

describe('WhatsApp Utils', () => {
  describe('normalizeWhatsAppPhone', () => {
    it('strips international 00 prefix by default', () => {
      expect(normalizeWhatsAppPhone('00962791111111')).toBe('962791111111');
    });

    it('prepends default country code to local numbers (leading 0)', () => {
      expect(normalizeWhatsAppPhone('0791111111', { defaultCountryCode: '962' })).toBe('962791111111');
    });

    it('correctly handles Jordan mobile format starts with 7 (9 digits)', () => {
      // 791111111 -> 962791111111
      expect(normalizeWhatsAppPhone('791111111', { defaultCountryCode: '962' })).toBe('962791111111');
    });

    it('returns empty string for invalid input', () => {
      expect(normalizeWhatsAppPhone('abc')).toBe('');
      expect(normalizeWhatsAppPhone('')).toBe('');
    });
  });

  describe('buildWhatsAppLink', () => {
    it('generates a web link by default', () => {
      const link = buildWhatsAppLink('Hello', '962791111111');
      expect(link).toContain('https://api.whatsapp.com/send');
      expect(link).toContain('phone=962791111111');
      expect(link).toContain('text=Hello');
    });

    it('generates a desktop deep link if target is desktop', () => {
      const link = buildWhatsAppLink('Hello', '962791111111', { target: 'desktop' });
      expect(link).toContain('whatsapp://send');
    });
  });

  describe('collectWhatsAppPhones', () => {
    it('uniquifies and filters phones', () => {
      const phones = ['0791111111', '0791111111', 'invalid', null, '0792222222'];
      const result = collectWhatsAppPhones(phones, { defaultCountryCode: '962' });
      expect(result).toHaveLength(2);
      expect(result).toContain('962791111111');
      expect(result).toContain('962792222222');
    });
  });

  describe('buildWhatsAppLinks', () => {
    it('generates multiple links for a list of phones', () => {
      const phones = ['0791111111', '0792222222'];
      const links = buildWhatsAppLinks('Test Msg', phones, { defaultCountryCode: '962' });
      expect(links).toHaveLength(2);
      expect(links[0]).toContain('phone=962791111111');
      expect(links[1]).toContain('phone=962792222222');
    });
  });
});
