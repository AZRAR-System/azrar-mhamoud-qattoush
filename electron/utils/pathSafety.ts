import path from 'node:path';

export const ensureInsideRoot = (root: string, target: string): void => {
  const rootResolved = path.resolve(root);
  const targetResolved = path.resolve(target);
  const rel = path.relative(rootResolved, targetResolved);

  if (!rel || rel === '.') return;
  if (rel.startsWith('..') || path.isAbsolute(rel)) {
    throw new Error('Invalid attachment path');
  }
};
