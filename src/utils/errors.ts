type HasMessage = { message: string };

export function hasMessage(value: unknown): value is HasMessage {
  if (typeof value !== 'object' || value === null) return false;
  return typeof (value as Record<string, unknown>).message === 'string';
}

export function getErrorMessage(error: unknown): string | undefined {
  if (error instanceof Error) return error.message;
  if (typeof error === 'string') return error;
  if (hasMessage(error)) return error.message;
  return undefined;
}
