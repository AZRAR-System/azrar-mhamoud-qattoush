import { memo } from 'react';
import {
  FileText,
  Eye,
  Pencil,
  Trash2,
  Archive,
  ArrowRight,
  FileCheck,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { formatCurrencyJOD } from '@/utils/format';
import { RBACGuard } from '@/components/shared/RBACGuard';
import type { العقود_tbl } from '@/types';

type Props = {
  contract: العقود_tbl;
  propCode: string;
  tenantName: string;
  ownerName: string;
  remainingAmount: number;
  onOpenDetails: (id: string | number) => void;
  onOpenClearance: (id: string | number) => void;
  onArchive: (id: string | number) => void;
  onEdit: (id: string | number) => void;
  onDelete: (id: string | number) => void;
  isDeleting?: boolean;
};

export const ContractCard = memo(
  ({
    contract,
    propCode,
    tenantName,
    ownerName,
    remainingAmount,
    onOpenDetails,
    onOpenClearance,
    onArchive,
    onEdit,
    onDelete,
    isDeleting,
  }: Props) => {
    const { t } = useTranslation();

    const contractNumber = String(contract.رقم_العقد);
    const opportunityNumberText = String(contract.رقم_الفرصة || '');

    const status = contract.حالة_العقد;
    const accentRing =
      status === 'نشط' || status === 'قريب الانتهاء'
        ? 'ring-2 ring-emerald-500/10 border-emerald-500/20'
        : status === 'منتهي'
          ? 'ring-2 ring-slate-400/10 border-slate-400/20'
          : status === 'مفسوخ' || status === 'ملغي'
            ? 'ring-2 ring-red-500/10 border-red-500/20'
            : status === 'مجدد'
              ? 'ring-2 ring-indigo-500/10 border-indigo-500/20'
              : '';

    const accentIcon =
      status === 'نشط' || status === 'قريب الانتهاء'
        ? 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-300'
        : status === 'منتهي'
          ? 'bg-slate-50 dark:bg-slate-900/20 text-slate-600 dark:text-slate-300'
          : status === 'مفسوخ' || status === 'ملغي'
            ? 'bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-300'
            : status === 'مجدد'
              ? 'bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-300'
              : 'bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-300';

    return (
      <Card
        className={`relative overflow-hidden transition-all duration-300 hover:shadow-xl hover:-translate-y-0.5 border border-white/60 dark:border-slate-700/60 bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm ${accentRing} ${
          isDeleting ? 'opacity-50 grayscale' : ''
        }`}
      >
        <div className="absolute inset-x-0 top-0 h-0.5 bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 opacity-70" />
        <div className="p-4 flex flex-col h-full">
          <div className="flex items-start justify-between mb-4">
            <div className="flex items-center gap-3 min-w-0">
              <div
                className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 shadow-md ${accentIcon} shadow-current/20`}
              >
                <FileText size={20} />
              </div>
              <div className="min-w-0">
                <div className="space-y-2">
                  <div className="rounded-xl border border-slate-200/40 dark:border-slate-700/40 bg-gradient-to-br from-slate-50/80 to-white/60 dark:from-slate-900/40 dark:to-slate-800/30 backdrop-blur-sm p-3">
                    <div className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-3 gap-y-2 items-start">
                      <div className="text-[10px] text-slate-400 whitespace-nowrap pt-0.5">
                        {t('المالك')}
                      </div>
                      <div className="text-sm font-bold text-slate-900 dark:text-white whitespace-normal break-words leading-snug">
                        {ownerName || '—'}
                      </div>

                      <div className="h-px col-span-2 bg-slate-200/60 dark:bg-slate-700/60" />

                      <div className="text-[10px] text-slate-400 whitespace-nowrap pt-0.5">
                        {t('المستأجر')}
                      </div>
                      <div className="text-sm font-bold text-slate-900 dark:text-white whitespace-normal break-words leading-snug">
                        {tenantName || '—'}
                      </div>
                    </div>
                  </div>

                  <div className="text-[11px] text-slate-500 dark:text-slate-400 flex flex-wrap items-center gap-x-3 gap-y-1">
                    <div className="whitespace-normal break-words">
                      <span className="font-bold text-slate-500 dark:text-slate-400">
                        {t('العقار')}:
                      </span>{' '}
                      <span className="font-mono text-slate-700 dark:text-slate-300">
                        {propCode}
                      </span>
                    </div>
                    <div className="whitespace-normal break-words">
                      <span className="font-bold text-slate-500 dark:text-slate-400">
                        {t('رقم الفرصة')}:
                      </span>{' '}
                      <span
                        className="font-mono text-slate-700 dark:text-slate-300 whitespace-normal break-words"
                        dir="ltr"
                      >
                        {opportunityNumberText || '—'}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            <StatusBadge status={contract.حالة_العقد} className="scale-90 origin-top-right" />
          </div>

          <div className="text-xs text-slate-500 dark:text-slate-400 mb-3">
            <div className="flex items-center gap-1 flex-wrap">
              <span className="text-green-600 font-bold">{t('من')}:</span>{' '}
              <span className="font-mono">{contract.تاريخ_البداية}</span>
              <span className="mx-1">•</span>
              <span className="text-red-600 font-bold">{t('إلى')}:</span>{' '}
              <span className="font-mono">{contract.تاريخ_النهاية}</span>
            </div>
          </div>

          <div className="mt-auto pt-4 border-t border-gray-100 dark:border-slate-700 space-y-3">
            <div className="flex flex-wrap items-center gap-4">
              <div>
                <div className="text-[11px] font-bold text-slate-500 dark:text-slate-400">
                  {t('مبلغ العقد')}
                </div>
                <div className="font-bold text-green-600 whitespace-nowrap">
                  {formatCurrencyJOD(contract.القيمة_السنوية)}
                </div>
              </div>
              <div>
                <div className="text-[11px] font-bold text-slate-500 dark:text-slate-400">
                  {t('المتبقي')}
                </div>
                <div className="font-bold text-orange-600 whitespace-nowrap">
                  {formatCurrencyJOD(remainingAmount || 0)}
                </div>
              </div>
            </div>

            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <Button
                size="sm"
                variant="outline"
                className="flex-1 justify-center gap-2 whitespace-normal min-w-0 sm:min-w-[140px] rounded-xl shadow-sm"
                onClick={() => onOpenDetails(contract.رقم_العقد)}
                title={t('فتح تفاصيل العقد')}
                aria-label={t('فتح تفاصيل العقد')}
                rightIcon={<Eye size={14} className="shrink-0" />}
                leftIcon={<ArrowRight size={14} className="shrink-0 opacity-80" />}
              >
                {t('التفاصيل')}
              </Button>

              <div className="flex flex-wrap justify-end gap-1">
                <RBACGuard requiredPermission="EDIT_CONTRACT">
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => onEdit(contract.رقم_العقد)}
                    className="h-8 w-8 rounded-lg hover:bg-emerald-50 text-emerald-600"
                    title={t('تعديل العقد')}
                    aria-label={t('تعديل العقد')}
                  >
                    <Pencil size={16} />
                  </Button>
                </RBACGuard>

                {contract.حالة_العقد === 'مفسوخ' && (
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => onOpenClearance(contract.رقم_العقد)}
                    className="h-8 w-8 rounded-lg hover:bg-orange-50 text-orange-600"
                    title={t('مخالصة')}
                    aria-label={t('مخالصة')}
                  >
                    <FileCheck size={16} />
                  </Button>
                )}

                {(contract.حالة_العقد === 'منتهي' || contract.حالة_العقد === 'مفسوخ') &&
                  !contract.isArchived && (
                    <RBACGuard requiredPermission="DELETE_CONTRACT">
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => onArchive(contract.رقم_العقد)}
                        className="h-8 w-8 rounded-lg hover:bg-slate-100 text-slate-500"
                        title={t('أرشفة')}
                        aria-label={t('أرشفة')}
                      >
                        <Archive size={16} />
                      </Button>
                    </RBACGuard>
                  )}

                <RBACGuard requiredPermission="DELETE_CONTRACT">
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => onDelete(contract.رقم_العقد)}
                    className="h-8 w-8 rounded-lg hover:bg-red-50 text-red-600"
                    title={t('حذف العقد')}
                    aria-label={t('حذف العقد')}
                  >
                    <Trash2 size={16} />
                  </Button>
                </RBACGuard>
              </div>
            </div>
          </div>

          <div className="mt-3 pt-3 border-t border-gray-100 dark:border-slate-700 flex items-center justify-between gap-2">
            <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400">
              {t('رقم العقد')}
            </span>
            <button
              type="button"
              onClick={() => onOpenDetails(contract.رقم_العقد)}
              className="text-[11px] font-mono text-slate-600 dark:text-slate-300 hover:text-indigo-600 dark:hover:text-indigo-400"
              dir="ltr"
              title={t('فتح تفاصيل العقد')}
            >
              #{contractNumber}
            </button>
          </div>
        </div>
      </Card>
    );
  }
);
