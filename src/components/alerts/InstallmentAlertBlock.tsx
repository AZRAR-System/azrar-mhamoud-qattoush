import { useMemo } from 'react';
import type { tbl_Alerts, الكمبيالات_tbl, العقود_tbl, العقارات_tbl, الأشخاص_tbl } from '@/types';
import { DbService } from '@/services/mockDb';
import { getInstallmentPaidAndRemaining } from '@/utils/installments';
import { formatCurrencyJOD } from '@/utils/format';

export function alertHasInstallmentPreview(alert: tbl_Alerts | null): boolean {
  if (!alert || alert.category !== 'Financial') return false;
  if (alert.مرجع_الجدول !== 'الكمبيالات_tbl') return false;
  const mid = String(alert.مرجع_المعرف || '').trim();
  return Boolean(mid && mid !== 'batch');
}

export function InstallmentAlertBlock({ alert }: { alert: tbl_Alerts | null }) {
  const ctx = useMemo(() => {
    const a = alert;
    if (!a || a.category !== 'Financial') return null;
    if (a.مرجع_الجدول !== 'الكمبيالات_tbl') return null;
    const instId = String(a.مرجع_المعرف || '').trim();
    if (!instId || instId === 'batch') return null;

    const installments = (DbService.getInstallments?.() || []) as الكمبيالات_tbl[];
    const inst = installments.find((i) => String(i.رقم_الكمبيالة) === instId);
    if (!inst) return null;

    const contracts = (DbService.getContracts?.() || []) as العقود_tbl[];
    const contract = contracts.find((c) => String(c.رقم_العقد) === String(inst.رقم_العقد));

    const people = (DbService.getPeople?.() || []) as الأشخاص_tbl[];
    const tenant = contract
      ? people.find((p) => String(p.رقم_الشخص) === String(contract.رقم_المستاجر))
      : null;

    const properties = (DbService.getProperties?.() || []) as العقارات_tbl[];
    const property = contract
      ? properties.find((p) => String(p.رقم_العقار) === String(contract.رقم_العقار))
      : null;

    const { paid, remaining } = getInstallmentPaidAndRemaining(inst);

    return { inst, contract, tenant, property, paid, remaining, alert: a };
  }, [alert]);

  if (!ctx) return null;

  return (
    <div className="rounded-xl border border-slate-200/80 dark:border-slate-700/80 bg-white dark:bg-slate-900/70 p-4 text-sm shadow-sm ring-1 ring-slate-900/[0.03] dark:ring-white/[0.04] space-y-4">
      <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
        الدفعة والعقد
      </div>
      <dl className="grid grid-cols-1 gap-x-5 gap-y-3 text-slate-700 dark:text-slate-200 sm:grid-cols-2">
        <div className="flex flex-col gap-0.5">
          <dt className="text-[11px] font-medium text-slate-500 dark:text-slate-400">رقم الكمبيالة</dt>
          <dd className="font-semibold tabular-nums text-slate-900 dark:text-slate-50">{ctx.inst.رقم_الكمبيالة}</dd>
        </div>
        <div className="flex flex-col gap-0.5">
          <dt className="text-[11px] font-medium text-slate-500 dark:text-slate-400">رقم العقد</dt>
          <dd className="font-semibold tabular-nums text-slate-900 dark:text-slate-50">
            {ctx.contract?.رقم_العقد ?? '—'}
          </dd>
        </div>
        <div className="flex flex-col gap-0.5 sm:col-span-2">
          <dt className="text-[11px] font-medium text-slate-500 dark:text-slate-400">المستأجر</dt>
          <dd className="font-semibold text-slate-900 dark:text-slate-50">
            {ctx.tenant?.الاسم || ctx.alert.tenantName || '—'}
          </dd>
        </div>
        <div className="flex flex-col gap-0.5 sm:col-span-2">
          <dt className="text-[11px] font-medium text-slate-500 dark:text-slate-400">العقار</dt>
          <dd className="font-semibold text-slate-900 dark:text-slate-50">
            {ctx.property
              ? `${ctx.property.الكود_الداخلي || ctx.property.رقم_العقار}${
                  ctx.property.العنوان ? ` — ${ctx.property.العنوان}` : ''
                }`
              : ctx.alert.propertyCode || '—'}
          </dd>
        </div>
        <div className="flex flex-col gap-0.5">
          <dt className="text-[11px] font-medium text-slate-500 dark:text-slate-400">تاريخ الاستحقاق</dt>
          <dd className="font-semibold tabular-nums text-slate-900 dark:text-slate-50">{ctx.inst.تاريخ_استحقاق}</dd>
        </div>
        <div className="flex flex-col gap-0.5">
          <dt className="text-[11px] font-medium text-slate-500 dark:text-slate-400">حالة القسط</dt>
          <dd className="font-semibold text-slate-900 dark:text-slate-50">{ctx.inst.حالة_الكمبيالة || '—'}</dd>
        </div>
        <div className="flex flex-col gap-0.5">
          <dt className="text-[11px] font-medium text-slate-500 dark:text-slate-400">نوع الدفعة</dt>
          <dd className="font-semibold text-slate-900 dark:text-slate-50">{ctx.inst.نوع_الكمبيالة || '—'}</dd>
        </div>
        <div className="flex flex-col gap-0.5">
          <dt className="text-[11px] font-medium text-slate-500 dark:text-slate-400">قيمة القسط</dt>
          <dd className="font-semibold tabular-nums text-slate-900 dark:text-slate-50">
            {formatCurrencyJOD(ctx.inst.القيمة)}
          </dd>
        </div>
        <div className="flex flex-col gap-0.5">
          <dt className="text-[11px] font-medium text-slate-500 dark:text-slate-400">المسدّد / المتبقي</dt>
          <dd className="font-semibold tabular-nums text-slate-900 dark:text-slate-50">
            {formatCurrencyJOD(ctx.paid)} / {formatCurrencyJOD(ctx.remaining)}
          </dd>
        </div>
      </dl>
      <p className="border-t border-t-slate-100 pt-3 text-[11px] font-medium leading-relaxed text-slate-500 dark:border-t-slate-800 dark:text-slate-400">
        زر «التفاصيل الكاملة» يفتح منزلق تفاصيل العقد من دون مغادرة صفحة التنبيهات.
      </p>
    </div>
  );
}
