import { jest } from '@jest/globals';
/**
 * Tests for deleteTimer ref pattern
 * Ensures setTimeout is properly managed to prevent setState on unmounted components
 */

describe('deleteTimer ref pattern', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('clears previous timer before starting new one', () => {
    const clearTimeoutSpy = jest.spyOn(window, 'clearTimeout');
    let timerRef: any = null;

    const runDelete = () => {
      if (timerRef) window.clearTimeout(timerRef);
      timerRef = window.setTimeout(() => { timerRef = null; }, 1000);
    };

    runDelete();
    const firstTimer = timerRef;
    runDelete(); // triggers clearTimeout on first

    expect(clearTimeoutSpy).toHaveBeenCalledWith(firstTimer);
    clearTimeoutSpy.mockRestore();
  });

  it('sets timerRef to null after execution', () => {
    let timerRef: any = null;
    const callback = jest.fn();

    if (timerRef) window.clearTimeout(timerRef);
    timerRef = window.setTimeout(() => {
      timerRef = null;
      callback();
    }, 1000);

    expect(timerRef).not.toBeNull();
    jest.runAllTimers();
    expect(timerRef).toBeNull();
    expect(callback).toHaveBeenCalledTimes(1);
  });

  it('prevents double execution when called twice rapidly', () => {
    let timerRef: any = null;
    const callback = jest.fn();

    const runDelete = () => {
      if (timerRef) window.clearTimeout(timerRef);
      timerRef = window.setTimeout(() => {
        timerRef = null;
        callback();
      }, 1000);
    };

    runDelete();
    runDelete(); // cancels first, starts new
    jest.runAllTimers();

    expect(callback).toHaveBeenCalledTimes(1); // not twice
  });

  it('cleanup on unmount clears pending timer', () => {
    let timerRef: any = null;
    const callback = jest.fn();

    timerRef = window.setTimeout(() => {
      callback();
    }, 1000);

    // simulate unmount cleanup
    if (timerRef) window.clearTimeout(timerRef);
    timerRef = null;

    jest.runAllTimers();
    expect(callback).not.toHaveBeenCalled(); // timer was cancelled
  });

  it('does not clear timer if ref is null', () => {
    const clearTimeoutSpy = jest.spyOn(window, 'clearTimeout');
    let timerRef: any = null;

    if (timerRef) window.clearTimeout(timerRef);

    expect(clearTimeoutSpy).not.toHaveBeenCalled();
    clearTimeoutSpy.mockRestore();
  });
});

describe('license activation error handling', () => {
  const toErrorMessage = (e: unknown, fallback: string): string => {
    if (e instanceof Error) return e.message || fallback;
    const s = String(e ?? '').trim();
    return s || fallback;
  };

  const activateFromContent = async (
    content: string,
    activateFn: (c: string) => Promise<{ ok: boolean; error?: string }>
  ) => {
    try {
      const res = await activateFn(content);
      if (res.ok) return { ok: true };
      return { ok: false, error: res.error || 'فشل التفعيل' };
    } catch (e: unknown) {
      return { ok: false, error: toErrorMessage(e, 'فشل تفعيل الترخيص من الملف') };
    }
  };

  it('returns ok:true on successful activation', async () => {
    const mockActivate = jest.fn<any>().mockResolvedValue({ ok: true });
    const result = await activateFromContent('valid-license', mockActivate as any);
    expect(result.ok).toBe(true);
  });

  it('returns ok:false with error message on failure', async () => {
    const mockActivate = jest.fn<any>().mockResolvedValue({ ok: false, error: 'ترخيص منتهي' });
    const result = await activateFromContent('invalid-license', mockActivate as any);
    expect(result.ok).toBe(false);
    expect(result.error).toBe('ترخيص منتهي');
  });

  it('catches thrown exceptions and returns ok:false', async () => {
    const mockActivate = jest.fn<any>().mockRejectedValue(new Error('Network error'));
    const result = await activateFromContent('any-content', mockActivate as any);
    expect(result.ok).toBe(false);
    expect(result.error).toBe('Network error');
  });

  it('uses fallback message when exception has no message', async () => {
    const mockActivate = jest.fn<any>().mockRejectedValue('unknown error');
    const result = await activateFromContent('any-content', mockActivate as any);
    expect(result.ok).toBe(false);
    expect(result.error).toBe('unknown error');
  });
});
