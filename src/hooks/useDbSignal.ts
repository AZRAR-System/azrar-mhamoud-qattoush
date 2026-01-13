import { useEffect, useState } from 'react';

/**
 * Returns a monotonically increasing number whenever local db_* data changes.
 * Designed to be used as a dependency to refresh page-level data loaders.
 */
export const useDbSignal = (): number => {
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const bump = () => setTick((t) => t + 1);

    const onStorage = (e: StorageEvent) => {
      if (!e.key) return;
      if (String(e.key).startsWith('db_')) bump();
    };

    const onDbChanged = () => bump();

    window.addEventListener('focus', bump);
    window.addEventListener('storage', onStorage);
    window.addEventListener('azrar:db-changed', onDbChanged as EventListener);

    return () => {
      window.removeEventListener('focus', bump);
      window.removeEventListener('storage', onStorage);
      window.removeEventListener('azrar:db-changed', onDbChanged as EventListener);
    };
  }, []);

  return tick;
};
