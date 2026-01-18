import React from 'react';
import { Button } from '@/components/ui/Button';

type PaginationControlsProps = {
  page: number;
  pageCount: number;
  onPageChange: (nextPage: number) => void;
  className?: string;
  showIfSingle?: boolean;
  size?: 'sm' | 'md';
};

export const PaginationControls: React.FC<PaginationControlsProps> = ({
  page,
  pageCount,
  onPageChange,
  className,
  showIfSingle = false,
  size = 'sm',
}) => {
  const safePageCount = Number.isFinite(pageCount) ? Math.max(1, Math.floor(pageCount)) : 1;
  const safePage = Number.isFinite(page) ? Math.min(Math.max(1, Math.floor(page)), safePageCount) : 1;

  if (!showIfSingle && safePageCount <= 1) return null;

  const canPrev = safePage > 1;
  const canNext = safePage < safePageCount;

  return (
    <div className={className || 'flex items-center justify-between gap-2'}>
      <Button size={size} variant="secondary" onClick={() => onPageChange(safePage - 1)} disabled={!canPrev}>
        السابق
      </Button>

      <div className="text-xs text-slate-600 dark:text-slate-400 font-mono" dir="ltr">
        {safePage} / {safePageCount}
      </div>

      <Button size={size} variant="secondary" onClick={() => onPageChange(safePage + 1)} disabled={!canNext}>
        التالي
      </Button>
    </div>
  );
};
