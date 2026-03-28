
const bar = (extra: string) =>
  `rounded-lg bg-slate-200/90 dark:bg-slate-700/80 ${extra}`;

export type SkeletonCardVariant = 'listing' | 'kpi';

export type SkeletonCardProps = {
  className?: string;
  /** listing: بطاقات قوائم (أشخاص، عقود، …) — kpi: بطاقات مؤشرات لوحة التحكم */
  variant?: SkeletonCardVariant;
};

/**
 * هيكل تحميل موحّد لبطاقات القوائم ولوحة KPI.
 * لا يعتمد على اتجاه الصفحة (LTR/RTL) لأن التخطيط مرن ومتمركز نسبياً.
 */
export function SkeletonCard({ className = '', variant = 'listing' }: SkeletonCardProps) {
  if (variant === 'kpi') {
    return (
      <div
        className={`app-card flex min-h-[112px] flex-col gap-3 overflow-hidden p-5 animate-pulse ${className}`}
        aria-hidden
      >
        <div className={bar('h-3 w-24')} />
        <div className={bar('h-9 w-32')} />
        <div className={bar('h-3 max-w-[180px] w-full')} />
      </div>
    );
  }

  return (
    <div className={`app-card flex flex-col overflow-hidden animate-pulse ${className}`} aria-hidden>
      <div className="h-1 w-full bg-slate-300/60 dark:bg-slate-600/50" />
      <div className="flex flex-1 flex-col gap-4 p-5">
        <div className="flex items-start gap-3">
          <div className="h-12 w-12 shrink-0 rounded-2xl bg-slate-200 dark:bg-slate-700" />
          <div className="min-w-0 flex-1 space-y-2">
            <div className={bar('h-4 max-w-[200px] w-4/5')} />
            <div className={bar('h-3 max-w-[140px] w-3/5 opacity-80')} />
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <div className={bar('h-6 w-16')} />
          <div className={bar('h-6 w-20 opacity-90')} />
          <div className={bar('h-6 w-14 opacity-90')} />
        </div>
        <div className="space-y-2 rounded-xl border border-slate-200/50 p-3 dark:border-slate-800/80">
          <div className={bar('h-3 w-full')} />
          <div className={bar('h-3 w-[88%] opacity-90')} />
        </div>
        <div className="mt-auto flex gap-2 pt-2">
          <div className={bar('h-9 min-w-0 flex-1 rounded-xl')} />
          <div className={bar('h-9 w-9 shrink-0 rounded-xl')} />
          <div className={bar('h-9 w-9 shrink-0 rounded-xl')} />
        </div>
      </div>
    </div>
  );
}

export type SkeletonCardGridProps = {
  count?: number;
  variant?: SkeletonCardVariant;
  className?: string;
  /** يضاف على حاوية الشبكة (مثلاً أعمدة مخصصة) */
  gridClassName?: string;
};

export function SkeletonCardGrid({
  count = 6,
  variant = 'listing',
  className = '',
  gridClassName = '',
}: SkeletonCardGridProps) {
  const defaultGrid =
    variant === 'kpi'
      ? 'grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4'
      : 'grid grid-cols-1 gap-4 sm:grid-cols-[repeat(auto-fit,minmax(360px,1fr))]';

  return (
    <div
      role="status"
      aria-busy="true"
      aria-live="polite"
      className={`${defaultGrid} ${gridClassName} ${className}`.trim()}
    >
      {Array.from({ length: count }, (_, i) => (
        <SkeletonCard key={i} variant={variant} />
      ))}
    </div>
  );
}
