import React from 'react';
import {
  MapPin,
  Edit2,
  Trash2,
  Home,
  Eye,
  Zap,
  Droplets,
  Briefcase,
  ArrowRight,
} from 'lucide-react';
import type { DynamicFormField, العقارات_tbl } from '@/types';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { ExpandableText } from '@/components/ui/ExpandableText';
import { RBACGuard } from '@/components/shared/RBACGuard';
import { formatDynamicValue, isEmptyDynamicValue } from '@/components/dynamic/dynamicValue';
import { formatContractNumberShort } from '@/utils/contractNumber';
import type { PropertyExtras } from '@/components/properties/propertiesTypes';

export type PropertyListingCardProps = {
  property: العقارات_tbl;
  hasActive: boolean;
  ownerColorDotClass: string;
  ownerName: string;
  tenantName: string;
  tenantPhone: string;
  contractId: string;
  guarantorName: string;
  guarantorPhone: string;
  showGuarantorBlock: boolean;
  isFurnished: boolean;
  isEmpty: boolean;
  visualStripeClass: string;
  visualRingClass: string;
  accentIcon: string;
  showDynamicColumns: boolean;
  dynamicFields: DynamicFormField[];
  tr: (s: string) => string;
  t: (key: string, options?: Record<string, unknown>) => string;
  openPanel: (panelId: string, payload?: unknown, options?: unknown) => void;
  handleOpenForm: (id?: string) => void;
  handleDelete: (id: string) => void;
  quickListForSale: (propertyId: string) => void;
};

export const PropertyListingCard = React.memo(
  ({
    property: p,
    hasActive,
    ownerColorDotClass,
    ownerName,
    tenantName,
    tenantPhone,
    contractId,
    guarantorName,
    guarantorPhone,
    showGuarantorBlock,
    isFurnished,
    isEmpty,
    visualStripeClass,
    visualRingClass,
    accentIcon,
    showDynamicColumns,
    dynamicFields,
    tr,
    t,
    openPanel,
    handleOpenForm,
    handleDelete,
    quickListForSale,
  }: PropertyListingCardProps) => {
    return (
      <Card className={`group w-full animate-slide-up ${visualRingClass}`}>
        <div className={`h-1 w-full ${visualStripeClass}`}></div>
        <div className="p-5 flex flex-col h-full">
          <div className="flex justify-between items-start mb-4">
            <div className="flex items-center gap-3">
              <div
                className={`w-12 h-12 rounded-xl ${accentIcon} flex items-center justify-center font-bold text-xl shadow-sm`}
              >
                <Home size={22} />
              </div>
              <div>
                <h3 className="font-bold text-slate-800 dark:text-white font-mono text-base">
                  {p.الكود_الداخلي}
                </h3>
                <p className="text-xs text-slate-500">
                  {tr(String(p.النوع || ''))} - {p.المساحة} {t('م²')}
                </p>
                <div className="mt-1 flex flex-wrap items-center gap-2">
                  {isFurnished ? (
                    <span className="inline-flex items-center text-[10px] px-2 py-0.5 rounded-lg border border-amber-200 dark:border-amber-500/30 bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-200 font-bold">
                      {t('مفروش')}
                    </span>
                  ) : isEmpty ? (
                    <span className="inline-flex items-center text-[10px] px-2 py-0.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/40 text-slate-700 dark:text-slate-200 font-bold">
                      {t('فارغ')}
                    </span>
                  ) : null}

                  {hasActive ? (
                    <span className="inline-flex items-center text-[10px] px-2 py-0.5 rounded-lg border border-indigo-200 dark:border-indigo-500/30 bg-indigo-50 dark:bg-indigo-900/20 text-indigo-700 dark:text-indigo-200 font-bold">
                      {t('مرتبط بعقد')}
                    </span>
                  ) : (
                    <span className="inline-flex items-center text-[10px] px-2 py-0.5 rounded-lg border border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-900/40 text-slate-600 dark:text-slate-300 font-bold">
                      {t('غير مرتبط بعقد')}
                    </span>
                  )}
                </div>
              </div>
            </div>
            <StatusBadge status={p.حالة_العقار} />
          </div>

          <div className="space-y-3 mb-5 flex-1">
            <div className="rounded-xl border border-slate-200/60 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/20 p-3">
              <div className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-3 gap-y-2 items-start">
                <div className="text-[10px] text-slate-400 whitespace-nowrap pt-0.5">
                  {t('المالك')}
                </div>
                <div className="text-sm font-bold text-slate-900 dark:text-white whitespace-normal break-words leading-snug">
                  <span
                    className={`inline-block w-2.5 h-2.5 rounded-full ${ownerColorDotClass} align-middle ml-2`}
                  ></span>
                  {ownerName || '—'}
                </div>

                <div className="h-px col-span-2 bg-slate-200/60 dark:bg-slate-700/60" />

                <div className="text-[10px] text-slate-400 whitespace-nowrap pt-0.5">
                  {t('المستأجر')}
                </div>
                <div className="text-sm font-bold text-slate-900 dark:text-white whitespace-normal break-words leading-snug">
                  {hasActive ? tenantName || t('غير معروف') : '—'}
                </div>

                {hasActive && (tenantPhone || contractId) ? (
                  <div className="col-span-2 text-xs text-slate-500 dark:text-slate-400 flex flex-wrap items-center gap-2">
                    {tenantPhone ? (
                      <span className="font-mono dir-ltr">{tenantPhone}</span>
                    ) : null}
                    {tenantPhone && contractId ? <span>•</span> : null}
                    {contractId ? (
                      <span>
                        {t('عقد #{{contract}}', {
                          contract: formatContractNumberShort(contractId),
                        })}
                      </span>
                    ) : null}
                  </div>
                ) : null}

                {showGuarantorBlock ? (
                  <>
                    <div className="h-px col-span-2 bg-slate-200/40 dark:bg-slate-700/40" />
                    <div className="text-[10px] text-slate-400 whitespace-nowrap pt-0.5">
                      {t('الكفيل')}
                    </div>
                    <div className="text-sm font-semibold text-slate-800 dark:text-slate-200 whitespace-normal break-words leading-snug">
                      {guarantorName || t('غير معروف')}
                      {guarantorPhone ? (
                        <span className="text-xs text-slate-500 dark:text-slate-400 font-mono dir-ltr mr-2">
                          {guarantorPhone}
                        </span>
                      ) : null}
                    </div>
                  </>
                ) : null}
              </div>
            </div>

            <div className="flex items-start gap-2 text-xs text-slate-600 dark:text-slate-400">
              <MapPin size={16} className="text-slate-400 flex-shrink-0 mt-0.5" />
              <div className="min-w-0 whitespace-normal break-words">
                {String(p.العنوان || '').trim() || '—'}
              </div>
            </div>

            <div className="flex gap-2 mt-2 flex-wrap">
              {p.رقم_اشتراك_الكهرباء && (
                <span className="text-[10px] px-1.5 py-0.5 rounded border flex items-center gap-1 bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-500/10 dark:text-amber-300 dark:border-amber-500/20">
                  <Zap size={10} /> {t('كهرباء')}
                </span>
              )}
              {p.رقم_اشتراك_المياه && (
                <span className="text-[10px] px-1.5 py-0.5 rounded border flex items-center gap-1 bg-cyan-50 text-cyan-700 border-cyan-200 dark:bg-cyan-500/10 dark:text-cyan-300 dark:border-cyan-500/20">
                  <Droplets size={10} /> {t('مياه')}
                </span>
              )}
              {p.isForSale && (
                <span className="text-[10px] px-1.5 py-0.5 rounded border flex items-center gap-1 font-bold bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-300 dark:border-emerald-500/20">
                  <Briefcase size={10} />{' '}
                  {(p as العقارات_tbl & PropertyExtras).isForRent === false
                    ? t('للبيع فقط')
                    : t('للبيع')}
                </span>
              )}
            </div>

            {showDynamicColumns && dynamicFields.length > 0
              ? (() => {
                  const values =
                    (p as العقارات_tbl & PropertyExtras)?.حقول_ديناميكية || {};
                  const visible = dynamicFields
                    .map((f) => ({ f, v: values?.[f.name] }))
                    .filter(({ v }) => !isEmptyDynamicValue(v));

                  if (!visible.length) return null;

                  return (
                    <div className="rounded-xl border border-slate-200/70 dark:border-slate-800 bg-white/70 dark:bg-slate-950/20 p-3">
                      <div className="text-xs font-bold text-slate-600 dark:text-slate-300 mb-2">
                        {t('حقول إضافية')}
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                        {visible.map(({ f, v }) => (
                          <div
                            key={f.id}
                            className="text-xs text-slate-600 dark:text-slate-300"
                          >
                            <span className="font-bold text-slate-500 dark:text-slate-400">
                              {f.label}:
                            </span>{' '}
                            <span className="inline-block min-w-0 align-middle">
                              <ExpandableText
                                value={formatDynamicValue(f.type, v)}
                                previewChars={36}
                                title={f.label}
                                className="font-semibold text-slate-800 dark:text-white"
                              />
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })()
              : null}
          </div>

          <div className="pt-4 border-t border-gray-100 dark:border-slate-700 flex gap-2">
            <Button
              size="sm"
              variant="outline"
              className="flex-1 justify-center gap-2 whitespace-normal min-w-0 sm:min-w-[140px] rounded-xl shadow-sm"
              onClick={() => openPanel('PROPERTY_DETAILS', p.رقم_العقار)}
              title={t('تفاصيل العقار')}
              aria-label={t('تفاصيل العقار')}
              rightIcon={<Eye size={14} className="shrink-0" />}
              leftIcon={<ArrowRight size={14} className="shrink-0 opacity-80" />}
            >
              {t('التفاصيل')}
            </Button>
            <RBACGuard requiredPermission="EDIT_PROPERTY">
              <Button
                size="icon"
                variant="ghost"
                className="text-emerald-500 hover:text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-500/10"
                onClick={() => quickListForSale(String(p.رقم_العقار))}
                title={t('عرض للبيع')}
                aria-label={t('عرض للبيع')}
              >
                <Briefcase size={16} />
              </Button>
              <Button
                size="icon"
                variant="ghost"
                onClick={() => handleOpenForm(p.رقم_العقار)}
              >
                <Edit2 size={16} />
              </Button>
            </RBACGuard>
            <RBACGuard requiredPermission="DELETE_PROPERTY">
              <Button
                size="icon"
                variant="ghost"
                className="text-red-400 hover:text-red-500 hover:bg-red-50"
                onClick={() => handleDelete(p.رقم_العقار)}
              >
                <Trash2 size={16} />
              </Button>
            </RBACGuard>
          </div>
        </div>
      </Card>
    );
  }
);

PropertyListingCard.displayName = 'PropertyListingCard';
