import { useEffect, type DependencyList } from 'react';

export function useResetPageToZero(
  enabled: boolean,
  setPage: (next: number) => void,
  deps: DependencyList
): void {
  useEffect(() => {
    if (!enabled) return;
    setPage(0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, setPage, ...deps]);
}

