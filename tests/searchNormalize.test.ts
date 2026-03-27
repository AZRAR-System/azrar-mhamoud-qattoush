import {
  normalizeSearchTextStrict,
  normalizeSearchTextLenient,
  normalizeDigitsLoose,
} from '@/utils/searchNormalize';

describe('searchNormalize (strict/lenient)', () => {
  test('strict normalizes alef variants and alif wasla + yaa maksura', () => {
    expect(normalizeSearchTextStrict('أحمد')).toBe('احمد');
    expect(normalizeSearchTextStrict('إيمان')).toBe('ايمان');
    expect(normalizeSearchTextStrict('آدم')).toBe('ادم');
    expect(normalizeSearchTextStrict('ٱحمد')).toBe('احمد');
    expect(normalizeSearchTextStrict('على')).toBe('علي');
  });

  test('strict keeps ة/ه distinct (no over-matching)', () => {
    expect(normalizeSearchTextStrict('فاطمة')).toBe('فاطمة');
    expect(normalizeSearchTextStrict('فاطمه')).toBe('فاطمه');
    expect(normalizeSearchTextStrict('فاطمة')).not.toBe(normalizeSearchTextStrict('فاطمه'));
  });

  test('lenient folds ة->ه and removes hamza', () => {
    expect(normalizeSearchTextLenient('فاطمة')).toBe('فاطمه');
    // Note: 'مسؤول' contains both ؤ and an existing و, so folding ؤ->و produces 'مسوول'.
    expect(normalizeSearchTextLenient('مسؤول')).toBe('مسوول');
    // 'مسئول' contains ئ which folds to ي.
    expect(normalizeSearchTextLenient('مسئول')).toBe('مسيول');
  });

  test('digits normalization supports Arabic/Persian digits and separators', () => {
    expect(normalizeDigitsLoose('٠١٢-٣٤٥')).toBe('012345');
    expect(normalizeDigitsLoose('۰۱۲۳۴۵')).toBe('012345');
    expect(normalizeDigitsLoose('+964 (0770) 123 4567')).toBe('96407701234567');
  });
});
