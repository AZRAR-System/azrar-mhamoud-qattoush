import {
  normalizeArabicLetters,
  normalizeSearchText,
  normalizeSearchTextStrict,
  normalizeSearchTextLenient,
  normalizeDigitsLoose,
} from '@/utils/searchNormalize';

describe('normalizeArabicLetters', () => {
  test('strict mode - normalizes آأإ to ا', () => {
    expect(normalizeArabicLetters('آأإ')).toBe('اaa'.slice(0,3).replace(/a/g,'ا'));
  });
  test('strict mode - normalizes ى to ي', () => {
    expect(normalizeArabicLetters('علىى')).toContain('ي');
  });
  test('lenient mode - normalizes ة to ه', () => {
    expect(normalizeArabicLetters('مدرسة', 'lenient')).toContain('ه');
  });
  test('lenient mode - removes ء', () => {
    expect(normalizeArabicLetters('سماء', 'lenient')).not.toContain('ء');
  });
  test('lenient mode - normalizes ئ to ي', () => {
    expect(normalizeArabicLetters('شائع', 'lenient')).not.toContain('ئ');
  });
  test('lenient mode - normalizes ؤ to و', () => {
    expect(normalizeArabicLetters('يؤدي', 'lenient')).not.toContain('ؤ');
  });
});

describe('normalizeSearchText', () => {
  test('removes tashkeel', () => {
    expect(normalizeSearchText('مُحَمَّد')).toBe('محمد');
  });
  test('removes tatweel', () => {
    expect(normalizeSearchText('جمـيل')).toBe('جميل');
  });
  test('converts to lowercase', () => {
    expect(normalizeSearchText('Hello')).toBe('hello');
  });
  test('collapses whitespace', () => {
    expect(normalizeSearchText('  أحمد   علي  ')).toBe('احمد علي');
  });
  test('handles null/undefined', () => {
    expect(normalizeSearchText(null)).toBe('');
    expect(normalizeSearchText(undefined)).toBe('');
  });
  test('lenient mode', () => {
    const r = normalizeSearchText('مدرسة', 'lenient');
    expect(r).toContain('ه');
  });
});

describe('normalizeSearchTextStrict', () => {
  test('strict normalization', () => {
    expect(normalizeSearchTextStrict('آحمد')).toBe('احمد');
  });
});

describe('normalizeSearchTextLenient', () => {
  test('lenient normalization removes ة', () => {
    expect(normalizeSearchTextLenient('طالبة')).not.toContain('ة');
  });
});

describe('normalizeDigitsLoose', () => {
  test('keeps digits only', () => {
    expect(normalizeDigitsLoose('07-91 234 567')).toBe('0791234567');
  });
  test('converts Arabic digits', () => {
    expect(normalizeDigitsLoose('٠٧٩١')).toBe('0791');
  });
  test('handles empty', () => {
    expect(normalizeDigitsLoose('')).toBe('');
  });
});
