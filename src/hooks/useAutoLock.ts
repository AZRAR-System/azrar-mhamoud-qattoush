import { useEffect, useRef } from 'react';

/**
 * يستدعي onLock بعد دقائق خمول متواصلة (بدون إعادة تعيين عند كل حدث).
 * عندما يكون enabled=false أو minutes<=0 لا يُفعّل المؤقت.
 */
export function useAutoLock(enabled: boolean, minutes: number, onLock: () => void): void {
  const onLockRef = useRef(onLock);
  onLockRef.current = onLock;

  useEffect(() => {
    if (!enabled || minutes <= 0) return;

    const ms = minutes * 60 * 1000;
    let t: number | undefined;

    const schedule = () => {
      if (t !== undefined) window.clearTimeout(t);
      t = window.setTimeout(() => onLockRef.current(), ms);
    };

    const reset = () => schedule();
    const events: (keyof WindowEventMap)[] = [
      'mousemove',
      'keydown',
      'scroll',
      'click',
      'touchstart',
    ];
    events.forEach((e) => window.addEventListener(e, reset, { passive: true }));
    schedule();

    return () => {
      if (t !== undefined) window.clearTimeout(t);
      events.forEach((e) => window.removeEventListener(e, reset));
    };
  }, [enabled, minutes]);
}
