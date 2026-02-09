export const resolveDesktopMessage = (res: unknown, fallback: string): string => {
  try {
    if (!res || typeof res !== 'object') return fallback;
    const rec = res as Record<string, unknown>;

    const message = typeof rec.message === 'string' ? rec.message.trim() : '';
    if (message) return message;

    const error = typeof rec.error === 'string' ? rec.error.trim() : '';
    if (error) return error;

    // Some desktop responses use { success, message }
    const msg2 = typeof rec['Message'] === 'string' ? String(rec['Message']).trim() : '';
    if (msg2) return msg2;

    return fallback;
  } catch {
    return fallback;
  }
};

export const resolveDesktopError = (error: unknown, fallback = ''): string => {
  if (!error) return fallback;
  if (error instanceof Error) return error.message || fallback;
  if (typeof error === 'string') return error;

  try {
    if (typeof error === 'object') {
      const rec = error as Record<string, unknown>;
      const message = typeof rec.message === 'string' ? rec.message.trim() : '';
      if (message) return message;
      const err = typeof rec.error === 'string' ? rec.error.trim() : '';
      if (err) return err;
    }
  } catch {
    // ignore
  }

  return fallback;
};
