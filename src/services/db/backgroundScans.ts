/**
 * Startup / periodic alert maintenance: dedupe, reminders, auto-renew, data-quality, expiry, risk.
 */

import type { DbResult, SystemSettings } from '@/types';
import {
  tbl_Alerts,
  العقود_tbl,
  الأشخاص_tbl,
  العقارات_tbl,
  العمولات_tbl,
  الكمبيالات_tbl,
  BlacklistRecord,
  تذاكر_الصيانة_tbl,
} from '@/types';
import { formatCurrencyJOD } from '@/utils/format';
import { isTenancyRelevant } from '@/utils/tenancy';
import { get, save } from './kv';
import { KEYS } from './keys';
import { INSTALLMENT_STATUS } from './installmentConstants';
import { getInstallmentPaidAndRemaining } from './installments';
import {
  buildContractAlertContext,
  dedupeAlertsStorage,
  markAlertsReadByPrefix,
  upsertAlert,
} from './alertsCore';
import { getSettings } from './settings';
import { tryAutoSendIfEligible } from '@/services/whatsAppAutoSender';
import { notificationCenter } from '@/services/notificationCenter';

export type CreateContractFn = (
  data: Partial<العقود_tbl>,
  commOwner: number,
  commTenant: number,
  commissionPaidMonth?: string
) => DbResult<العقود_tbl>;

export type BackgroundScansDeps = {
  asUnknownRecord: (value: unknown) => Record<string, unknown>;
  toDateOnly: (d: Date) => Date;
  formatDateOnly: (d: Date) => string;
  parseDateOnly: (iso: string) => Date | null;
  daysBetweenDateOnly: (from: Date, to: Date) => number;
  addDaysIso: (isoDate: string, days: number) => string | null;
  addMonthsDateOnly: (isoDate: string, months: number) => Date | null;
  createContract: CreateContractFn;
  logOperationInternal: (
    user: string,
    action: string,
    table: string,
    recordId: string,
    details: string
  ) => void;
};

export function createBackgroundScansRuntime(d: BackgroundScansDeps) {
  const {
    asUnknownRecord,
    toDateOnly,
    formatDateOnly,
    parseDateOnly,
    daysBetweenDateOnly,
    addDaysIso,
    addMonthsDateOnly,
    createContract,
    logOperationInternal,
  } = d;

  const dedupeAndCleanupAlertsInternal = () => {
    const alertsRaw = get<tbl_Alerts>(KEYS.ALERTS) || [];
    if (alertsRaw.length === 0) return;

    const idSortSig = (arr: tbl_Alerts[]) =>
      [...arr].map((a) => String(a.id).trim()).filter(Boolean).sort().join('\u0001');

    const dedupedFromCore = dedupeAlertsStorage(alertsRaw);
    const alerts = Array.isArray(dedupedFromCore) ? dedupedFromCore : alertsRaw;
    let changed =
      alerts.length !== alertsRaw.length || idSortSig(alerts) !== idSortSig(alertsRaw);

    if (changed) {
      save(KEYS.ALERTS, alerts);
    }

    const installments = get<الكمبيالات_tbl>(KEYS.INSTALLMENTS) || [];
    const byInstallmentId = new Map<string, الكمبيالات_tbl>();
    for (const inst of installments) {
      const k = String(inst.رقم_الكمبيالة ?? '').trim();
      if (k) byInstallmentId.set(k, inst);
    }

    const today = toDateOnly(new Date());
    const seen = new Map<string, tbl_Alerts>();
    const deduped: tbl_Alerts[] = [];

    const inferAndPatchAlertContext = (a: tbl_Alerts): boolean => {
      if (a?.مرجع_الجدول && a?.مرجع_المعرف) return false;
      if (a?.نوع_التنبيه !== 'تأجيل تحصيل') return false;

      const msg = String(a?.الوصف || '');
      const m = msg.match(/عقد\s*#?\s*([A-Za-z0-9_-]+)/);
      const contractId = String(m?.[1] || '').trim();
      if (!contractId) return false;

      const ctx = buildContractAlertContext(contractId);
      const before = JSON.stringify({
        tenantName: a.tenantName,
        phone: a.phone,
        propertyCode: a.propertyCode,
        مرجع_الجدول: a.مرجع_الجدول,
        مرجع_المعرف: a.مرجع_المعرف,
      });
      Object.assign(a, ctx);
      const after = JSON.stringify({
        tenantName: a.tenantName,
        phone: a.phone,
        propertyCode: a.propertyCode,
        مرجع_الجدول: a.مرجع_الجدول,
        مرجع_المعرف: a.مرجع_المعرف,
      });
      return before !== after;
    };

    for (const a of alerts) {
      const aid = String(a?.id ?? '').trim();
      if (!aid) continue;

      const existing = seen.get(aid);
      if (existing) {
        if (!!a.تم_القراءة && !existing.تم_القراءة) existing.تم_القراءة = true;
        changed = true;
        continue;
      }

      if (!a.تم_القراءة) {
        const payPrefix = 'ALR-FIN-PAY-';
        const remPrefix = 'ALR-FIN-REM7-';
        const legalPrefix = 'ALR-FIN-LEGAL-';

        if (
          a.نوع_التنبيه === 'إخطار بالدفع' ||
          a.نوع_التنبيه === 'إخطار قانوني بالدفع' ||
          aid.startsWith(payPrefix) ||
          aid.startsWith(legalPrefix)
        ) {
          a.تم_القراءة = true;
          changed = true;
        }

        if (aid.startsWith(payPrefix)) {
          // handled above
        } else if (aid.startsWith(remPrefix)) {
          const instId = aid.slice(remPrefix.length).trim();
          const inst = byInstallmentId.get(instId);
          if (inst) {
            const status = String(inst.حالة_الكمبيالة ?? '').trim();
            const { remaining } = getInstallmentPaidAndRemaining(inst);
            if (status === INSTALLMENT_STATUS.PAID || remaining <= 0) {
              a.تم_القراءة = true;
              changed = true;
            } else {
              const due = parseDateOnly(inst.تاريخ_استحقاق);
              if (due) {
                const daysUntilDue = daysBetweenDateOnly(today, due);
                if (daysUntilDue <= 0) {
                  a.تم_القراءة = true;
                  changed = true;
                }
              }
            }
          }
        }
      }

      if (inferAndPatchAlertContext(a)) {
        changed = true;
      }

      seen.set(aid, a);
      deduped.push(a);
    }

    if (changed || deduped.length !== alerts.length) {
      save(KEYS.ALERTS, deduped);
    }
  };

  const runInstallmentReminderScanInternal = () => {
    const today = toDateOnly(new Date());

    const contracts = get<العقود_tbl>(KEYS.CONTRACTS).filter((c) => isTenancyRelevant(c));
    if (contracts.length === 0) return;

    const people = get<الأشخاص_tbl>(KEYS.PEOPLE);
    const properties = get<العقارات_tbl>(KEYS.PROPERTIES);
    const installments = get<الكمبيالات_tbl>(KEYS.INSTALLMENTS);
    const norm = (v: unknown) => String(v ?? '').trim();

    // O(1) Lookup Maps
    const peopleMap = new Map<string, الأشخاص_tbl>();
    for (const p of people) peopleMap.set(p.رقم_الشخص, p);

    const propertiesMap = new Map<string, العقارات_tbl>();
    for (const p of properties) propertiesMap.set(p.رقم_العقار, p);

    const installmentsByContract = new Map<string, الكمبيالات_tbl[]>();
    for (const inst of installments) {
      const cId = inst.رقم_العقد;
      if (!installmentsByContract.has(cId)) installmentsByContract.set(cId, []);
      installmentsByContract.get(cId)?.push(inst);
    }

    for (const contract of contracts) {
      const tenant = peopleMap.get(contract.رقم_المستاجر);
      const property = propertiesMap.get(contract.رقم_العقار);
      const allInst = installmentsByContract.get(contract.رقم_العقد) || [];

      const contractInstallmentsAll = allInst
        .filter((i) => i.نوع_الكمبيالة !== 'تأمين')
        .filter((i) => asUnknownRecord(i)['isArchived'] !== true)
        .filter((i) => norm(i.حالة_الكمبيالة) !== INSTALLMENT_STATUS.CANCELLED);

      const contractInstallments = contractInstallmentsAll.filter(
        (i) => norm(i.حالة_الكمبيالة) !== INSTALLMENT_STATUS.PAID
      );

      const unpaid = contractInstallments
        .map((i) => ({ inst: i, ...getInstallmentPaidAndRemaining(i) }))
        .filter((x) => x.remaining > 0);

      const nowPaid = contractInstallmentsAll
        .map((i) => ({
          inst: i,
          status: norm(i.حالة_الكمبيالة),
          ...getInstallmentPaidAndRemaining(i),
        }))
        .filter((x) => x.status === INSTALLMENT_STATUS.PAID || x.remaining <= 0);

      for (const p of nowPaid) {
        const paidInstId = String(p.inst.رقم_الكمبيالة ?? '').trim();
        if (paidInstId) {
          markAlertsReadByPrefix(`ALR-FIN-REM7-${paidInstId}`);
          markAlertsReadByPrefix(`ALR-FIN-PAY-${paidInstId}`);
        }
      }

      markAlertsReadByPrefix(`ALR-FIN-LEGAL-${contract.رقم_العقد}`);

      const settings = getSettings();

      for (const u of unpaid) {
        const due = parseDateOnly(u.inst.تاريخ_استحقاق);
        if (!due) continue;
        const daysUntilDue = daysBetweenDateOnly(today, due);

        if (daysUntilDue > 0 && daysUntilDue <= 7) {
          const instKey = String(u.inst.رقم_الكمبيالة ?? '').trim();
          if (!instKey) continue;
          const alertId = `ALR-FIN-REM7-${instKey}`;
          upsertAlert({
            id: alertId,
            تاريخ_الانشاء: today.toISOString().split('T')[0],
            نوع_التنبيه: 'تذكير قبل الاستحقاق (7 أيام)',
            الوصف: `دفعة ستستحق خلال ${daysUntilDue} أيام. المبلغ: ${formatCurrencyJOD(u.remaining)} — تاريخ الاستحقاق: ${u.inst.تاريخ_استحقاق}`,
            category: 'Financial',
            تم_القراءة: false,
            tenantName: tenant?.الاسم,
            phone: tenant?.رقم_الهاتف,
            propertyCode: property?.الكود_الداخلي,
            مرجع_الجدول: 'الكمبيالات_tbl',
            مرجع_المعرف: instKey,
          });

          notificationCenter.add({
            id: `nc-rem7-${instKey}`,
            type: 'info',
            title: 'تذكير بالاستحقاق',
            message: `${property?.الكود_الداخلي ? property.الكود_الداخلي + ' — ' : ''}${tenant?.الاسم || 'غير معروف'} — دفعة ستستحق خلال ${daysUntilDue} أيام (${u.inst.تاريخ_استحقاق})`,
            category: 'payment',
            entityId: instKey,
          });
        }

        void tryAutoSendIfEligible({
          installment: u.inst,
          contract,
          tenant,
          property,
          settings,
          daysUntilDue,
        }).catch((e) => console.warn('[WhatsApp auto]', e));
      }
    }
  };

  const runAutoRenewContractsInternal = () => {
    const todayIso = formatDateOnly(toDateOnly(new Date()));
    const today = parseDateOnly(todayIso);
    if (!today) return;

    const contracts = get<العقود_tbl>(KEYS.CONTRACTS);
    const expirable = contracts.filter((c) => !c.isArchived && c.autoRenew === true);
    if (expirable.length === 0) return;

    for (const c of expirable) {
      if (c.linkedContractId) continue;
      const end = parseDateOnly(c.تاريخ_النهاية);
      if (!end) continue;
      if (toDateOnly(end).getTime() >= toDateOnly(today).getTime()) continue;

      try {
        const newStart = addDaysIso(c.تاريخ_النهاية, 1);
        if (!newStart) continue;
        const endCandidate = addMonthsDateOnly(newStart, c.مدة_العقد_بالاشهر);
        if (!endCandidate) continue;
        endCandidate.setDate(endCandidate.getDate() - 1);
        const newEnd = formatDateOnly(endCandidate);

        const prevCommission = get<العمولات_tbl>(KEYS.COMMISSIONS).find(
          (x) => x.رقم_العقد === c.رقم_العقد
        );
        const commOwner = prevCommission?.عمولة_المالك ?? 0;
        const commTenant = prevCommission?.عمولة_المستأجر ?? 0;
        const commissionPaidMonth = /^\d{4}-\d{2}-\d{2}$/.test(String(newStart))
          ? String(newStart).slice(0, 7)
          : undefined;

        const { رقم_العقد: _omitId, ...base } = c;
        const result = createContract(
          {
            ...base,
            تاريخ_البداية: newStart,
            تاريخ_النهاية: newEnd,
            حالة_العقد: 'نشط',
            isArchived: false,
            عقد_مرتبط: c.رقم_العقد,
            linkedContractId: undefined,
          },
          commOwner,
          commTenant,
          commissionPaidMonth
        );

        if (result.success && result.data) {
          const newId = result.data.رقم_العقد;
          const all = get<العقود_tbl>(KEYS.CONTRACTS);
          const idx = all.findIndex((x) => x.رقم_العقد === c.رقم_العقد);
          if (idx > -1) {
            all[idx].linkedContractId = newId;
            all[idx].حالة_العقد = 'مجدد';
            save(KEYS.CONTRACTS, all);
          }
          logOperationInternal(
            'System',
            'تجديد تلقائي',
            'Contracts',
            c.رقم_العقد,
            `تم التجديد التلقائي وإنشاء عقد جديد: ${newId}`
          );

          const ctx = buildContractAlertContext(c.رقم_العقد);
          notificationCenter.add({
            id: `nc-renew-success-${newId}`,
            type: 'success',
            title: 'تم التجديد التلقائي',
            message: `${ctx.propertyCode ? ctx.propertyCode + ' — ' : ''}${ctx.tenantName ? ctx.tenantName + ' — ' : ''}تم إنشاء العقد الجديد ${newId}`,
            category: 'contracts',
            entityId: newId,
          });
        }
      } catch (e) {
        console.warn('Auto renew failed', e);
      }
    }
  };

  const markAlertsReadIfNotInSet = (prefix: string, alive: Set<string>) => {
    const all = get<tbl_Alerts>(KEYS.ALERTS);
    let changed = false;
    for (const a of all) {
      const id = String(asUnknownRecord(a)['id'] ?? '');
      if (!id.startsWith(prefix)) continue;
      if (alive.has(id)) continue;
      if (!a.تم_القراءة) {
        a.تم_القراءة = true;
        changed = true;
      }
    }
    if (changed) save(KEYS.ALERTS, all);
  };

  const runDataQualityScanInternal = () => {
    const norm = (v: unknown) => String(v ?? '').trim();

    const properties = get<العقارات_tbl>(KEYS.PROPERTIES);
    if (properties.length === 0) {
      markAlertsReadByPrefix('ALR-DQ-PROP-');
    } else {
      const issues = properties
        .map((p) => {
          const missing: string[] = [];
          if (!norm(asUnknownRecord(p)['رقم_اشتراك_الكهرباء'])) missing.push('رقم_اشتراك_الكهرباء');
          if (!norm(asUnknownRecord(p)['رقم_اشتراك_المياه'])) missing.push('رقم_اشتراك_المياه');
          return {
            id: p.رقم_العقار,
            name: `${p.الكود_الداخلي || p.رقم_العقار} — ${p.العنوان || ''}`.trim(),
            missingFields: missing,
          };
        })
        .filter((x) => x.missingFields.length > 0);

      const alertId = 'ALR-DQ-PROP-UTILS';
      if (issues.length === 0) {
        markAlertsReadByPrefix('ALR-DQ-PROP-');
      } else {
        upsertAlert({
          id: alertId,
          تاريخ_الانشاء: new Date().toISOString().split('T')[0],
          نوع_التنبيه: 'نقص بيانات العقارات',
          الوصف: `يوجد ${issues.length} عقارات ينقصها بيانات مهمة (كهرباء/مياه).`,
          category: 'DataQuality',
          تم_القراءة: false,
          count: issues.length,
          details: issues,
          مرجع_الجدول: 'العقارات_tbl',
          مرجع_المعرف: 'batch',
        });
      }
    }

    const people = get<الأشخاص_tbl>(KEYS.PEOPLE);
    if (people.length === 0) {
      markAlertsReadByPrefix('ALR-DQ-PEOPLE-');
      return;
    }

    const peopleIssues = people
      .map((p) => {
        const missing: string[] = [];
        if (!norm(p.رقم_الهاتف)) missing.push('رقم_الهاتف');
        if (!norm(p.الرقم_الوطني)) missing.push('الرقم_الوطني');
        return {
          id: p.رقم_الشخص,
          name: `${p.الاسم || p.رقم_الشخص}`.trim(),
          missingFields: missing,
        };
      })
      .filter((x) => x.missingFields.length > 0);

    const peopleAlertId = 'ALR-DQ-PEOPLE-IDPHONE';
    if (peopleIssues.length === 0) {
      markAlertsReadByPrefix('ALR-DQ-PEOPLE-');
      return;
    }

    upsertAlert({
      id: peopleAlertId,
      تاريخ_الانشاء: new Date().toISOString().split('T')[0],
      نوع_التنبيه: 'نقص بيانات الأشخاص',
      الوصف: `يوجد ${peopleIssues.length} أشخاص ينقصهم رقم الهاتف أو الرقم الوطني.`,
      category: 'DataQuality',
      تم_القراءة: false,
      count: peopleIssues.length,
      details: peopleIssues,
      مرجع_الجدول: 'الأشخاص_tbl',
      مرجع_المعرف: 'batch',
    });
  };

  const runExpiryScanInternal = () => {
    const today = toDateOnly(new Date());
    const todayIso = formatDateOnly(today);

    const settings: SystemSettings = getSettings();
    const threshold = Math.max(1, Number(settings?.alertThresholdDays ?? 30));

    const contracts = get<العقود_tbl>(KEYS.CONTRACTS)
      .filter((c) => isTenancyRelevant(c))
      .filter((c) => !c.isArchived);

    const alive = new Set<string>();

    for (const c of contracts) {
      const end = parseDateOnly(String(asUnknownRecord(c)['تاريخ_النهاية'] || ''));
      if (!end) continue;
      const daysLeft = daysBetweenDateOnly(today, end);
      if (daysLeft < 0) continue;
      if (daysLeft > threshold) continue;

      const id = `ALR-EXP-${c.رقم_العقد}`;
      alive.add(id);
      const ctx = buildContractAlertContext(c.رقم_العقد);
      upsertAlert({
        id,
        تاريخ_الانشاء: todayIso,
        نوع_التنبيه: 'قرب انتهاء العقد',
        الوصف: `عقد الإيجار سينتهي خلال ${daysLeft} يوم — تاريخ الانتهاء: ${String(asUnknownRecord(c)['تاريخ_النهاية'] ?? '')}`,
        category: 'Expiry',
        تم_القراءة: false,
        ...ctx,
        مرجع_الجدول: 'العقود_tbl',
        مرجع_المعرف: c.رقم_العقد,
      });

      // Auto renew alert 30 days before expiry
      if (c.autoRenew && daysLeft <= 30 && daysLeft > 0) {
        const renewAlertId = `ALR-RENEW-${c.رقم_العقد}`;
        alive.add(renewAlertId);
        upsertAlert({
          id: renewAlertId,
          تاريخ_الانشاء: todayIso,
          نوع_التنبيه: 'تجديد تلقائي قادم',
          الوصف: `عقد ${c.رقم_العقد} سيتجدد تلقائياً خلال ${daysLeft} يوم`,
          category: 'Expiry',
          تم_القراءة: false,
          ...ctx,
          مرجع_الجدول: 'العقود_tbl',
          مرجع_المعرف: c.رقم_العقد,
        });
        
        notificationCenter.add({
          id: `nc-renewal-${c.رقم_العقد}`,
          type: 'warning',
          title: 'تجديد تلقائي قادم',
          message: `${ctx.propertyCode ? ctx.propertyCode + ' — ' : ''}${ctx.tenantName ? ctx.tenantName + ' — ' : ''}سيتجدد خلال ${daysLeft} يوم`,
          category: 'contract_renewal',
          entityId: c.رقم_العقد,
          urgent: daysLeft <= 7,
        });
      }
    }

    markAlertsReadIfNotInSet('ALR-EXP-', alive);
    markAlertsReadIfNotInSet('ALR-RENEW-', alive);
  };

  const runRiskScanInternal = () => {
    const today = toDateOnly(new Date());
    const todayIso = formatDateOnly(today);

    const contracts = get<العقود_tbl>(KEYS.CONTRACTS)
      .filter((c) => isTenancyRelevant(c))
      .filter((c) => !c.isArchived);
    if (contracts.length === 0) {
      markAlertsReadByPrefix('ALR-RISK-');
      return;
    }

    const people = get<الأشخاص_tbl>(KEYS.PEOPLE);
    const properties = get<العقارات_tbl>(KEYS.PROPERTIES);
    const installments = get<الكمبيالات_tbl>(KEYS.INSTALLMENTS);
    const blacklist = get<BlacklistRecord>(KEYS.BLACKLIST).filter((b) => b.isActive);
    
    // O(1) Lookup Maps
    const peopleMap = new Map<string, الأشخاص_tbl>();
    for (const p of people) peopleMap.set(p.رقم_الشخص, p);

    const propertiesMap = new Map<string, العقارات_tbl>();
    for (const p of properties) propertiesMap.set(p.رقم_العقار, p);

    const blacklistMap = new Map<string, BlacklistRecord>();
    for (const b of blacklist) blacklistMap.set(String(b.personId), b);

    const installmentsByContract = new Map<string, الكمبيالات_tbl[]>();
    for (const inst of installments) {
      const cId = String(inst.رقم_العقد);
      if (!installmentsByContract.has(cId)) installmentsByContract.set(cId, []);
      installmentsByContract.get(cId)?.push(inst);
    }

    const norm = (v: unknown) => String(v ?? '').trim();
    const alive = new Set<string>();

    for (const c of contracts) {
      const tenantId = String(asUnknownRecord(c)['رقم_المستاجر'] ?? '').trim();
      const tenant = tenantId ? peopleMap.get(tenantId) : undefined;
      const propertyId = String(asUnknownRecord(c)['رقم_العقار'] ?? '').trim();
      const property = propertyId ? propertiesMap.get(propertyId) : undefined;
      
      const ctx = {
        tenantName: tenant?.الاسم,
        phone: tenant?.رقم_الهاتف,
        propertyCode: property?.الكود_الداخلي,
        مرجع_الجدول: 'العقود_tbl',
        مرجع_المعرف: c.رقم_العقد,
      } as Partial<tbl_Alerts>;

      const bl = tenantId ? blacklistMap.get(tenantId) : undefined;
      if (bl) {
        const id = `ALR-RISK-BL-${c.رقم_العقد}`;
        alive.add(id);
        upsertAlert({
          id,
          تاريخ_الانشاء: todayIso,
          نوع_التنبيه: 'مستأجر ضمن القائمة السوداء',
          الوصف: `المستأجر مدرج بالقائمة السوداء (${bl.severity}). السبب: ${bl.reason}`,
          category: 'Risk',
          تم_القراءة: false,
          details: tenant ? [{ id: tenantId, name: tenant.الاسم, note: bl.reason }] : undefined,
          ...ctx,
          مرجع_المعرف: tenantId, // Primary reference is the tenant
          مرجع_الجدول: 'الأشخاص_tbl',
        });
      }

      const overdueThresholdDays = 14;
      const allInst = installmentsByContract.get(String(c.رقم_العقد)) || [];

      const contractInstallments = allInst
        .filter((i) => i.نوع_الكمبيالة !== 'تأمين')
        .filter((i) => asUnknownRecord(i)['isArchived'] !== true)
        .filter((i) => norm(i.حالة_الكمبيالة) !== INSTALLMENT_STATUS.CANCELLED);

      const overdue = contractInstallments
        .map((i) => {
          const due = parseDateOnly(String(i.تاريخ_استحقاق || ''));
          const { remaining } = getInstallmentPaidAndRemaining(i);
          if (!due) return null;
          if (remaining <= 0) return null;
          const daysLate = daysBetweenDateOnly(due, today);
          if (daysLate < overdueThresholdDays) return null;
          return { inst: i, due: formatDateOnly(due), remaining, daysLate };
        })
        .filter(Boolean) as Array<{
        inst: الكمبيالات_tbl;
        due: string;
        remaining: number;
        daysLate: number;
      }>;

      if (overdue.length > 0) {
        const id = `ALR-RISK-OD-${c.رقم_العقد}`;
        alive.add(id);

        const total = overdue.reduce((sum, x) => sum + (Number(x.remaining) || 0), 0);
        upsertAlert({
          id,
          تاريخ_الانشاء: todayIso,
          نوع_التنبيه: 'مخاطر تحصيل (دفعات متأخرة)',
          الوصف: `يوجد ${overdue.length} دفعات متأخرة (${overdueThresholdDays}+ يوم). إجمالي المتبقي: ${formatCurrencyJOD(total)}`,
          category: 'Risk',
          تم_القراءة: false,
          count: overdue.length,
          details: overdue.slice(0, 20).map((x) => ({
            id: x.inst.رقم_الكمبيالة,
            name: `كمبيالة ${x.inst.رقم_الكمبيالة}`,
            note: `متأخر ${x.daysLate} يوم — تاريخ الاستحقاق: ${x.due} — المتبقي: ${formatCurrencyJOD(Number(x.remaining || 0))}`,
          })),
          ...ctx,
        });

        notificationCenter.add({
          id: `nc-overdue-${c.رقم_العقد}`,
          type: 'error',
          title: 'مخاطر تحصيل (تأخير)',
          message: `${property?.الكود_الداخلي ? property.الكود_الداخلي + ' — ' : ''}${tenant?.الاسم || 'غير معروف'} — ${overdue.length} دفعات متأخرة. الإجمالي: ${formatCurrencyJOD(total)}`,
          category: 'overdue',
          entityId: overdue[0].inst.رقم_الكمبيالة,
          urgent: true,
        });
      }
    }

    markAlertsReadIfNotInSet('ALR-RISK-', alive);
  };

  const runMaintenanceScanInternal = () => {
    const today = toDateOnly(new Date());
    const tickets = get<تذاكر_الصيانة_tbl>(KEYS.MAINTENANCE) || [];
    const alive = new Set<string>();

    const thresholdDays = 5;

    for (const t of tickets) {
      if (t.الحالة === 'مغلق') continue;

      const requestedDate = parseDateOnly(t.تاريخ_الطلب);
      if (!requestedDate) continue;

      const daysOpen = daysBetweenDateOnly(requestedDate, today);
      if (daysOpen >= thresholdDays) {
        const id = `ALR-MNT-PENDING-${t.رقم_التذكرة}`;
        alive.add(id);
        
        upsertAlert({
          id,
          تاريخ_الانشاء: today.toISOString().split('T')[0],
          نوع_التنبيه: 'تأخر في إنجاز الصيانة',
          الوصف: `تذكرة الصيانة #${t.رقم_التذكرة} ما زالت مفتوحة منذ ${daysOpen} أيام — الوصف: ${t.الوصف}`,
          category: 'System',
          تم_القراءة: false,
          مرجع_الجدول: 'تذاكر_الصيانة_tbl',
          مرجع_المعرف: t.رقم_التذكرة,
        });
        
        const prop = get<العقارات_tbl>(KEYS.PROPERTIES).find(p => p.رقم_العقار === t.رقم_العقار);
        const propertyCode = prop?.الكود_الداخلي || '';
        notificationCenter.add({
          id: `nc-mnt-late-${t.رقم_التذكرة}`,
          type: 'warning',
          title: 'صيانة متأخرة',
          message: `${String(propertyCode || t.رقم_العقار || '')}${propertyCode ? ' — ' : ''}معلقة منذ ${daysOpen} أيام`,
          category: 'maintenance',
          entityId: t.رقم_التذكرة,
        });
      }
    }

    markAlertsReadIfNotInSet('ALR-MNT-PENDING-', alive);
  };

  return {
    dedupeAndCleanupAlertsInternal,
    runInstallmentReminderScanInternal,
    runAutoRenewContractsInternal,
    markAlertsReadIfNotInSet,
    runDataQualityScanInternal,
    runExpiryScanInternal,
    runRiskScanInternal,
    runMaintenanceScanInternal,
  };
}
