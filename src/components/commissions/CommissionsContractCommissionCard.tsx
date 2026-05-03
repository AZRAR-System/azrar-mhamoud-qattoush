import type { FC } from 'react';
import { Briefcase, CornerDownRight, Pencil, RefreshCw, ShieldCheck, Trash2, Users } from 'lucide-react';
import type { العمولات_tbl } from '@/types';
import { formatContractNumberShort } from '@/utils/contractNumber';
import { formatCurrencyJOD } from '@/utils/format';
import { commissionPartiesOfficeTotal } from '@/utils/employeeCommission';
import { cn } from '@/utils/cn';

export type CommissionsContractCardVariant = 'default' | 'renewal';

export interface CommissionsContractCommissionCardProps {
  c: العمولات_tbl;
  variant: CommissionsContractCardVariant;
  /** عند variant=renewal: معرف العقد السابق للعرض */
  parentContractId?: string;
  getPropCode: (comm: العمولات_tbl) => string;
  getNames: (comm: العمولات_tbl) => { p1: string; p2: string; p3: string };
  onEdit: () => void;
  onPostpone: () => void;
  onDelete: () => void;
}

export const CommissionsContractCommissionCard: FC<CommissionsContractCommissionCardProps> = ({
  c,
  variant,
  parentContractId,
  getPropCode,
  getNames,
  onEdit,
  onPostpone,
  onDelete,
}) => {
  const isSale = c.نوع_العمولة === 'Sale';
  const ref = isSale ? c.رقم_الاتفاقية : c.رقم_العقد;
  const names = getNames(c);
  const partiesTotal = commissionPartiesOfficeTotal(c);
  const introEmployee =
    c.يوجد_ادخال_عقار
      ? Math.max(0, Number(c.عمولة_إدخال_عقار || 0)) || partiesTotal * 0.05
      : 0;

  return (
    <article
      className={cn(
        'rounded-xl border p-4 transition-shadow sm:p-5',
        variant === 'renewal'
          ? 'border-indigo-200/90 bg-gradient-to-br from-white to-indigo-50/40 shadow-sm dark:border-indigo-800/50 dark:from-slate-900 dark:to-indigo-950/30'
          : 'border-slate-200/90 bg-white shadow-sm dark:border-slate-700/80 dark:bg-slate-900/50'
      )}
    >
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0 flex-1 space-y-3">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5">
            {variant === 'renewal' ? (
              <span className="inline-flex items-center gap-1 rounded-lg bg-indigo-600 px-2 py-0.5 text-[10px] font-black uppercase tracking-wide text-white">
                <RefreshCw size={11} aria-hidden />
                تجديد
              </span>
            ) : null}
            <span className="text-sm font-black text-slate-800 dark:text-slate-100">
              {isSale ? 'عمولة بيع' : 'عمولة إيجار'}
            </span>
            <span className="font-mono text-xs font-bold text-slate-500 dark:text-slate-400" dir="ltr">
              #{formatContractNumberShort(ref)}
            </span>
            <span className="text-slate-400">·</span>
            <span className="text-xs text-slate-600 dark:text-slate-400">
              عقار:{' '}
              <b className="text-slate-800 dark:text-slate-200">{getPropCode(c)}</b>
            </span>
            {variant === 'renewal' && parentContractId ? (
              <>
                <span className="text-slate-400">·</span>
                <span className="text-xs text-slate-600 dark:text-slate-400">
                  العقد السابق:{' '}
                  <b className="font-mono text-slate-800 dark:text-slate-200" dir="ltr">
                    #{formatContractNumberShort(parentContractId)}
                  </b>
                </span>
              </>
            ) : null}
          </div>

          <dl className="grid grid-cols-1 gap-2 text-xs sm:grid-cols-2">
            <div className="flex gap-2 rounded-lg bg-slate-50 px-3 py-2 dark:bg-slate-800/60">
              <dt className="shrink-0 font-bold text-slate-500 dark:text-slate-400">تاريخ العملية</dt>
              <dd className="min-w-0 font-bold text-slate-800 dark:text-slate-100">{c.تاريخ_العقد}</dd>
            </div>
            <div className="flex gap-2 rounded-lg bg-slate-50 px-3 py-2 dark:bg-slate-800/60">
              <dt className="shrink-0 font-bold text-slate-500 dark:text-slate-400">رقم الفرصة</dt>
              <dd className="min-w-0 font-mono font-bold text-slate-800 dark:text-slate-100" dir="ltr">
                {String(c.رقم_الفرصة || '—')}
              </dd>
            </div>
          </dl>

          <div className="rounded-xl border border-slate-100 bg-slate-50/80 p-3 dark:border-slate-800 dark:bg-slate-950/40">
            <p className="mb-2 text-[10px] font-black uppercase tracking-wider text-slate-400">الأطراف</p>
            <div className="flex flex-wrap gap-4">
              <div className="flex min-w-[10rem] items-center gap-2">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-indigo-100 text-indigo-600 dark:bg-indigo-900/40 dark:text-indigo-300">
                  <Briefcase size={16} aria-hidden />
                </div>
                <div>
                  <div className="text-[10px] font-bold text-slate-400">{isSale ? 'البائع' : 'المالك'}</div>
                  <div className="text-sm font-bold text-slate-800 dark:text-slate-100">{names.p1}</div>
                </div>
              </div>
              <div className="flex min-w-[10rem] items-center gap-2">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-emerald-600 dark:bg-emerald-900/40 dark:text-emerald-300">
                  <Users size={16} aria-hidden />
                </div>
                <div>
                  <div className="text-[10px] font-bold text-slate-400">{isSale ? 'المشتري' : 'المستأجر'}</div>
                  <div className="text-sm font-bold text-slate-800 dark:text-slate-100">{names.p2}</div>
                </div>
              </div>
              {!isSale && names.p3 ? (
                <div className="flex min-w-[10rem] items-center gap-2">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300">
                    <ShieldCheck size={16} aria-hidden />
                  </div>
                  <div>
                    <div className="text-[10px] font-bold text-slate-400">الكفيل</div>
                    <div className="text-sm font-bold text-slate-800 dark:text-slate-100">{names.p3}</div>
                  </div>
                </div>
              ) : null}
            </div>
          </div>

          {String(c.تاريخ_تحصيل_مؤجل || '').trim() ? (
            <p className="text-xs text-slate-500 dark:text-slate-400">
              <span className="font-bold text-slate-600 dark:text-slate-300">تحصيل مؤجل:</span>{' '}
              {String(c.تاريخ_تحصيل_مؤجل)}
              {String(c.جهة_تحصيل_مؤجل || '').trim() ? (
                <span className="text-slate-400"> ({String(c.جهة_تحصيل_مؤجل)})</span>
              ) : null}
            </p>
          ) : null}
        </div>

        <div className="flex shrink-0 flex-col gap-2 border-t border-slate-100 pt-3 sm:flex-row sm:border-t-0 sm:pt-0 lg:flex-col lg:border-s lg:border-slate-100 lg:ps-4 dark:border-slate-800">
          <button
            type="button"
            onClick={onEdit}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-slate-100 px-3 py-2 text-xs font-black text-slate-700 transition hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
          >
            <Pencil size={14} aria-hidden /> تعديل
          </button>
          <button
            type="button"
            onClick={onPostpone}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-indigo-50 px-3 py-2 text-xs font-black text-indigo-700 transition hover:bg-indigo-100 dark:bg-indigo-900/25 dark:text-indigo-200 dark:hover:bg-indigo-900/40"
          >
            <CornerDownRight size={14} aria-hidden /> تأجيل التحصيل
          </button>
          <button
            type="button"
            onClick={onDelete}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-rose-50 px-3 py-2 text-xs font-black text-rose-600 transition hover:bg-rose-100 dark:bg-rose-950/40 dark:text-rose-400 dark:hover:bg-rose-950/60"
          >
            <Trash2 size={14} aria-hidden /> حذف
          </button>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-3 border-t border-slate-100 pt-4 dark:border-slate-800 sm:grid-cols-3">
        <div className="rounded-xl border border-slate-100 bg-slate-50/90 px-3 py-2.5 dark:border-slate-800 dark:bg-slate-800/50">
          <div className="text-[10px] font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">
            {isSale ? 'عمولة البائع' : 'عمولة المالك'}
          </div>
          <div className="mt-0.5 text-lg font-black tabular-nums text-slate-900 dark:text-white">
            {formatCurrencyJOD(Number((isSale ? c.عمولة_البائع : c.عمولة_المالك) || 0))}
          </div>
        </div>
        <div className="rounded-xl border border-slate-100 bg-slate-50/90 px-3 py-2.5 dark:border-slate-800 dark:bg-slate-800/50">
          <div className="text-[10px] font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">
            {isSale ? 'عمولة المشتري' : 'عمولة المستأجر'}
          </div>
          <div className="mt-0.5 text-lg font-black tabular-nums text-slate-900 dark:text-white">
            {formatCurrencyJOD(Number((isSale ? c.عمولة_المشتري : c.عمولة_المستأجر) || 0))}
          </div>
        </div>
        <div className="rounded-xl border border-indigo-100 bg-indigo-50/90 px-3 py-2.5 dark:border-indigo-900/40 dark:bg-indigo-950/40">
          <div className="text-[10px] font-bold uppercase tracking-wide text-indigo-600 dark:text-indigo-300">
            مجموع طرفي العقد
          </div>
          <div className="mt-0.5 text-lg font-black tabular-nums text-indigo-800 dark:text-indigo-200">
            {formatCurrencyJOD(partiesTotal)}
          </div>
          {c.يوجد_ادخال_عقار ? (
            <div className="mt-1 text-[10px] font-bold text-indigo-600/90 dark:text-indigo-300/90">
              إدخال عقار (5% للموظف فقط): {formatCurrencyJOD(introEmployee)}
            </div>
          ) : null}
        </div>
      </div>
    </article>
  );
};
