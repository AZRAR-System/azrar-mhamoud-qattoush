import { normalizeDigitsToLatin } from '@/utils/numberInput';

type ToLocaleStringFn = (this: unknown, ...args: unknown[]) => string;

const wrapToLocaleString = (orig: ToLocaleStringFn): ToLocaleStringFn => {
  return function wrapped(this: unknown, ...args: unknown[]) {
    const out = orig.apply(this, args);
    return normalizeDigitsToLatin(out);
  };
};

const wrapStringReturn = (orig: (...args: unknown[]) => unknown) => {
  return (...args: unknown[]) => {
    const out = orig(...args);
    return typeof out === 'string' ? normalizeDigitsToLatin(out) : out;
  };
};

const patchIntlFormatters = (): void => {
  if (typeof Intl === 'undefined') return;
  const g = globalThis as unknown as Record<string, unknown>;

  try {
    if (g.__AZRAR_ORIG_INTL_NUMBERFORMAT__) return;

    const OrigNumberFormat = Intl.NumberFormat as Intl.NumberFormatConstructor;
    g.__AZRAR_ORIG_INTL_NUMBERFORMAT__ = OrigNumberFormat;

    const WrappedNumberFormat = function (this: unknown, ...args: unknown[]) {
      // Support call-without-new behavior.
      const inst = new OrigNumberFormat(
        ...(args as [Intl.LocalesArgument | undefined, Intl.NumberFormatOptions | undefined])
      );

      try {
        if (typeof inst.format === 'function') {
          inst.format = wrapStringReturn(inst.format.bind(inst)) as unknown as typeof inst.format;
        }
        {
          const instObj = inst as unknown as Record<string, unknown>;
          const fr = instObj['formatRange'];
          if (typeof fr === 'function') {
            instObj['formatRange'] = wrapStringReturn((fr as (...args: unknown[]) => unknown).bind(inst));
          }
        }
        if (typeof inst.formatToParts === 'function') {
          const orig = inst.formatToParts.bind(inst);
          inst.formatToParts = ((...a: Parameters<typeof inst.formatToParts>) => {
            const parts = orig(...a);
            return parts.map((p: Intl.NumberFormatPart) => ({
              ...p,
              value: normalizeDigitsToLatin(p.value),
            }));
          }) as typeof inst.formatToParts;
        }
        {
          const instObj = inst as unknown as Record<string, unknown>;
          const frtp = instObj['formatRangeToParts'];
          if (typeof frtp === 'function') {
            instObj['formatRangeToParts'] = ((...a: unknown[]) => {
              const parts = (frtp as (...b: unknown[]) => unknown)(...a);
              if (!Array.isArray(parts)) return parts;
              return (parts as Intl.NumberFormatPart[]).map((p) => ({
                ...p,
                value: normalizeDigitsToLatin(p.value),
              }));
            }) as unknown;
          }
        }
      } catch {
        // ignore
      }

      return inst;
    } as unknown as typeof Intl.NumberFormat;

    // Preserve prototype and static helpers
    (WrappedNumberFormat as unknown as { prototype: Intl.NumberFormat }).prototype = OrigNumberFormat.prototype as unknown as Intl.NumberFormat;
    (WrappedNumberFormat as unknown as { supportedLocalesOf?: Intl.NumberFormatConstructor['supportedLocalesOf'] }).supportedLocalesOf =
      OrigNumberFormat.supportedLocalesOf.bind(OrigNumberFormat);
    Object.setPrototypeOf(WrappedNumberFormat, OrigNumberFormat);

    (Intl as unknown as { NumberFormat: Intl.NumberFormatConstructor }).NumberFormat = WrappedNumberFormat;
  } catch {
    // ignore
  }

  try {
    if (g.__AZRAR_ORIG_INTL_DATETIMEFORMAT__) return;

    const OrigDateTimeFormat = Intl.DateTimeFormat as Intl.DateTimeFormatConstructor;
    g.__AZRAR_ORIG_INTL_DATETIMEFORMAT__ = OrigDateTimeFormat;

    const WrappedDateTimeFormat = function (this: unknown, ...args: unknown[]) {
      const inst = new OrigDateTimeFormat(
        ...(args as [Intl.LocalesArgument | undefined, Intl.DateTimeFormatOptions | undefined])
      );

      try {
        if (typeof inst.format === 'function') {
          inst.format = wrapStringReturn(inst.format.bind(inst)) as unknown as typeof inst.format;
        }
        {
          const instObj = inst as unknown as Record<string, unknown>;
          const fr = instObj['formatRange'];
          if (typeof fr === 'function') {
            instObj['formatRange'] = wrapStringReturn((fr as (...args: unknown[]) => unknown).bind(inst));
          }
        }
        if (typeof inst.formatToParts === 'function') {
          const orig = inst.formatToParts.bind(inst);
          inst.formatToParts = ((...a: Parameters<typeof inst.formatToParts>) => {
            const parts = orig(...a);
            return parts.map((p: Intl.DateTimeFormatPart) => ({
              ...p,
              value: normalizeDigitsToLatin(p.value),
            }));
          }) as typeof inst.formatToParts;
        }
        {
          const instObj = inst as unknown as Record<string, unknown>;
          const frtp = instObj['formatRangeToParts'];
          if (typeof frtp === 'function') {
            instObj['formatRangeToParts'] = ((...a: unknown[]) => {
              const parts = (frtp as (...b: unknown[]) => unknown)(...a);
              if (!Array.isArray(parts)) return parts;
              return (parts as Intl.DateTimeFormatPart[]).map((p) => ({
                ...p,
                value: normalizeDigitsToLatin(p.value),
              }));
            }) as unknown;
          }
        }
      } catch {
        // ignore
      }

      return inst;
    } as unknown as typeof Intl.DateTimeFormat;

    (WrappedDateTimeFormat as unknown as { prototype: Intl.DateTimeFormat }).prototype = OrigDateTimeFormat.prototype as unknown as Intl.DateTimeFormat;
    (WrappedDateTimeFormat as unknown as { supportedLocalesOf?: Intl.DateTimeFormatConstructor['supportedLocalesOf'] }).supportedLocalesOf =
      OrigDateTimeFormat.supportedLocalesOf.bind(OrigDateTimeFormat);
    Object.setPrototypeOf(WrappedDateTimeFormat, OrigDateTimeFormat);

    (Intl as unknown as { DateTimeFormat: Intl.DateTimeFormatConstructor }).DateTimeFormat = WrappedDateTimeFormat;
  } catch {
    // ignore
  }
};

/**
 * Ensures all `.toLocaleString()` / `.toLocaleDateString()` / `.toLocaleTimeString()`
 * outputs use Latin digits (0-9), regardless of OS/browser locale.
 *
 * This is a lightweight runtime patch used to satisfy the “English numerals” requirement
 * across the app without rewriting every call site.
 */
export const installEnglishNumeralsPolyfill = (): void => {
  const g = globalThis as unknown as Record<string, unknown>;
  if (g.__AZRAR_ENGLISH_NUMERALS_INSTALLED__ === true) return;
  g.__AZRAR_ENGLISH_NUMERALS_INSTALLED__ = true;

  patchIntlFormatters();

  try {
    const origNum = Number.prototype.toLocaleString as unknown as ToLocaleStringFn;
    if (typeof origNum === 'function') {
      Number.prototype.toLocaleString = wrapToLocaleString(origNum) as unknown as typeof Number.prototype.toLocaleString;
    }
  } catch {
    // ignore
  }

  try {
    const origDate = Date.prototype.toLocaleString as unknown as ToLocaleStringFn;
    if (typeof origDate === 'function') {
      Date.prototype.toLocaleString = wrapToLocaleString(origDate) as unknown as typeof Date.prototype.toLocaleString;
    }
  } catch {
    // ignore
  }

  try {
    const origDateOnly = Date.prototype.toLocaleDateString as unknown as ToLocaleStringFn;
    if (typeof origDateOnly === 'function') {
      Date.prototype.toLocaleDateString = wrapToLocaleString(origDateOnly) as unknown as typeof Date.prototype.toLocaleDateString;
    }
  } catch {
    // ignore
  }

  try {
    const origTimeOnly = Date.prototype.toLocaleTimeString as unknown as ToLocaleStringFn;
    if (typeof origTimeOnly === 'function') {
      Date.prototype.toLocaleTimeString = wrapToLocaleString(origTimeOnly) as unknown as typeof Date.prototype.toLocaleTimeString;
    }
  } catch {
    // ignore
  }
};
