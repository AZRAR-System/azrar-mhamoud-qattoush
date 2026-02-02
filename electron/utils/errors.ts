export const toErrorMessage = (err: unknown, fallback: string): string => {
  if (err instanceof Error) return err.message || fallback;
  const s = String(err ?? '').trim();
  return s || fallback;
};
