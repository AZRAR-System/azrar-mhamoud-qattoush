import { normalizeDigitsToLatin } from '@/utils/numberInput';

const ARABIC_DIACRITICS_RE = /[\u064B-\u065F\u0670]/g; // tashkeel + superscript alef
const TATWEEL_RE = /\u0640/g;

export type SearchNormalizeMode = 'strict' | 'lenient';

export function normalizeArabicLetters(input: string, mode: SearchNormalizeMode = 'strict'): string {
  const base = String(input || '')
    .replace(/[\u0622\u0623\u0625]/g, 'ا') // آأإ -> ا
    .replace(/\u0671/g, 'ا') // ٱ -> ا
    .replace(/\u0649/g, 'ي'); // ى -> ي

  if (mode === 'strict') return base;

  // Lenient mode: more aggressive matching (may increase false positives).
  return base
    .replace(/\u0626/g, 'ي') // ئ -> ي
    .replace(/\u0624/g, 'و') // ؤ -> و
    .replace(/\u0629/g, 'ه') // ة -> ه
    .replace(/\u0621/g, ''); // ء -> ''
}

export function normalizeSearchText(input: unknown, mode: SearchNormalizeMode = 'strict'): string {
  const s = normalizeDigitsToLatin(String(input ?? ''));
  return normalizeArabicLetters(s, mode)
    .replace(ARABIC_DIACRITICS_RE, '')
    .replace(TATWEEL_RE, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

export const normalizeSearchTextStrict = (input: unknown): string => normalizeSearchText(input, 'strict');
export const normalizeSearchTextLenient = (input: unknown): string => normalizeSearchText(input, 'lenient');

export function normalizeDigitsLoose(input: unknown): string {
  const s = normalizeDigitsToLatin(String(input ?? ''));
  return s.replace(/\D+/g, '').trim();
}
