import React from 'react';
import {
  Trash2,
  Edit2,
  Phone,
  Eye,
  Ban,
  ShieldAlert,
  ArrowRight,
  ListTodo,
} from 'lucide-react';
import type { DynamicFormField, الأشخاص_tbl, العقود_tbl, العقارات_tbl } from '@/types';
import type { PeoplePickerItem } from '@/types/domain.types';
import { openWhatsAppForPhones } from '@/utils/whatsapp';
import { getDefaultWhatsAppCountryCodeSync } from '@/services/geoSettings';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { RBACGuard } from '@/components/shared/RBACGuard';
import { formatDynamicValue, isEmptyDynamicValue } from '@/components/dynamic/dynamicValue';
import { formatContractNumberShort } from '@/utils/contractNumber';
import { getPersonColorClasses, getPersonSeedFromPerson } from '@/utils/personColor';

type RoleClasses = { badge: string; avatar: string };

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
};

export function PersonListingCardWeb({
  person,
  roles,
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
  getRoleClasses,
  showDynamicColumns,
  dynamicFields,
  tr,
  t,
  openPanel,
  handleOpenForm,
  handleDelete,
  handleBlacklist,
  handleQuickReminderForPerson,
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
      className={`group w-full animate-slide-up ${roleRing} ${isBlacklisted ? 'ring-2 ring-red-500/20 border-red-500/30' : ''}`}
    >
      <div className={`h-1 w-full ${roleVisual.stripe}`}></div>
      <div className="p-5 flex flex-col h-full">
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-3">
            <div
              className={`w-12 h-12 rounded-2xl flex items-center justify-center text-xl font-bold shadow-inner ${isBlacklisted ? 'bg-red-100 text-red-600' : accent.avatar}`}
            >
              {(person.الاسم || 'غ').charAt(0)}
            </div>
            <div className="min-w-0">
              <div className="rounded-xl border border-slate-200/60 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/20 px-3 py-2">
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

                <div className="mt-2 text-xs text-slate-500 dark:text-slate-400 font-mono dir-ltr flex flex-wrap items-center gap-2">
                  <span>{person.رقم_الهاتف || t('لا يوجد')}</span>
                  {person.رقم_هاتف_اضافي ? (
                    <>
                      <span>•</span>
                      <span>{String(person.رقم_هاتف_اضافي)}</span>
                    </>
                  ) : null}
                </div>
              </div>
            </div>
          </div>
          {person.تصنيف && <StatusBadge status={person.تصنيف} />}
        </div>

        <div className="flex flex-wrap gap-1.5 mb-3 flex-1 content-start">
          {roles.map((r) => (
            <span
              key={r}
              className={`text-[10px] px-2.5 py-1 rounded-lg border font-medium ${getRoleClasses(r).badge}`}
            >
              {tr(r)}
            </span>
          ))}
        </div>

        <div className={`mb-4 rounded-xl border p-3 ${contractBoxClass}`}>
          {pick ? (
            <div className="space-y-1 text-xs text-slate-600 dark:text-slate-300">
              <div className={`font-bold ${contractTitleClass}`}>{t('مرتبط بعقد')}</div>
              <div>
                {t('رقم العقد:')}{' '}
                <span className="font-mono">#{formatContractNumberShort(pick.رقم_العقد)}</span>
                {linkedProperty?.الكود_الداخلي ? (
                  <>
                    {' '}
                    • {t('الكود الداخلي:')}{' '}
                    <span className="font-mono">{linkedProperty.الكود_الداخلي}</span>
                  </>
                ) : null}
              </div>
              {ownerContract || guarantorContract ? (
                <div>
                  {t('المستأجر:')} <span className="font-semibold">{tenantName}</span>
                  {guarantorName ? (
                    <>
                      {' '}
                      • {t('الكفيل:')} <span className="font-semibold">{guarantorName}</span>
                    </>
                  ) : null}
                </div>
              ) : tenantContract ? (
                <div>
                  {guarantorName ? (
                    <>
                      {t('الكفيل:')} <span className="font-semibold">{guarantorName}</span>
                    </>
                  ) : (
                    t('الكفيل: —')
                  )}
                </div>
              ) : null}
            </div>
          ) : (
            <div className="text-xs text-slate-500 dark:text-slate-400">
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
                <div className="mb-4 rounded-xl border border-gray-100 dark:border-slate-700 bg-white dark:bg-slate-900 p-3">
                  <div className="text-xs font-bold text-slate-600 dark:text-slate-300 mb-2">
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

        <div className="flex flex-col gap-2 pt-4 border-t border-gray-100 dark:border-slate-700 md:flex-row md:items-center">
          <Button
            size="sm"
            variant="outline"
            className="flex-1 justify-center gap-2 whitespace-normal min-w-0 sm:min-w-[140px] rounded-xl shadow-sm"
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
              size="icon"
              variant="ghost"
              className="text-green-500 hover:text-green-600 hover:bg-green-50"
              title={t('واتساب / اتصال')}
              aria-label={t('واتساب / اتصال')}
              onClick={() =>
                void openWhatsAppForPhones('', [person.رقم_الهاتف, person.رقم_هاتف_اضافي], {
                  defaultCountryCode: getDefaultWhatsAppCountryCodeSync(),
                  delayMs: 10_000,
                })
              }
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
};

export function PersonListingCardDesktop({
  row,
  getPrimaryRole,
  getRoleClasses,
  showDynamicColumns,
  dynamicFields,
  tr,
  t,
  openPanel,
  handleOpenForm,
  handleDelete,
  handleBlacklist,
  handleQuickReminderForPerson,
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
      className={`group w-full animate-slide-up ${roleRing} ${isBlacklisted ? 'ring-2 ring-red-500/20 border-red-500/30' : ''}`}
    >
      <div className={`h-1 w-full ${roleVisual.stripe}`}></div>
      <div className="p-5 flex flex-col h-full">
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-3">
            <div
              className={`w-12 h-12 rounded-2xl flex items-center justify-center text-xl font-bold shadow-inner ${isBlacklisted ? 'bg-red-100 text-red-600' : accent.avatar}`}
            >
              {(person.الاسم || 'غ').charAt(0)}
            </div>
            <div className="min-w-0">
              <div className="rounded-xl border border-slate-200/60 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/20 px-3 py-2">
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

                <div className="mt-2 text-xs text-slate-500 dark:text-slate-400 font-mono dir-ltr flex flex-wrap items-center gap-2">
                  <span>{person.رقم_الهاتف || t('لا يوجد')}</span>
                  {person.رقم_هاتف_اضافي ? (
                    <>
                      <span>•</span>
                      <span>{String(person.رقم_هاتف_اضافي)}</span>
                    </>
                  ) : null}
                </div>
              </div>
            </div>
          </div>
          {person.تصنيف && <StatusBadge status={person.تصنيف} />}
        </div>

        <div className="flex flex-wrap gap-1.5 mb-3 flex-1 content-start">
          {roles.map((r) => (
            <span
              key={r}
              className={`text-[10px] px-2.5 py-1 rounded-lg border font-medium ${getRoleClasses(r).badge}`}
            >
              {tr(r)}
            </span>
          ))}
        </div>

        <div className={`mb-4 rounded-xl border p-3 ${contractBoxClass}`}>
          {isLinkedToContract ? (
            <div className="space-y-1 text-xs text-slate-600 dark:text-slate-300">
              <div className={`font-bold ${contractTitleClass}`}>{t('مرتبط بعقد')}</div>
              <div>
                {t('رقم العقد:')} <span className="font-mono">#{contractNo}</span>
                {propertyCode ? (
                  <>
                    {' '}
                    • {t('الكود الداخلي:')} <span className="font-mono">{propertyCode}</span>
                  </>
                ) : null}
              </div>
              {source === 'owner' || source === 'guarantor' ? (
                <div>
                  {t('المستأجر:')}{' '}
                  <span className="font-semibold">{tenantName || t('غير معروف')}</span>
                  {guarantorName ? (
                    <>
                      {' '}
                      • {t('الكفيل:')} <span className="font-semibold">{guarantorName}</span>
                    </>
                  ) : null}
                </div>
              ) : source === 'tenant' ? (
                <div>
                  {guarantorName ? (
                    <>
                      {t('الكفيل:')} <span className="font-semibold">{guarantorName}</span>
                    </>
                  ) : (
                    t('الكفيل: —')
                  )}
                </div>
              ) : null}
            </div>
          ) : (
            <div className="text-xs text-slate-500 dark:text-slate-400">
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
                <div className="mb-4 rounded-xl border border-gray-100 dark:border-slate-700 bg-white dark:bg-slate-900 p-3">
                  <div className="text-xs font-bold text-slate-600 dark:text-slate-300 mb-2">
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

        <div className="flex flex-col gap-2 pt-4 border-t border-gray-100 dark:border-slate-700 md:flex-row md:items-center">
          <Button
            size="sm"
            variant="outline"
            className="flex-1 justify-center gap-2 whitespace-normal min-w-0 sm:min-w-[140px] rounded-xl shadow-sm"
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
              size="icon"
              variant="ghost"
              className="text-green-500 hover:text-green-600 hover:bg-green-50"
              title={t('واتساب / اتصال')}
              aria-label={t('واتساب / اتصال')}
              onClick={() =>
                void openWhatsAppForPhones('', [person.رقم_الهاتف, person.رقم_هاتف_اضافي], {
                  defaultCountryCode: getDefaultWhatsAppCountryCodeSync(),
                  delayMs: 10_000,
                })
              }
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
