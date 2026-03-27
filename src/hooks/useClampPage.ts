import { useEffect } from 'react';

export function useClampPage(opts: {
  enabled: boolean;
  page: number;
  pageCount: number;
  setPage: (next: number) => void;
}): void {
  const { enabled, page, pageCount, setPage } = opts;

  useEffect(() => {
    if (!enabled) return;
    const maxPage = Math.max(0, pageCount - 1);
    if (page > maxPage) setPage(maxPage);
  }, [enabled, page, pageCount, setPage]);
}

