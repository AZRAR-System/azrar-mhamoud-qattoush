import React, { useEffect, useMemo, useState } from 'react';
import { CheckCircle, Clock, AlertTriangle, Send, X, Users, Phone } from 'lucide-react';
import { DbService, PaymentNotificationTarget } from '@/services/mockDb';
import { formatDateOnly, parseDateOnly, toDateOnly, daysBetweenDateOnly } from '@/utils/dateOnly';
import { notificationService } from '@/services/notificationService';
import { openWhatsAppForPhones } from '@/utils/whatsapp';
import { NotificationTemplates } from '@/services/notificationTemplates';
import { paymentNotificationTargetsSmart } from '@/services/domainQueries';

interface PaymentNotificationsPanelProps {
  onClose: () => void;
  daysAhead?: number;
}

const buildWhatsAppMessage = (t: PaymentNotificationTarget) => {
  const isDesktop = typeof window !== 'undefined' && !!window.desktopDb;

  // Desktop fast mode can provide payment plan/frequency in the target payload to avoid scanning contracts.
  let paymentPlanRaw = String((t as any)?.paymentPlanRaw || '').trim();
  let freq = Number((t as any)?.paymentFrequency ?? 0) || 0;
  if (!isDesktop && (!paymentPlanRaw || !freq)) {
    const contract = DbService.getContracts().find(c => c.رقم_العقد === t.contractId);
    paymentPlanRaw = paymentPlanRaw || String(contract?.طريقة_الدفع || '').trim();
    freq = freq || Number(contract?.تكرار_الدفع || 0);
  }

  const paymentPlanLabel =
    paymentPlanRaw === 'Prepaid'
      ? 'دفع مسبق'
      : paymentPlanRaw === 'Postpaid'
        ? 'دفع لاحق'
        : paymentPlanRaw === 'DownPayment_Monthly'
          ? 'دفعة أولى + شهري'
          : (paymentPlanRaw || '—');

  const freqLabel =
    freq === 12 ? 'شهري' :
      freq === 6 ? 'كل شهرين' :
        freq === 4 ? 'ربع سنوي' :
          freq === 2 ? 'نصف سنوي' :
            freq === 1 ? 'سنوي' :
              (freq > 0 ? `${freq} دفعة/سنة` : '—');

  const paymentInstructions = `طرق الدفع:
عبر خدمة CliQ (كليك)
الاسم المستعار: KHABERNI
البنك: بنك الاتحاد

بعد التحويل يرجى إرسال:
1- اسم المرسل
2- سبب التحويل (إيجار / عربون)
3- صورة إيصال الدفع

على الأرقام التالية:
0799090170 | 0799090171
`;

  const total = t.items.reduce((sum, x) => sum + (x.amountRemaining || 0), 0);

  const lines = t.items
    .slice()
    .sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime())
    .map(x => {
      const badge = `خلال ${x.daysUntilDue} يوم`;
      // Use English digits in WhatsApp messages (do not auto-localize to Arabic-Indic)
      return `• ${Number(x.amountRemaining || 0).toLocaleString('en-US')} د.أ — ${x.dueDate} (${badge})`;
    })
    .join('\n');

  const fixed = NotificationTemplates.getById('installment_reminder_upcoming_summary_fixed');
  if (fixed && fixed.enabled) {
    const base = NotificationTemplates.fill(fixed, {
      اسم_المستأجر: t.tenantName,
      جزء_العقار: t.propertyCode ? ` للعقار (${t.propertyCode})` : '',
      المستحقات_القريبة: lines,
      الإجمالي: Number(total || 0).toLocaleString('en-US'),
    });

    const hasPayInfo = base.includes('طريقة الدفع');
    const extra = `\n\nبيانات الدفع:\n• نظام الدفع بالعقد: ${paymentPlanLabel}\n• تكرار الدفع: ${freqLabel}\n\n${paymentInstructions}`;
    return hasPayInfo ? base : `${base}${extra}`;
  }

  // Fallback (legacy): keep old format if template is missing/disabled
  const header = `مرحباً ${t.tenantName}،\nتذكير قبل الاستحقاق${t.propertyCode ? ` للعقار (${t.propertyCode})` : ''}.`;
  const base = `${header}\n\nالمستحقات القريبة:\n${lines}\n\nالإجمالي: ${Number(total || 0).toLocaleString('en-US')} د.أ\nشكراً لكم.`;
  const extra = `\n\nبيانات الدفع:\n• نظام الدفع بالعقد: ${paymentPlanLabel}\n• تكرار الدفع: ${freqLabel}\n\n${paymentInstructions}`;
  return base.includes('طريقة الدفع') ? base : `${base}${extra}`;
};

export const PaymentNotificationsPanel: React.FC<PaymentNotificationsPanelProps> = ({ onClose, daysAhead = 7 }) => {
  const [targets, setTargets] = useState<PaymentNotificationTarget[]>([]);
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [isSending, setIsSending] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const isDesktop = typeof window !== 'undefined' && !!window.desktopDb;
      if (isDesktop) {
        const fast = await paymentNotificationTargetsSmart({ daysAhead });
        if (!cancelled && fast) {
          setTargets(fast as any);
          const initial: Record<string, boolean> = {};
          for (const item of fast) initial[item.key] = true;
          setSelected(initial);
          return;
        }

        // Desktop focus: do not fall back to legacy renderer-side full-array scans.
        if (!cancelled) {
          setTargets([]);
          setSelected({});
        }
        return;
      }

      const t = DbService.getPaymentNotificationTargets(daysAhead);
      if (cancelled) return;
      setTargets(t);
      const initial: Record<string, boolean> = {};
      for (const item of t) initial[item.key] = true;
      setSelected(initial);
    })();

    return () => {
      cancelled = true;
    };
  }, [daysAhead]);

  const sentTodayByContract = useMemo(() => {
    const logs = DbService.getNotificationSendLogs();
    const todayIso = formatDateOnly(new Date());
    const sent = new Set<string>();
    for (const l of logs) {
      if (l.category !== 'installment_reminder') continue;
      const date = l.sentAt?.split('T')[0];
      if (date === todayIso && l.contractId) sent.add(l.contractId);
    }
    return sent;
  }, [targets.length]);

  const totals = useMemo(() => {
    const allItems = targets.flatMap(t => t.items);
    const overdue = allItems.filter(x => x.bucket === 'overdue').length;
    const today = allItems.filter(x => x.bucket === 'today').length;
    const upcoming = allItems.filter(x => x.bucket === 'upcoming').length;
    const amount = allItems.reduce((sum, x) => sum + (x.amountRemaining || 0), 0);
    return { overdue, today, upcoming, amount, targets: targets.length };
  }, [targets]);

  const toggleAll = (value: boolean) => {
    const next: Record<string, boolean> = {};
    for (const t of targets) next[t.key] = value;
    setSelected(next);
  };

  const sendForTarget = async (t: PaymentNotificationTarget) => {
    if (!t.phone && !(t as any).extraPhone) {
      notificationService.warning(`لا يوجد رقم هاتف للمستأجر: ${t.tenantName}`);
      return;
    }

    const message = buildWhatsAppMessage(t);
    const phones = [t.phone, (t as any).extraPhone].filter(Boolean) as string[];

    DbService.addNotificationSendLog({
      category: 'installment_reminder',
      tenantId: t.tenantId,
      tenantName: t.tenantName,
      phone: t.phone,
      contractId: t.contractId,
      propertyId: t.propertyId,
      propertyCode: t.propertyCode,
      installmentIds: t.items.map(x => x.installmentId),
      sentAt: new Date().toISOString(),
      message,
    });

    await openWhatsAppForPhones(message, phones, { defaultCountryCode: '962', delayMs: 10_000 });
  };

  const handleSendSelected = async () => {
    const list = targets.filter(t => selected[t.key]);
    if (list.length === 0) return;
    setIsSending(true);
    try {
      for (const t of list) {
        // slight delay helps avoid popup blockers in some environments
        // (still may be blocked depending on browser settings)
        await sendForTarget(t);
        await new Promise(r => setTimeout(r, 250));
      }
      notificationService.success(`تم تجهيز إشعارات لـ ${list.length} مستأجر/عقد`);
    } finally {
      setIsSending(false);
    }
  };

  const getBadge = (bucket: string) => {
    if (bucket === 'overdue') return { icon: <AlertTriangle size={14} className="text-red-500" />, text: 'متأخرة' };
    if (bucket === 'today') return { icon: <Clock size={14} className="text-amber-500" />, text: 'اليوم' };
    return { icon: <Clock size={14} className="text-indigo-500" />, text: 'قريبة' };
  };

  return (
    <div className="h-full bg-white dark:bg-slate-900 flex flex-col">
      <div className="p-4 border-b border-gray-100 dark:border-slate-800 flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-slate-800 dark:text-white flex items-center gap-2">
            <Users size={18} className="text-indigo-600" /> إرسال إشعارات الدفعات
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            متأخرة: {totals.overdue} • اليوم: {totals.today} • خلال {daysAhead} أيام: {totals.upcoming} • الإجمالي: {totals.amount.toLocaleString()} د.أ
          </p>
        </div>
        <button onClick={onClose} className="p-2 hover:bg-gray-100 dark:hover:bg-slate-800 rounded-full text-slate-500">
          <X size={18} />
        </button>
      </div>

      <div className="p-4 flex items-center gap-2 border-b border-gray-50 dark:border-slate-800">
        <button
          onClick={() => toggleAll(true)}
          className="px-3 py-2 rounded-xl text-sm font-bold border border-gray-200 dark:border-slate-700 hover:bg-gray-50 dark:hover:bg-slate-800"
        >
          تحديد الكل
        </button>
        <button
          onClick={() => toggleAll(false)}
          className="px-3 py-2 rounded-xl text-sm font-bold border border-gray-200 dark:border-slate-700 hover:bg-gray-50 dark:hover:bg-slate-800"
        >
          إلغاء التحديد
        </button>
        <div className="flex-1" />
        <button
          disabled={isSending}
          onClick={handleSendSelected}
          className="px-4 py-2 rounded-xl text-sm font-bold bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-60 flex items-center gap-2"
        >
          <Send size={16} /> إرسال المحدد
        </button>
      </div>

      <div className="flex-1 overflow-y-auto custom-scrollbar">
        {targets.length === 0 ? (
          <div className="p-10 text-center text-slate-500 dark:text-slate-400">
            لا توجد دفعات تحتاج إشعار حالياً.
          </div>
        ) : (
          <div className="divide-y divide-gray-50 dark:divide-slate-800">
            {targets.map(t => {
              const isSentToday = sentTodayByContract.has(t.contractId);
              const totalAmount = t.items.reduce((sum, x) => sum + (x.amountRemaining || 0), 0);
              const earliestDue = t.items[0]?.dueDate;
              const today = toDateOnly(new Date());
              const earliestDueDate = earliestDue ? parseDateOnly(earliestDue) : null;
              const daysUntilEarliest = earliestDueDate ? daysBetweenDateOnly(today, earliestDueDate) : null;
              return (
                <div key={t.key} className="p-4">
                  <div className="flex items-start gap-3">
                    <input
                      type="checkbox"
                      checked={!!selected[t.key]}
                      onChange={(e) => setSelected(prev => ({ ...prev, [t.key]: e.target.checked }))}
                      className="mt-1"
                    />
                    <div className="flex-1">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <div className="font-bold text-slate-800 dark:text-white flex items-center gap-2">
                            {t.tenantName}
                            {t.phone && (
                              <span className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1" dir="ltr">
                                <Phone size={12} /> {t.phone}
                              </span>
                            )}
                          </div>
                          <div className="text-xs text-slate-500 dark:text-slate-400">
                            عقد: {t.contractId} {t.propertyCode ? `• عقار: ${t.propertyCode}` : ''}
                            {daysUntilEarliest !== null ? ` • أقرب استحقاق: ${earliestDue} (${daysUntilEarliest < 0 ? `متأخر ${Math.abs(daysUntilEarliest)} يوم` : daysUntilEarliest === 0 ? 'اليوم' : `بعد ${daysUntilEarliest} يوم`})` : ''}
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-sm font-bold text-slate-800 dark:text-white">{totalAmount.toLocaleString()} د.أ</div>
                          <div className="text-[11px] text-slate-500 dark:text-slate-400">{t.items.length} دفعات</div>
                        </div>
                      </div>

                      <div className="mt-3 space-y-1">
                        {t.items.slice(0, 5).map((it) => {
                          const badge = getBadge(it.bucket);
                          return (
                            <div key={it.installmentId} className="flex items-center justify-between text-xs bg-gray-50 dark:bg-slate-800 rounded-lg px-3 py-2 border border-gray-100 dark:border-slate-700">
                              <div className="flex items-center gap-2">
                                {badge.icon}
                                <span className="text-slate-700 dark:text-slate-200">{it.dueDate}</span>
                                <span className="text-slate-500 dark:text-slate-400">({badge.text})</span>
                              </div>
                              <div className="font-bold text-slate-800 dark:text-white">{it.amountRemaining.toLocaleString()} د.أ</div>
                            </div>
                          );
                        })}
                        {t.items.length > 5 && (
                          <div className="text-[11px] text-slate-500 dark:text-slate-400">+ {t.items.length - 5} أخرى…</div>
                        )}
                      </div>

                      <div className="mt-3 flex items-center justify-between">
                        <div className="text-xs">
                          {isSentToday ? (
                            <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
                              <CheckCircle size={14} /> تم الإرسال اليوم
                            </span>
                          ) : (
                            <span className="text-slate-400">لم يتم الإرسال اليوم</span>
                          )}
                        </div>
                        <button
                          disabled={isSending}
                          onClick={() => void sendForTarget(t)}
                          className="px-3 py-2 rounded-xl text-sm font-bold border border-gray-200 dark:border-slate-700 hover:bg-gray-50 dark:hover:bg-slate-800 disabled:opacity-60 flex items-center gap-2"
                        >
                          <Send size={16} className="text-indigo-600" /> إرسال
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
