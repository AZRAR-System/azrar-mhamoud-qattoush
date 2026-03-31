import {
  Trash2,
  Edit2,
  Phone,
  Eye,
  Ban,
  ShieldAlert,
  ArrowRight,
  ListTodo,
  IdCard,
  MessageCircle,
} from 'lucide-react';
import type { DynamicFormField, الأشخاص_tbl, العقود_tbl, العقارات_tbl } from '@/types';
import type { PeoplePickerItem } from '@/types/domain.types';
import { collectWhatsAppPhones, openWhatsAppForPhones } from '@/utils/whatsapp';
import { getDefaultWhatsAppCountryCodeSync } from '@/services/geoSettings';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { RBACGuard } from '@/components/shared/RBACGuard';
import { formatDynamicValue, isEmptyDynamicValue } from '@/components/dynamic/dynamicValue';
import { formatContractNumberShort } from '@/utils/contractNumber';
import { getPersonColorClasses, getPersonSeedFromPerson } from '@/utils/personColor';

type RoleClasses = { badge: string; avatar: string };

/** مظهر موحّد لبطاقات قائمة الأشخاص (ويب + ديسكتوب) */
const personCardShellClasses =
  'h-full flex flex-col overflow-hidden rounded-2xl md:rounded-[2rem] transition-all duration-300 hover:-translate-y-0.5 hover:shadow-2xl hover:shadow-indigo-500/15 dark:hover:shadow-indigo-500/10 focus-within:ring-2 focus-within:ring-indigo-500/25 dark:focus-within:ring-indigo-400/20 focus-within:ring-offset-2 focus-within:ring-offset-white dark:focus-within:ring-offset-slate-950';

function phoneDigitsForTel(phones: Array<string | null | undefined>): string {
  for (const p of phones) {
    const d = String(p ?? '').replace(/\D/g, '');
    if (d.length >= 6 && d.length <= 15) return d;
  }
  return '';
}

/** بطاقة موحّدة: هاتف + واتساب + رقم وطني — أرقام تُعرض كاملةً بلفّ طبيعي دون شريط تمرير */
function PersonQuickInfoStrip({
  person,
  t,
}: {
  person: الأشخاص_tbl;
  t: (key: string, options?: Record<string, unknown>) => string;
}) {
  const phone = String(person.رقم_الهاتف || '').trim();
  const national = String(person.الرقم_الوطني || '').trim();

  const phoneDisplay = phone || t('لا يوجد');
  const nationalDisplay = national || '—';

  const waOpts = { defaultCountryCode: getDefaultWhatsAppCountryCodeSync() };
  const hasWhatsApp =
    collectWhatsAppPhones([person.رقم_الهاتف, person.رقم_هاتف_اضافي], waOpts).length > 0;

  const openWhatsApp = () => {
    void openWhatsAppForPhones('', [person.رقم_الهاتف, person.رقم_هاتف_اضافي], {
      ...waOpts,
      delayMs: 10_000,
    });
  };

  return (
    <div className="mb-4 overflow-visible rounded-2xl border border-slate-200/85 bg-gradient-to-br from-white to-slate-50/90 shadow-sm ring-1 ring-black/[0.04] dark:border-slate-700/80 dark:from-slate-900/75 dark:to-slate-950/90 dark:ring-white/[0.06]">
      <div className="flex items-start gap-2.5 border-b border-slate-200/80 p-3 dark:border-slate-700/60 sm:gap-3 sm:p-3.5">
        <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-indigo-500/12 text-indigo-600 dark:bg-indigo-400/15 dark:text-indigo-300 sm:h-9 sm:w-9 sm:rounded-xl">
          <Phone size={16} strokeWidth={2.1} aria-hidden />
        </span>
        <div className="min-w-0 flex-1 text-start">
          <p className="mb-1 text-[10px] font-medium text-slate-500 dark:text-slate-400 sm:text-[11px]">
            {t('رقم الهاتف')}
          </p>
          <p
            className="break-all font-mono text-[11px] font-medium leading-relaxed text-slate-800 dark:text-slate-100 sm:text-xs dir-ltr text-left"
            dir="ltr"
          >
            {phoneDisplay}
          </p>
        </div>
        {hasWhatsApp ? (
          <Button
            type="button"
            size="icon"
            variant="ghost"
            className="mt-0.5 h-8 w-8 shrink-0 text-emerald-600 hover:bg-emerald-500/10 hover:text-emerald-700 dark:text-emerald-400 dark:hover:bg-emerald-500/15 dark:hover:text-emerald-300"
            title={t('واتساب')}
            aria-label={t('واتساب')}
            onClick={openWhatsApp}
          >
            <MessageCircle size={16} aria-hidden />
          </Button>
        ) : null}
      </div>
      <div className="flex items-start gap-2.5 p-3 sm:gap-3 sm:p-3.5">
        <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-violet-500/12 text-violet-600 dark:bg-violet-400/15 dark:text-violet-300 sm:h-9 sm:w-9 sm:rounded-xl">
          <IdCard size={16} strokeWidth={2.1} aria-hidden />
        </span>
        <div className="min-w-0 flex-1 text-start">
          <p className="mb-1 text-[10px] font-medium text-slate-500 dark:text-slate-400 sm:text-[11px]">
            {t('الرقم الوطني')}
          </p>
          <p
            className="break-all font-mono text-[11px] font-medium leading-relaxed text-slate-800 dark:text-slate-100 sm:text-xs dir-ltr text-left"
            dir="ltr"
          >
            {nationalDisplay}
          </p>
        </div>
      </div>
    </div>
  );
}

export type PersonListingCardWebProps = {
  person: الأشخاص_tbl;
  roles: string[];
  isBlacklisted: boolean;
  roleVisual: { stripe: string; dot: string };
  roleRing: string;
  accent: RoleClasses;
  pick: العقود_tbl | null;
  linkedProperty: العقارات_tbl | undefined;
  tenantName: string;
  guarantorName: string;
  tenantContract: العقود_tbl | undefined;
  guarantorContract: العقود_tbl | undefined;
  ownerContract: العقود_tbl | undefined;
  getRoleClasses: (role: string) => RoleClasses;
  showDynamicColumns: boolean;
  dynamicFields: DynamicFormField[];
  tr: (text: string) => string;
  t: (key: string, options?: Record<string, unknown>) => string;
  openPanel: (panelId: string, payload?: unknown, options?: unknown) => void;
  handleOpenForm: (id?: string) => void;
  handleDelete: (id: string) => void;
  handleBlacklist: (id: string) => void;
  handleQuickReminderForPerson: (person: الأشخاص_tbl) => void | Promise<void>;
  isDeleting?: boolean;
};

export function PersonListingCardWeb({
  person,
  roles: _roles,
  isBlacklisted,
  roleVisual,
  roleRing,
  accent,
  pick,
  linkedProperty,
  tenantName,
  guarantorName,
  tenantContract,
  guarantorContract,
  ownerContract,
  getRoleClasses: _getRoleClasses,
  showDynamicColumns,
  dynamicFields,
  tr: _tr,
  t,
  openPanel,
  handleOpenForm,
  handleDelete,
  handleBlacklist,
  handleQuickReminderForPerson,
  isDeleting,
}: PersonListingCardWebProps) {
  const isLinkedToContract = Boolean(pick);
  const contractBoxClass = isLinkedToContract
    ? 'border-indigo-200 dark:border-indigo-500/30 bg-indigo-50 dark:bg-indigo-900/20'
    : 'border-gray-100 dark:border-slate-700 bg-gray-50 dark:bg-slate-900/40';
  const contractTitleClass = isLinkedToContract
    ? 'text-indigo-700 dark:text-indigo-200'
    : 'text-slate-700 dark:text-slate-200';

  return (
    <Card
      className={`group w-full animate-slide-up ${personCardShellClasses} ${roleRing} ${isBlacklisted ? 'ring-2 ring-red-500/25 border-red-400/40 dark:border-red-500/30' : ''} ${isDeleting ? 'animate-pulse opacity-90' : ''}`}
    >
      <div className={`h-1.5 w-full shrink-0 ${roleVisual.stripe}`} aria-hidden />
      <div className="p-5 md:p-6 flex flex-col h-full min-h-0">
        <div className="flex items-start justify-between gap-3 mb-4">
          <div className="flex items-center gap-3 min-w-0">
            <div
              className={`w-12 h-12 rounded-2xl flex items-center justify-center text-xl font-bold shadow-md ring-2 ring-white/70 dark:ring-slate-800/80 shrink-0 ${isBlacklisted ? 'bg-red-100 text-red-600' : accent.avatar}`}
            >
              {(person.الاسم || 'غ').charAt(0)}
            </div>
            <div className="min-w-0 flex-1">
              <div className="rounded-2xl border border-slate-200/70 dark:border-slate-700/80 bg-white/70 dark:bg-slate-900/50 backdrop-blur-sm px-3 py-2.5 shadow-sm">
                <div className="flex items-start gap-2 min-w-0">
                  <span
                    className={`inline-block w-2.5 h-2.5 rounded-full mt-1 flex-shrink-0 ${roleVisual.dot}`}
                  ></span>
                  <div className="min-w-0">
                    <div className="text-sm font-bold text-slate-900 dark:text-white leading-snug whitespace-normal break-words">
                      {person.الاسم || t('غير محدد')}
                    </div>
                    <div className="mt-1 flex flex-wrap items-center gap-2 text-[10px] text-slate-500 dark:text-slate-400">
                      {person.نوع_الملف === 'منشأة' ? (
                        <span className="px-2 py-0.5 rounded-lg border bg-gray-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-gray-200 dark:border-slate-700">
                          {t('منشأة')}
                        </span>
                      ) : null}
                      {isBlacklisted ? (
                        <span className="inline-flex items-center gap-1 text-red-600 dark:text-red-300">
                          <ShieldAlert size={14} /> {t('قائمة سوداء')}
                        </span>
                      ) : null}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <PersonQuickInfoStrip person={person} t={t} />

        <div
          className={`mb-4 min-w-0 rounded-xl border p-4 shadow-inner ring-1 ring-slate-900/5 dark:ring-white/10 ${contractBoxClass}`}
        >
          {pick ? (
            <div className="space-y-2.5 text-xs text-slate-600 dark:text-slate-300 min-w-0">
              <div className={`font-bold ${contractTitleClass}`}>{t('مرتبط بعقد')}</div>
              <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1 break-words">
                <span>{t('رقم العقد:')}</span>
                <span className="font-mono break-all">
                  #{formatContractNumberShort(pick.رقم_العقد)}
                </span>
                {linkedProperty?.الكود_الداخلي ? (
                  <>
                    <span className="text-slate-400 dark:text-slate-500" aria-hidden>
                      •
                    </span>
                    <span>{t('الكود الداخلي:')}</span>
                    <span className="font-mono break-all">{linkedProperty.الكود_الداخلي}</span>
                  </>
                ) : null}
              </div>
              {ownerContract || guarantorContract ? (
                <>
                  <div className="break-words leading-relaxed">
                    <span className="font-semibold text-slate-500 dark:text-slate-400">
                      {t('المستأجر:')}
                    </span>{' '}
                    <span className="font-semibold text-slate-800 dark:text-slate-100">
                      {tenantName}
                    </span>
                  </div>
                  {guarantorName ? (
                    <div className="break-words leading-relaxed">
                      <span className="font-semibold text-slate-500 dark:text-slate-400">
                        {t('الكفيل:')}
                      </span>{' '}
                      <span className="font-semibold text-slate-800 dark:text-slate-100">
                        {guarantorName}
                      </span>
                    </div>
                  ) : null}
                </>
              ) : tenantContract ? (
                <div className="break-words leading-relaxed">
                  {guarantorName ? (
                    <>
                      <span className="font-semibold text-slate-500 dark:text-slate-400">
                        {t('الكفيل:')}
                      </span>{' '}
                      <span className="font-semibold text-slate-800 dark:text-slate-100">
                        {guarantorName}
                      </span>
                    </>
                  ) : (
                    t('الكفيل: —')
                  )}
                </div>
              ) : null}
            </div>
          ) : (
            <div className="text-xs text-slate-500 dark:text-slate-400 break-words">
              {t('غير مرتبط بعقد حالياً')}
            </div>
          )}
        </div>

        {showDynamicColumns && dynamicFields.length > 0
          ? (() => {
              const values = person.حقول_ديناميكية || {};
              const visible = dynamicFields
                .map((f) => ({ f, v: values?.[f.name] }))
                .filter(({ v }) => !isEmptyDynamicValue(v));

              if (!visible.length) return null;

              return (
                <div className="mb-4 rounded-2xl border border-slate-200/80 dark:border-slate-700/80 bg-slate-50/80 dark:bg-slate-950/40 p-3.5">
                  <div className="text-xs font-black text-slate-600 dark:text-slate-300 mb-2 tracking-tight">
                    {t('حقول إضافية')}
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                    {visible.map(({ f, v }) => (
                      <div key={f.id} className="text-xs text-slate-600 dark:text-slate-300">
                        <span className="font-bold text-slate-500 dark:text-slate-400">
                          {f.label}:
                        </span>{' '}
                        <span className="font-semibold text-slate-800 dark:text-white">
                          {formatDynamicValue(f.type, v)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })()
          : null}

        <div className="flex flex-col gap-2 pt-4 mt-auto border-t border-slate-200/80 dark:border-slate-700/80 md:flex-row md:items-center md:justify-between bg-slate-50/40 dark:bg-slate-950/25 -mx-5 -mb-5 px-5 py-4 rounded-b-2xl md:rounded-b-[1.75rem]">
          <Button
            size="sm"
            variant="outline"
            className="flex-1 justify-center gap-2 whitespace-normal min-w-0 sm:min-w-[140px] rounded-xl border-slate-200 dark:border-slate-600 shadow-sm hover:border-indigo-300 dark:hover:border-indigo-500/50"
            onClick={() => openPanel('PERSON_DETAILS', person.رقم_الشخص)}
            title={t('تفاصيل الشخص')}
            aria-label={t('تفاصيل الشخص')}
            rightIcon={<Eye size={14} className="shrink-0" />}
            leftIcon={<ArrowRight size={14} className="shrink-0 opacity-80" />}
          >
            {t('التفاصيل')}
          </Button>

          <div className="flex flex-wrap justify-end gap-1">
            <RBACGuard requiredPermission="EDIT_PERSON">
              <Button
                size="icon"
                variant="ghost"
                title={t('تعديل')}
                aria-label={t('تعديل')}
                onClick={() => handleOpenForm(person.رقم_الشخص)}
              >
                <Edit2 size={16} />
              </Button>
            </RBACGuard>

            <RBACGuard requiredPermission="DELETE_PERSON">
              <Button
                size="icon"
                variant="ghost"
                className="text-red-500 hover:text-red-700 hover:bg-red-50"
                title={t('حذف')}
                aria-label={t('حذف')}
                onClick={() => handleDelete(person.رقم_الشخص)}
              >
                <Trash2 size={16} />
              </Button>
            </RBACGuard>

            <RBACGuard requiredRole="Admin">
              {!isBlacklisted && (
                <Button
                  size="icon"
                  variant="ghost"
                  className="text-red-400 hover:text-red-600 hover:bg-red-50"
                  title={t('إضافة للقائمة السوداء')}
                  aria-label={t('إضافة للقائمة السوداء')}
                  onClick={() => handleBlacklist(person.رقم_الشخص)}
                >
                  <Ban size={16} />
                </Button>
              )}
            </RBACGuard>

            <Button
              size="sm"
              variant="ghost"
              className="gap-1.5 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 dark:hover:bg-emerald-950/40"
              title={t('واتساب')}
              aria-label={t('واتساب')}
              onClick={() =>
                void openWhatsAppForPhones('', [person.رقم_الهاتف, person.رقم_هاتف_اضافي], {
                  defaultCountryCode: getDefaultWhatsAppCountryCodeSync(),
                  delayMs: 10_000,
                })
              }
            >
              <MessageCircle size={16} className="shrink-0" aria-hidden />
              <span className="hidden sm:inline">{t('واتساب')}</span>
            </Button>

            <Button
              size="icon"
              variant="ghost"
              className="text-sky-600 hover:text-sky-700 hover:bg-sky-50 dark:hover:bg-sky-950/40"
              title={t('اتصال')}
              aria-label={t('اتصال')}
              disabled={!phoneDigitsForTel([person.رقم_الهاتف, person.رقم_هاتف_اضافي])}
              onClick={() => {
                const d = phoneDigitsForTel([person.رقم_الهاتف, person.رقم_هاتف_اضافي]);
                if (d) window.location.href = `tel:${d}`;
              }}
            >
              <Phone size={16} />
            </Button>

            <Button
              size="sm"
              variant="ghost"
              className="text-indigo-600 hover:text-indigo-700 hover:bg-indigo-50"
              title={t('تذكير مرتبط بتاريخ وملاحظة')}
              onClick={() => void handleQuickReminderForPerson(person)}
            >
              <span className="inline-flex items-center gap-2">
                <ListTodo size={16} /> {t('تذكير')}
              </span>
            </Button>
          </div>
        </div>
      </div>
    </Card>
  );
}

export type PersonListingCardDesktopProps = {
  row: PeoplePickerItem;
  getPrimaryRole: (roles: string[]) => string;
  getRoleClasses: (role: string) => RoleClasses;
  showDynamicColumns: boolean;
  dynamicFields: DynamicFormField[];
  tr: (text: string) => string;
  t: (key: string, options?: Record<string, unknown>) => string;
  openPanel: (panelId: string, payload?: unknown, options?: unknown) => void;
  handleOpenForm: (id?: string) => void;
  handleDelete: (id: string) => void;
  handleBlacklist: (id: string) => void;
  handleQuickReminderForPerson: (person: الأشخاص_tbl) => void | Promise<void>;
  isDeleting?: boolean;
};

export function PersonListingCardDesktop({
  row,
  getPrimaryRole,
  getRoleClasses,
  showDynamicColumns,
  dynamicFields,
  tr: _tr,
  t,
  openPanel,
  handleOpenForm,
  handleDelete,
  handleBlacklist,
  handleQuickReminderForPerson,
  isDeleting,
}: PersonListingCardDesktopProps) {
  const person = row.person;
  const roles = Array.isArray(row?.roles) ? row.roles : [];
  const isBlacklisted = !!row?.isBlacklisted;
  const primaryRole = getPrimaryRole(roles);
  const accent = getRoleClasses(primaryRole);
  const personColor = getPersonColorClasses(getPersonSeedFromPerson(person));

  const roleVisual = (() => {
    if (isBlacklisted) {
      return { stripe: 'bg-red-500/25 dark:bg-red-400/20', dot: 'bg-red-500' };
    }
    if (primaryRole === 'مالك') {
      return { stripe: 'bg-emerald-500/20 dark:bg-emerald-400/15', dot: 'bg-emerald-500' };
    }
    if (primaryRole === 'مستأجر') {
      return { stripe: 'bg-indigo-500/20 dark:bg-indigo-400/15', dot: 'bg-indigo-500' };
    }
    if (primaryRole === 'كفيل') {
      return { stripe: 'bg-amber-500/20 dark:bg-amber-400/15', dot: 'bg-amber-500' };
    }
    return { stripe: personColor.stripe, dot: personColor.dot };
  })();

  const roleRing =
    primaryRole === 'مالك'
      ? 'ring-2 ring-emerald-500/10 border-emerald-500/20'
      : primaryRole === 'مستأجر'
        ? 'ring-2 ring-indigo-500/10 border-indigo-500/20'
        : primaryRole === 'كفيل'
          ? 'ring-2 ring-amber-500/10 border-amber-500/20'
          : '';

  const link = row?.link || null;
  const isLinkedToContract = !!link?.contractId;
  const contractBoxClass = isLinkedToContract
    ? 'border-indigo-200 dark:border-indigo-500/30 bg-indigo-50 dark:bg-indigo-900/20'
    : 'border-gray-100 dark:border-slate-700 bg-gray-50 dark:bg-slate-900/40';
  const contractTitleClass = isLinkedToContract
    ? 'text-indigo-700 dark:text-indigo-200'
    : 'text-slate-700 dark:text-slate-200';

  const contractNo = link?.contractId ? formatContractNumberShort(String(link.contractId)) : '';
  const propertyCode = String(link?.propertyCode || '').trim();
  const tenantName = String(link?.tenantName || '').trim();
  const guarantorName = String(link?.guarantorName || '').trim();
  const source = String(link?.source || '').trim();

  return (
    <Card
      className={`group w-full animate-slide-up ${personCardShellClasses} ${roleRing} ${isBlacklisted ? 'ring-2 ring-red-500/25 border-red-400/40 dark:border-red-500/30' : ''} ${isDeleting ? 'animate-pulse opacity-90' : ''}`}
    >
      <div className={`h-1.5 w-full shrink-0 ${roleVisual.stripe}`} aria-hidden />
      <div className="p-5 md:p-6 flex flex-col h-full min-h-0">
        <div className="flex items-start justify-between gap-3 mb-4">
          <div className="flex items-center gap-3 min-w-0">
            <div
              className={`w-12 h-12 rounded-2xl flex items-center justify-center text-xl font-bold shadow-md ring-2 ring-white/70 dark:ring-slate-800/80 shrink-0 ${isBlacklisted ? 'bg-red-100 text-red-600' : accent.avatar}`}
            >
              {(person.الاسم || 'غ').charAt(0)}
            </div>
            <div className="min-w-0 flex-1">
              <div className="rounded-2xl border border-slate-200/70 dark:border-slate-700/80 bg-white/70 dark:bg-slate-900/50 backdrop-blur-sm px-3 py-2.5 shadow-sm">
                <div className="flex items-start gap-2 min-w-0">
                  <span
                    className={`inline-block w-2.5 h-2.5 rounded-full mt-1 flex-shrink-0 ${roleVisual.dot}`}
                  ></span>
                  <div className="min-w-0">
                    <div className="text-sm font-bold text-slate-900 dark:text-white leading-snug whitespace-normal break-words">
                      {person.الاسم || t('غير محدد')}
                    </div>
                    <div className="mt-1 flex flex-wrap items-center gap-2 text-[10px] text-slate-500 dark:text-slate-400">
                      {person.نوع_الملف === 'منشأة' ? (
                        <span className="px-2 py-0.5 rounded-lg border bg-gray-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-gray-200 dark:border-slate-700">
                          {t('منشأة')}
                        </span>
                      ) : null}
                      {isBlacklisted ? (
                        <span className="inline-flex items-center gap-1 text-red-600 dark:text-red-300">
                          <ShieldAlert size={14} /> {t('قائمة سوداء')}
                        </span>
                      ) : null}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <PersonQuickInfoStrip person={person} t={t} />

        <div
          className={`mb-4 min-w-0 rounded-xl border p-4 shadow-inner ring-1 ring-slate-900/5 dark:ring-white/10 ${contractBoxClass}`}
        >
          {isLinkedToContract ? (
            <div className="space-y-2.5 text-xs text-slate-600 dark:text-slate-300 min-w-0">
              <div className={`font-bold ${contractTitleClass}`}>{t('مرتبط بعقد')}</div>
              <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1 break-words">
                <span>{t('رقم العقد:')}</span>
                <span className="font-mono break-all">#{contractNo}</span>
                {propertyCode ? (
                  <>
                    <span className="text-slate-400 dark:text-slate-500" aria-hidden>
                      •
                    </span>
                    <span>{t('الكود الداخلي:')}</span>
                    <span className="font-mono break-all">{propertyCode}</span>
                  </>
                ) : null}
              </div>
              {source === 'owner' || source === 'guarantor' ? (
                <>
                  <div className="break-words leading-relaxed">
                    <span className="font-semibold text-slate-500 dark:text-slate-400">
                      {t('المستأجر:')}
                    </span>{' '}
                    <span className="font-semibold text-slate-800 dark:text-slate-100">
                      {tenantName || t('غير معروف')}
                    </span>
                  </div>
                  {guarantorName ? (
                    <div className="break-words leading-relaxed">
                      <span className="font-semibold text-slate-500 dark:text-slate-400">
                        {t('الكفيل:')}
                      </span>{' '}
                      <span className="font-semibold text-slate-800 dark:text-slate-100">
                        {guarantorName}
                      </span>
                    </div>
                  ) : null}
                </>
              ) : source === 'tenant' ? (
                <div className="break-words leading-relaxed">
                  {guarantorName ? (
                    <>
                      <span className="font-semibold text-slate-500 dark:text-slate-400">
                        {t('الكفيل:')}
                      </span>{' '}
                      <span className="font-semibold text-slate-800 dark:text-slate-100">
                        {guarantorName}
                      </span>
                    </>
                  ) : (
                    t('الكفيل: —')
                  )}
                </div>
              ) : null}
            </div>
          ) : (
            <div className="text-xs text-slate-500 dark:text-slate-400 break-words">
              {t('غير مرتبط بعقد حالياً')}
            </div>
          )}
        </div>

        {showDynamicColumns && dynamicFields.length > 0
          ? (() => {
              const values = person.حقول_ديناميكية || {};
              const visible = dynamicFields
                .map((f) => ({ f, v: values?.[f.name] }))
                .filter(({ v }) => !isEmptyDynamicValue(v));
              if (!visible.length) return null;
              return (
                <div className="mb-4 rounded-2xl border border-slate-200/80 dark:border-slate-700/80 bg-slate-50/80 dark:bg-slate-950/40 p-3.5">
                  <div className="text-xs font-black text-slate-600 dark:text-slate-300 mb-2 tracking-tight">
                    {t('حقول إضافية')}
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                    {visible.map(({ f, v }) => (
                      <div key={f.id} className="text-xs text-slate-600 dark:text-slate-300">
                        <span className="font-bold text-slate-500 dark:text-slate-400">
                          {f.label}:
                        </span>{' '}
                        <span className="font-semibold text-slate-800 dark:text-white">
                          {formatDynamicValue(f.type, v)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })()
          : null}

        <div className="flex flex-col gap-2 pt-4 mt-auto border-t border-slate-200/80 dark:border-slate-700/80 md:flex-row md:items-center md:justify-between bg-slate-50/40 dark:bg-slate-950/25 -mx-5 -mb-5 px-5 py-4 rounded-b-2xl md:rounded-b-[1.75rem]">
          <Button
            size="sm"
            variant="outline"
            className="flex-1 justify-center gap-2 whitespace-normal min-w-0 sm:min-w-[140px] rounded-xl border-slate-200 dark:border-slate-600 shadow-sm hover:border-indigo-300 dark:hover:border-indigo-500/50"
            onClick={() => openPanel('PERSON_DETAILS', person.رقم_الشخص)}
            title={t('تفاصيل الشخص')}
            aria-label={t('تفاصيل الشخص')}
            rightIcon={<Eye size={14} className="shrink-0" />}
            leftIcon={<ArrowRight size={14} className="shrink-0 opacity-80" />}
          >
            {t('التفاصيل')}
          </Button>

          <div className="flex flex-wrap justify-end gap-1">
            <RBACGuard requiredPermission="EDIT_PERSON">
              <Button
                size="icon"
                variant="ghost"
                title={t('تعديل')}
                aria-label={t('تعديل')}
                onClick={() => handleOpenForm(person.رقم_الشخص)}
              >
                <Edit2 size={16} />
              </Button>
            </RBACGuard>

            <RBACGuard requiredPermission="DELETE_PERSON">
              <Button
                size="icon"
                variant="ghost"
                className="text-red-500 hover:text-red-700 hover:bg-red-50"
                title={t('حذف')}
                aria-label={t('حذف')}
                onClick={() => handleDelete(person.رقم_الشخص)}
              >
                <Trash2 size={16} />
              </Button>
            </RBACGuard>

            <RBACGuard requiredRole="Admin">
              {!isBlacklisted && (
                <Button
                  size="icon"
                  variant="ghost"
                  className="text-red-400 hover:text-red-600 hover:bg-red-50"
                  title={t('إضافة للقائمة السوداء')}
                  aria-label={t('إضافة للقائمة السوداء')}
                  onClick={() => handleBlacklist(person.رقم_الشخص)}
                >
                  <Ban size={16} />
                </Button>
              )}
            </RBACGuard>

            <Button
              size="sm"
              variant="ghost"
              className="gap-1.5 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 dark:hover:bg-emerald-950/40"
              title={t('واتساب')}
              aria-label={t('واتساب')}
              onClick={() =>
                void openWhatsAppForPhones('', [person.رقم_الهاتف, person.رقم_هاتف_اضافي], {
                  defaultCountryCode: getDefaultWhatsAppCountryCodeSync(),
                  delayMs: 10_000,
                })
              }
            >
              <MessageCircle size={16} className="shrink-0" aria-hidden />
              <span className="hidden sm:inline">{t('واتساب')}</span>
            </Button>

            <Button
              size="icon"
              variant="ghost"
              className="text-sky-600 hover:text-sky-700 hover:bg-sky-50 dark:hover:bg-sky-950/40"
              title={t('اتصال')}
              aria-label={t('اتصال')}
              disabled={!phoneDigitsForTel([person.رقم_الهاتف, person.رقم_هاتف_اضافي])}
              onClick={() => {
                const d = phoneDigitsForTel([person.رقم_الهاتف, person.رقم_هاتف_اضافي]);
                if (d) window.location.href = `tel:${d}`;
              }}
            >
              <Phone size={16} />
            </Button>

            <Button
              size="sm"
              variant="ghost"
              className="text-indigo-600 hover:text-indigo-700 hover:bg-indigo-50"
              title={t('تذكير مرتبط بتاريخ وملاحظة')}
              onClick={() => void handleQuickReminderForPerson(person)}
            >
              <span className="inline-flex items-center gap-2">
                <ListTodo size={16} /> {t('تذكير')}
              </span>
            </Button>
          </div>
        </div>
      </div>
    </Card>
  );
}
