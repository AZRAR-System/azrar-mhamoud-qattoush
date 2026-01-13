import { ROUTE_PATHS } from './paths';
import { NAV_ITEMS, ROUTE_TITLES, type NavItem } from './registry';

const collectNavPaths = (items: NavItem[]): string[] => {
  const out: string[] = [];
  const walk = (item: NavItem) => {
    if (typeof item.path === 'string' && item.path.startsWith('/')) out.push(item.path);
    item.children?.forEach(walk);
  };
  items.forEach(walk);
  return out;
};

/**
 * Dev-only consistency checks to prevent route drift.
 * Safe to call multiple times.
 */
export const validateRoutes = (): void => {
  const routeValues = new Set<string>(
    (Object.values(ROUTE_PATHS) as unknown[])
      .map(v => String(v))
      .filter(p => p.startsWith('/'))
  );

  const navPaths = collectNavPaths(NAV_ITEMS);

  for (const p of navPaths) {
    if (!routeValues.has(p)) {
      // eslint-disable-next-line no-console
      console.warn(`[routes] NAV path not in ROUTE_PATHS: ${p}`);
    }
  }

  for (const p of routeValues) {
    if (!ROUTE_TITLES[p]) {
      // eslint-disable-next-line no-console
      console.warn(`[routes] Missing ROUTE_TITLES entry for: ${p}`);
    }
  }
};
