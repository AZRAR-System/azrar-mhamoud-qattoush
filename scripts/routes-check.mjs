import fs from 'node:fs';
import path from 'node:path';

const projectRoot = process.cwd();
const read = (p) => fs.readFileSync(path.join(projectRoot, p), 'utf8');

const pathsFile = 'src/routes/paths.ts';
const registryFile = 'src/routes/registry.ts';
const appFile = 'src/App.tsx';

const extractRoutePaths = (src) => {
  // Matches: KEY: '/value'
  const re = /^\s*[A-Z0-9_]+\s*:\s*'([^']+)'\s*,?\s*$/gm;
  const out = new Set();
  let m;
  while ((m = re.exec(src))) {
    const v = m[1];
    if (v.startsWith('/')) out.add(v);
  }
  return out;
};

const extractNavLiteralPaths = (src) => {
  // Matches: path: '/something'
  const re = /\bpath\s*:\s*'([^']+)'/g;
  const out = new Set();
  let m;
  while ((m = re.exec(src))) {
    const v = m[1];
    if (v.startsWith('/')) out.add(v);
  }
  return out;
};

const extractNavRoutePathRefs = (src) => {
  // Matches: path: ROUTE_PATHS.SOMETHING
  const re = /\bpath\s*:\s*ROUTE_PATHS\.([A-Z0-9_]+)/g;
  const out = new Set();
  let m;
  while ((m = re.exec(src))) out.add(m[1]);
  return out;
};

const extractAppRoutePathRefs = (src) => {
  // Matches: case ROUTE_PATHS.SOMETHING:
  const re = /\bcase\s+ROUTE_PATHS\.([A-Z0-9_]+)\s*:/g;
  const out = new Set();
  let m;
  while ((m = re.exec(src))) out.add(m[1]);
  // Also catch equality checks: currentHash !== ROUTE_PATHS.LOGIN
  const re2 = /\bROUTE_PATHS\.([A-Z0-9_]+)/g;
  while ((m = re2.exec(src))) out.add(m[1]);
  return out;
};

const extractTitleRoutePathRefs = (src) => {
  // Matches: titles[ROUTE_PATHS.SOMETHING] = '...'
  const re = /\btitles\s*\[\s*ROUTE_PATHS\.([A-Z0-9_]+)\s*\]\s*=\s*['"]/g;
  const out = new Set();
  let m;
  while ((m = re.exec(src))) out.add(m[1]);
  return out;
};

const main = () => {
  const srcPaths = read(pathsFile);
  const srcRegistry = read(registryFile);
  const srcApp = read(appFile);

  const routePaths = extractRoutePaths(srcPaths);
  const navLiterals = extractNavLiteralPaths(srcRegistry);

  const navRefs = extractNavRoutePathRefs(srcRegistry);
  const appRefs = extractAppRoutePathRefs(srcApp);
  const titleRefs = extractTitleRoutePathRefs(srcRegistry);

  const errors = [];

  // 1) No literal nav paths outside ROUTE_PATHS (excluding # anchors)
  if (navLiterals.size > 0) {
    errors.push(
      `NAV_ITEMS contains hard-coded literal paths: ${Array.from(navLiterals).join(', ')}`
    );
  }

  // 2) All ROUTE_PATHS used in registry/app should exist in ROUTE_PATHS definition
  const definedKeys = new Set();
  const keyRe = /^\s*([A-Z0-9_]+)\s*:\s*'[^']+'\s*,?\s*$/gm;
  let km;
  while ((km = keyRe.exec(srcPaths))) definedKeys.add(km[1]);

  for (const k of navRefs) {
    if (!definedKeys.has(k)) errors.push(`NAV_ITEMS references missing ROUTE_PATHS.${k}`);
  }
  for (const k of appRefs) {
    if (!definedKeys.has(k)) errors.push(`App references missing ROUTE_PATHS.${k}`);
  }

  // 3) Every ROUTE_PATHS.* must have a title guaranteed:
  // - either it appears in NAV_ITEMS (so ROUTE_TITLES derives it),
  // - or it has an explicit titles[ROUTE_PATHS.X] assignment.
  for (const k of definedKeys) {
    const coveredByNav = navRefs.has(k);
    const coveredExplicitly = titleRefs.has(k);
    if (!coveredByNav && !coveredExplicitly) {
      errors.push(`Missing ROUTE_TITLES coverage for ROUTE_PATHS.${k} (not in NAV_ITEMS and no explicit title)`);
    }
  }

  // 4) All ROUTE_PATHS values should look like routes
  for (const p of routePaths) {
    if (!p.startsWith('/')) errors.push(`Invalid route path (expected to start with '/'): ${p}`);
  }

  if (errors.length) {
    console.error('\n[routes:check] FAILED');
    for (const e of errors) console.error(' - ' + e);
    process.exit(1);
  }

  console.log(
    `[routes:check] OK (paths: ${routePaths.size}, nav refs: ${navRefs.size}, app refs: ${appRefs.size}, title refs: ${titleRefs.size})`
  );
};

main();
