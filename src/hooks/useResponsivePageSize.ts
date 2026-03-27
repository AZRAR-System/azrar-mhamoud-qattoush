import { useEffect, useMemo, useState } from 'react';

export type ResponsivePageSizeMap = {
  base: number;
  sm?: number;
  md?: number;
  lg?: number;
  xl?: number;
  '2xl'?: number;
};

const QUERIES: Array<{ key: keyof ResponsivePageSizeMap; query: string }> = [
  { key: '2xl', query: '(min-width: 1536px)' },
  { key: 'xl', query: '(min-width: 1280px)' },
  { key: 'lg', query: '(min-width: 1024px)' },
  { key: 'md', query: '(min-width: 768px)' },
  { key: 'sm', query: '(min-width: 640px)' },
];

type MediaQueryListLegacy = MediaQueryList & {
  addListener?: (listener: (event: MediaQueryListEvent) => void) => void;
  removeListener?: (listener: (event: MediaQueryListEvent) => void) => void;
};

function computePageSize(map: ResponsivePageSizeMap): number {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    return map.base;
  }

  for (const { key, query } of QUERIES) {
    const value = map[key];
    if (typeof value === 'number' && value > 0 && window.matchMedia(query).matches) {
      return value;
    }
  }

  return map.base;
}

/**
 * Returns a responsive page-size number based on Tailwind-ish breakpoints.
 *
 * - base applies to < sm
 * - sm/md/lg/xl/2xl apply when the min-width matches
 */
export function useResponsivePageSize(map: ResponsivePageSizeMap): number {
  const base = map.base;
  const sm = map.sm;
  const md = map.md;
  const lg = map.lg;
  const xl = map.xl;
  const x2l = map['2xl'];

  const stableMap = useMemo<ResponsivePageSizeMap>(
    () => ({ base, sm, md, lg, xl, ['2xl']: x2l }),
    [base, sm, md, lg, xl, x2l]
  );

  const [pageSize, setPageSize] = useState<number>(() => computePageSize(stableMap));

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return;

    const mqls = QUERIES.map(({ query }) => window.matchMedia(query));

    const update = (_event?: MediaQueryListEvent) => {
      setPageSize((prev) => {
        const next = computePageSize(stableMap);
        return prev === next ? prev : next;
      });
    };

    // Init
    update();

    for (const mql of mqls) {
      const legacy = mql as MediaQueryListLegacy;
      if (typeof mql.addEventListener === 'function') mql.addEventListener('change', update);
      else if (typeof legacy.addListener === 'function') legacy.addListener(update);
    }

    return () => {
      for (const mql of mqls) {
        const legacy = mql as MediaQueryListLegacy;
        if (typeof mql.removeEventListener === 'function')
          mql.removeEventListener('change', update);
        else if (typeof legacy.removeListener === 'function') legacy.removeListener(update);
      }
    };
  }, [stableMap]);

  return pageSize;
}
