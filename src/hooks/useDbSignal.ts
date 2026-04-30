import { useEffect, useState } from 'react';

/**
 * Returns a monotonically increasing number whenever local db_* data changes.
 * Designed to be used as a dependency to refresh page-level data loaders.
 */
export const useDbSignal = (): number => {
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const bump = () => setTick((t) => t + 1);
    let focusTimer: number | null = null;
    let lastFocusBumpAt = 0;
    const scheduleFocusBump = () => {
      const now = Date.now();
      // Coalesce rapid focus events + avoid immediate heavy refresh loops on app refocus
      if (now - lastFocusBumpAt < 800) return;
      if (focusTimer) window.clearTimeout(focusTimer);
      focusTimer = window.setTimeout(() => {
        focusTimer = null;
        lastFocusBumpAt = Date.now();
        bump();
      }, 120);
    };

    const onStorage = (e: StorageEvent) => {
      if (!e.key) return;
      if (String(e.key).startsWith('db_')) bump();
    };

    const onDbChanged = () => bump();

    window.addEventListener('focus', scheduleFocusBump);
    window.addEventListener('storage', onStorage);
    window.addEventListener('azrar:db-changed', onDbChanged as EventListener);

    return () => {
      window.removeEventListener('focus', scheduleFocusBump);
      window.removeEventListener('storage', onStorage);
      window.removeEventListener('azrar:db-changed', onDbChanged as EventListener);
      if (focusTimer) window.clearTimeout(focusTimer);
    };
  }, []);

  return tick;
};
