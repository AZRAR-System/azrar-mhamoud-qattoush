/**
 * © 2025 - Developed by Mahmoud Qattoush
 * AZRAR Real Estate Management System - All Rights Reserved
 *
 * صفحة إدارة العقود (Contracts Management Page)
 * - عرض وإدارة جميع عقود الإيجار
 * - البحث والفلترة المتقدمة
 * - إدارة حالات العقود (نشط، منتهي، مفسوخ)
 * - التكامل الكامل مع DbService فقط (لا اعتماد عكسي)
 *
 * 📊 مصدر البيانات:
 * - DbService.getContracts() - جلب جميع العقود
 * - DbService.getPeople() - للحصول على أسماء المستأجرين
 * - DbService.getProperties() - للحصول على أكواد العقارات
 *
 * 🎯 متى يظهر EmptyState:
 * - عند عدم وجود عقود في النظام (contracts.length === 0)
 * - عند عدم وجود نتائج بحث (filteredContracts.length === 0 && searchTerm)
 * - عند عدم وجود نتائج فلترة (filteredContracts.length === 0 && filters)
 *
 * ⚠️ DataGuard:
 * - يُستخدم للتحقق من وجود أشخاص وعقارات قبل إنشاء عقد جديد
 * - يظهر رسالة تنبيه إذا لم تكن البيانات المطلوبة موجودة
 */

import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { DbService } from '@/services/mockDb';
import { العقود_tbl, الأشخاص_tbl, العقارات_tbl, الكمبيالات_tbl, type PaymentMethodType } from '@/types';
import { isTenancyRelevant } from '@/utils/tenancy';
import { exportToXlsx, readSpreadsheet, type XlsxColumn } from '@/utils/xlsx';
import { buildCompanyLetterheadSheet } from '@/utils/companySheet';
import {
    FileText,
    CheckCircle,
    Clock,
    AlertTriangle,
    Ban,
    FileCheck,
    Eye,
    ArrowRight,
    Archive,
    Download,
    SlidersHorizontal,
    Pencil,
    Trash2,
    Filter,
    X
} from 'lucide-react';
import { CalendarDays } from 'lucide-react';
import { useSmartModal } from '@/context/ModalContext';
import { useToast } from '@/context/ToastContext';
import { SmartFilterBar } from '@/components/shared/SmartFilterBar';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { Button } from '@/components/ui/Button';
import { RBACGuard } from '@/components/shared/RBACGuard';
import { EmptyState } from '@/components/shared/EmptyState';
import { SearchEngine, FilterRule } from '@/services/searchEngine';
import { Card } from '@/components/ui/Card';
import { formatContractNumberShort } from '@/utils/contractNumber';
import { getInstallmentPaidAndRemaining } from '@/utils/installments';
import { formatCurrencyJOD } from '@/utils/format';
import { useDbSignal } from '@/hooks/useDbSignal';
import { useResponsivePageSize } from '@/hooks/useResponsivePageSize';
import { SegmentedTabs } from '@/components/shared/SegmentedTabs';
import {
    contractPickerSearchPagedSmart,
    domainCountsSmart,
    peoplePickerSearchPagedSmart,
    propertyContractsSmart,
    propertyPickerSearchPagedSmart,
} from '@/services/domainQueries';
import type { ContractPickerItem, PeoplePickerItem, PropertyPickerItem } from '@/types/domain.types';

// Memoized Contract Card (Cards layout like People)
const ContractCard = React.memo(({
    contract,
    propCode,
    tenantName,
    ownerName,
    remainingAmount,
    onOpenDetails,
    onOpenClearance,
    onArchive,
    onEdit,
    onDelete
}: {
    contract: العقود_tbl;
    propCode: string;
    tenantName: string;
    ownerName: string;
    remainingAmount: number;
    onOpenDetails: (id: string) => void;
    onOpenClearance: (id: string) => void;
    onArchive: (id: string) => void;
    onEdit: (id: string) => void;
    onDelete: (id: string) => void;
}) => {
    const contractNumber = formatContractNumberShort(contract.رقم_العقد);
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
                        : 'bg-slate-50 dark:bg-slate-900/20 text-slate-600 dark:text-slate-300';

    return (
        <Card className={`group animate-slide-up ${accentRing}`}>
            <div className="p-5 flex flex-col h-full">
                <div className="flex justify-between items-start gap-3 mb-4">
                    <div className="flex items-start gap-3 min-w-0">
                        <div className={`w-12 h-12 rounded-xl ${accentIcon} flex items-center justify-center font-bold text-xl shadow-sm flex-shrink-0`}>
                            <FileText size={20} />
                        </div>
                        <div className="min-w-0">
                            <div className="text-xs text-slate-600 dark:text-slate-300 space-y-1">
                                <div className="whitespace-normal break-words">
                                    <span className="font-bold text-slate-500">العقار:</span> <span className="font-mono">{propCode}</span>
                                </div>
                                <div className="whitespace-normal break-words">
                                    <span className="font-bold text-slate-500">المالك:</span> <span className="font-semibold">{ownerName || '—'}</span>
                                </div>
                                <div className="whitespace-normal break-words">
                                    <span className="font-bold text-slate-500">المستأجر:</span> <span className="font-semibold">{tenantName || '—'}</span>
                                </div>
                                    {String(contract.رقم_الفرصة || '').trim() ? (
                                        <div className="whitespace-normal break-words">
                                            <span className="font-bold text-slate-500">رقم الفرصة:</span>{' '}
                                            <span className="font-mono">{String(contract.رقم_الفرصة || '').trim()}</span>
                                        </div>
                                    ) : null}
                            </div>
                        </div>
                    </div>
                    <StatusBadge status={contract.حالة_العقد} className="scale-90 origin-top-right" />
                </div>

                <div className="text-xs text-slate-500 dark:text-slate-400 mb-4">
                    <div className="flex items-center gap-1 flex-wrap">
                        <span className="text-green-600 font-bold">من:</span> <span className="font-mono">{contract.تاريخ_البداية}</span>
                        <span className="mx-1">•</span>
                        <span className="text-red-600 font-bold">إلى:</span> <span className="font-mono">{contract.تاريخ_النهاية}</span>
                    </div>
                </div>

                <div className="mt-auto pt-4 border-t border-gray-100 dark:border-slate-700 space-y-3">
                    <div className="flex flex-wrap items-center gap-4">
                        <div>
                            <div className="text-[11px] font-bold text-slate-500 dark:text-slate-400">مبلغ العقد</div>
                            <div className="font-bold text-green-600 whitespace-nowrap">
                                {formatCurrencyJOD(contract.القيمة_السنوية, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                            </div>
                        </div>
                        <div>
                            <div className="text-[11px] font-bold text-slate-500 dark:text-slate-400">المتبقي</div>
                            <div className="font-bold text-orange-600 whitespace-nowrap">
                                {formatCurrencyJOD(remainingAmount || 0, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                            </div>
                        </div>
                    </div>

                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                        <Button
                            size="sm"
                            variant="outline"
                            className="flex-1 justify-center gap-2 whitespace-nowrap min-w-[140px] rounded-xl shadow-sm"
                            onClick={() => onOpenDetails(contract.رقم_العقد)}
                            title="فتح تفاصيل العقد"
                            aria-label="فتح تفاصيل العقد"
                            rightIcon={<Eye size={14} className="shrink-0" />}
                            leftIcon={<ArrowRight size={14} className="shrink-0 opacity-80" />}
                        >
                            التفاصيل
                        </Button>

                        <div className="flex flex-wrap justify-end gap-1">
                            <RBACGuard requiredPermission="EDIT_CONTRACT">
                                <Button
                                    size="icon"
                                    variant="ghost"
                                    onClick={() => onEdit(contract.رقم_العقد)}
                                    className="h-8 w-8 rounded-lg hover:bg-emerald-50 text-emerald-600"
                                    title="تعديل العقد"
                                    aria-label="تعديل العقد"
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
                                    title="مخالصة"
                                    aria-label="مخالصة"
                                >
                                    <FileCheck size={16} />
                                </Button>
                            )}

                            {(contract.حالة_العقد === 'منتهي' || contract.حالة_العقد === 'مفسوخ') && !contract.isArchived && (
                                <RBACGuard requiredPermission="DELETE_CONTRACT">
                                    <Button
                                        size="icon"
                                        variant="ghost"
                                        onClick={() => onArchive(contract.رقم_العقد)}
                                        className="h-8 w-8 rounded-lg hover:bg-slate-100 text-slate-500"
                                        title="أرشفة"
                                        aria-label="أرشفة"
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
                                    title="حذف العقد"
                                    aria-label="حذف العقد"
                                >
                                    <Trash2 size={16} />
                                </Button>
                            </RBACGuard>
                        </div>
                    </div>
                </div>

                <div className="mt-3 pt-3 border-t border-gray-100 dark:border-slate-700 flex items-center justify-between gap-2">
                    <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400">رقم العقد</span>
                    <button
                        type="button"
                        onClick={() => onOpenDetails(contract.رقم_العقد)}
                        className="text-[11px] font-mono text-slate-600 dark:text-slate-300 hover:text-indigo-600 dark:hover:text-indigo-400"
                        dir="ltr"
                        title="فتح تفاصيل العقد"
                    >
                        #{contractNumber}
                    </button>
                </div>
            </div>
        </Card>
    );
});

export const Contracts: React.FC = () => {
    const pageSize = useResponsivePageSize({ base: 8, sm: 10, md: 12, lg: 18, xl: 24, '2xl': 32 });
  const [contracts, setContracts] = useState<العقود_tbl[]>([]);
  const [people, setPeople] = useState<الأشخاص_tbl[]>([]);
  const [properties, setProperties] = useState<العقارات_tbl[]>([]);
    const [installments, setInstallments] = useState<الكمبيالات_tbl[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
    const [activeStatus, setActiveStatus] = useState<'active' | 'expiring' | 'expired' | 'terminated' | 'archived'>('active');

    const [uiPage, setUiPage] = useState(0);

    const isDesktopFast = typeof window !== 'undefined' && !!window.desktopDb?.domainContractPickerSearch;
    const [desktopCounts, setDesktopCounts] = useState<{ people: number; properties: number; contracts: number } | null>(null);
    const [fastRows, setFastRows] = useState<ContractPickerItem[]>([]);
    const [fastTotal, setFastTotal] = useState(0);
    const [fastLoading, setFastLoading] = useState(false);
    const [fastError, setFastError] = useState<string>('');
    const [fastPage, setFastPage] = useState(1);
    const fastPageSize = pageSize;
    const [fastReload, setFastReload] = useState(0);
    const warnedFastErrorRef = useRef<string>('');

    // Support deep links: #/contracts?status=active|expiring|expired|terminated|archived&q=...
    const applyFiltersFromHash = useCallback(() => {
        try {
            const raw = String(window.location.hash || '').startsWith('#')
                ? String(window.location.hash || '').slice(1)
                : String(window.location.hash || '');
            const qIndex = raw.indexOf('?');
            const search = qIndex >= 0 ? raw.slice(qIndex + 1) : '';
            const params = new URLSearchParams(search);

            const status = (params.get('status') || params.get('tab') || '').trim();
            const allowed = ['active', 'expiring', 'expired', 'terminated', 'archived'] as const;
            if (status && (allowed as readonly string[]).includes(status)) {
                setActiveStatus(status as (typeof allowed)[number]);
            }

            // Optional prefilled search
            if (params.has('q')) {
                setSearchTerm(String(params.get('q') || ''));
            }
        } catch {
            // ignore
        }
    }, []);

    useEffect(() => {
        applyFiltersFromHash();
        window.addEventListener('hashchange', applyFiltersFromHash);
        return () => window.removeEventListener('hashchange', applyFiltersFromHash);
    }, [applyFiltersFromHash]);

    const importRef = useRef<HTMLInputElement>(null);

  
  // Advanced
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [advFilters, setAdvFilters] = useState({
      startDateFrom: '', startDateTo: '',
      endDateFrom: '', endDateTo: '',
      minValue: '', maxValue: '',
      createdMonth: ''
  });

    const currentMonthKey = useMemo(() => new Date().toISOString().slice(0, 7), []);
    const createdMonthApplied = useMemo(() => /^\d{4}-\d{2}$/.test(String(advFilters.createdMonth || '').trim()), [advFilters.createdMonth]);

  const { openPanel } = useSmartModal();
  const toast = useToast();
    const dbSignal = useDbSignal();
        const toastRef = useRef(toast);

        useEffect(() => {
                toastRef.current = toast;
        }, [toast]);

    // Create Maps for fast lookup
    const peopleMap = useMemo(() => new Map(people.map(p => [String(p.رقم_الشخص), p.الاسم])), [people]);
    const propsById = useMemo(() => new Map(properties.map(p => [String(p.رقم_العقار), p])), [properties]);
    const propsCodeMap = useMemo(() => new Map(properties.map(p => [String(p.رقم_العقار), p.الكود_الداخلي])), [properties]);

  const loadData = useCallback(() => {
        if (isDesktopFast) {
            // Desktop fast mode: avoid loading huge arrays into renderer memory.
            setContracts([]);
            setProperties([]);
            setPeople([]);
            setInstallments([]);
            setFastReload((n) => n + 1);
            return;
        }

        setContracts(DbService.getContracts() || []);
        setProperties(DbService.getProperties() || []);
        setPeople(DbService.getPeople() || []);
        setInstallments(DbService.getInstallments() || []);
  }, [isDesktopFast]);

    useEffect(() => {
        loadData();
    }, [dbSignal, loadData]);

    // Desktop counts for DataGuard
    useEffect(() => {
        if (!isDesktopFast) return;
        let alive = true;
        const run = async () => {
            const c = await domainCountsSmart();
            if (!alive) return;
            setDesktopCounts(c);
        };
        void run();
        return () => {
            alive = false;
        };
    }, [isDesktopFast, dbSignal, fastReload]);

    // Desktop paged rows (status tab + search)
    useEffect(() => {
        if (!isDesktopFast) return;
        let alive = true;
        setFastLoading(true);
        setFastError('');
        const offset = (Math.max(1, fastPage) - 1) * fastPageSize;
        const run = async () => {
            try {
                const res = await contractPickerSearchPagedSmart({
                    query: searchTerm,
                    tab: activeStatus,
                    createdMonth: createdMonthApplied ? String(advFilters.createdMonth || '').trim() : '',
                    offset,
                    limit: fastPageSize,
                });
                if (!alive) return;
                setFastRows(res.items || []);
                setFastTotal(res.total || 0);
                if (res.error) {
                    const msg = String(res.error || '').trim();
                    setFastError(msg);
                    if (msg && warnedFastErrorRef.current !== msg) {
                        warnedFastErrorRef.current = msg;
                        toastRef.current.error(msg);
                    }
                }
            } finally {
                if (alive) setFastLoading(false);
            }
        };
        void run();
        return () => {
            alive = false;
        };
    }, [isDesktopFast, searchTerm, activeStatus, fastPage, fastPageSize, advFilters.createdMonth, createdMonthApplied, dbSignal, fastReload]);

    useEffect(() => {
        if (!isDesktopFast) return;
        setFastPage(1);
    }, [isDesktopFast, searchTerm, activeStatus, advFilters.createdMonth, fastPageSize]);

    useEffect(() => {
        if (isDesktopFast) return;
        setUiPage(0);
    }, [searchTerm, activeStatus, showAdvanced, advFilters, pageSize, isDesktopFast]);

    const remainingByContractId = useMemo(() => {
        const map = new Map<string, number>();
        for (const inst of installments) {
            const contractId = String(inst?.رقم_العقد || '').trim();
            if (!contractId) continue;

            // Security deposit is a guarantee, not part of rent remaining.
            if (String(inst?.نوع_الكمبيالة || '').trim() === 'تأمين') continue;

            const { remaining } = getInstallmentPaidAndRemaining(inst);
            if (!remaining || remaining <= 0) continue;

            map.set(contractId, (map.get(contractId) || 0) + remaining);
        }
        return map;
    }, [installments]);

  const filteredContracts = useMemo(() => {
        if (isDesktopFast) return [];
    // 1. Status Filter
    let result = contracts.filter(c => {
        if (activeStatus === 'archived') return c.isArchived;
        if (c.isArchived) return false; 

        switch(activeStatus) {
            case 'active': return isTenancyRelevant(c);
            case 'expiring': return c.حالة_العقد === 'قريب الانتهاء';
            case 'expired': return c.حالة_العقد === 'منتهي';
            case 'terminated': return c.حالة_العقد === 'مفسوخ' || c.حالة_العقد === 'ملغي';
            default: return true;
        }
    });

    // 2. Search Filter (Using Maps for O(1) lookup)
    if (searchTerm.trim()) {
        const lower = searchTerm.toLowerCase();
        result = result.filter(c => {
            const tenantName = peopleMap.get(String(c.رقم_المستاجر)) || '';
            const propCode = propsCodeMap.get(String(c.رقم_العقار)) || '';
            const opp = String(c.رقم_الفرصة || '').trim();
            
            return (
                c.رقم_العقد.toLowerCase().includes(lower) ||
                tenantName.toLowerCase().includes(lower) ||
                propCode.toLowerCase().includes(lower) ||
                opp.toLowerCase().includes(lower)
            );
        });
    }

    // 3. Advanced Search
    // Created-month filter should work even when the advanced panel is hidden.
    if (createdMonthApplied) {
        const targetYm = String(advFilters.createdMonth || '').trim();
        result = result.filter(c => {
            const createdRaw = String(c.تاريخ_الانشاء || '').trim();
            const basis = /^\d{4}-\d{2}-\d{2}$/.test(createdRaw) ? createdRaw : String(c.تاريخ_البداية || '').trim();
            const ym = /^\d{4}-\d{2}-\d{2}$/.test(basis) ? basis.slice(0, 7) : '';
            return ym === targetYm;
        });
    }

    if (showAdvanced) {

        const rules: FilterRule[] = [];
        if(advFilters.startDateFrom && advFilters.startDateTo) {
            rules.push({ field: 'تاريخ_البداية', operator: 'dateBetween', value: [advFilters.startDateFrom, advFilters.startDateTo] });
        }
        if(advFilters.endDateFrom && advFilters.endDateTo) {
            rules.push({ field: 'تاريخ_النهاية', operator: 'dateBetween', value: [advFilters.endDateFrom, advFilters.endDateTo] });
        }
        if(advFilters.minValue) rules.push({ field: 'القيمة_السنوية', operator: 'gte', value: advFilters.minValue });
        if(advFilters.maxValue) rules.push({ field: 'القيمة_السنوية', operator: 'lte', value: advFilters.maxValue });
        
        result = SearchEngine.applyFilters(result, rules);
    }

    return result;
    }, [contracts, activeStatus, searchTerm, peopleMap, propsCodeMap, showAdvanced, advFilters, createdMonthApplied, isDesktopFast]);

    const uiPageCount = Math.max(1, Math.ceil(filteredContracts.length / pageSize));
    const uiRows = useMemo(() => {
        const start = uiPage * pageSize;
        return filteredContracts.slice(start, start + pageSize);
    }, [filteredContracts, uiPage, pageSize]);

  // Stable Handlers
  const handleOpenDetails = useCallback((id: string) => openPanel('CONTRACT_DETAILS', id), [openPanel]);
  const handleOpenClearance = useCallback((id: string) => openPanel('CLEARANCE_REPORT', id), [openPanel]);

  const handleEdit = useCallback((id: string) => {
      openPanel('CONTRACT_FORM', id, {
          onSuccess: () => setTimeout(loadData, 300),
      });
  }, [openPanel, loadData]);

  const handleDelete = useCallback(async (id: string) => {
      const contract = contracts.find(c => c.رقم_العقد === id);
      const okConfirm = await toast.confirm({
          title: 'حذف العقد',
          message: `سيتم حذف العقد${contract ? ` "${contract.رقم_العقد}"` : ''} نهائياً مع البيانات المرتبطة. لا يمكن التراجع.`,
          confirmText: 'حذف نهائي',
          cancelText: 'إلغاء',
          isDangerous: true,
      });
      if (!okConfirm) return;

      const res = DbService.deleteContract(id);
      if (res.success) {
          toast.success('تم حذف العقد');
          loadData();
      } else {
          toast.error(res.message || 'فشل حذف العقد');
      }
  }, [contracts, toast, loadData]);
  
  const handleArchive = useCallback(async (id: string) => {
    const contract = contracts.find(c => c.رقم_العقد === id);
    if (!contract) return;

        await toast.confirm({
      title: 'أرشفة العقد',
      message: `سيتم نقل العقد "${contract.رقم_العقد}" للأرشيف. هل أنت متأكد؟`,
      confirmText: 'نعم، انقل للأرشيف',
      cancelText: 'إلغاء',
      isDangerous: false,
      onConfirm: async () => {
        try {
          DbService.archiveContract(id);
          toast.success('تمت أرشفة العقد بنجاح', 'تم الأرشيف');
          loadData();
        } catch (error) {
          toast.error(`خطأ في الأرشفة: ${error}`, 'فشل الأرشيف');
        }
      },
      onCancel: () => {
        toast.info('تم إلغاء الأرشفة', 'تم الإلغاء');
      }
    });
  }, [contracts, toast, loadData]);

  const canCreateContract = useMemo(() => {
      if (isDesktopFast) {
          // If counts are still loading, do not hard-block creation here; the form panels may still be unsupported on Desktop.
          // We only enforce the check when counts are known.
          if (!desktopCounts) return true;
          return Number(desktopCounts.people || 0) > 0 && Number(desktopCounts.properties || 0) > 0;
      }
      return people.length > 0 && properties.length > 0;
  }, [isDesktopFast, desktopCounts, people.length, properties.length]);

  const handleCreate = useCallback(() => {
      if (!canCreateContract) {
          toast.warning('لا يمكن إنشاء عقد بدون أشخاص وعقارات');
          return;
      }
      openPanel('CONTRACT_FORM', 'new', {
          onSuccess: () => setTimeout(loadData, 500)
      });
  }, [canCreateContract, openPanel, toast, loadData]);

    const normalize = (v: unknown) => String(v ?? '').trim();

  const toDateOnly = (d: Date) => {
      const y = d.getUTCFullYear();
      const m = String(d.getUTCMonth() + 1).padStart(2, '0');
      const day = String(d.getUTCDate()).padStart(2, '0');
      return `${y}-${m}-${day}`;
  };

  const computeEndDate = (startIso: string, durationMonths: number) => {
      // end = start + durationMonths months - 1 day
      const parts = String(startIso || '').split('-').map(Number);
      if (parts.length < 3) return '';
      const [y, m, d] = parts;
      if (!y || !m || !d) return '';
      const start = new Date(Date.UTC(y, m - 1, d));
      const endCandidate = new Date(start.getTime());
      endCandidate.setUTCMonth(endCandidate.getUTCMonth() + Number(durationMonths || 0));
      endCandidate.setUTCDate(endCandidate.getUTCDate() - 1);
      return toDateOnly(endCandidate);
  };

  const mapPaymentMethod = (raw: unknown): PaymentMethodType => {
      const v = String(raw ?? '').trim().toLowerCase();
      if (!v) return 'Postpaid';
      if (v.includes('pre') || v.includes('مقدم') || v.includes('مسب')) return 'Prepaid';
      if (v.includes('down') || v.includes('دفعة') || v.includes('اول')) return 'DownPayment_Monthly';
      if (v.includes('post') || v.includes('مؤجل') || v.includes('لاحق')) return 'Postpaid';
      // Accept exact enum values
      if (v === 'prepaid') return 'Prepaid';
      if (v === 'postpaid') return 'Postpaid';
      if (v === 'downpayment_monthly') return 'DownPayment_Monthly';
      return 'Postpaid';
  };

  const handleDownloadTemplate = async () => {
      const companySheet = buildCompanyLetterheadSheet(DbService.getSettings?.());
      await exportToXlsx(
          'Contracts',
          [
              { key: 'PropertyCode', header: 'PropertyCode' },
              { key: 'TenantNationalID', header: 'TenantNationalID' },
              { key: 'TenantPhone', header: 'TenantPhone' },
              { key: 'GuarantorNationalID', header: 'GuarantorNationalID' },
              { key: 'GuarantorPhone', header: 'GuarantorPhone' },
              { key: 'StartDate', header: 'StartDate' },
              { key: 'DurationMonths', header: 'DurationMonths' },
              { key: 'AnnualValue', header: 'AnnualValue' },
              { key: 'PaymentFrequency', header: 'PaymentFrequency' },
              { key: 'PaymentMethod', header: 'PaymentMethod' },
          ],
          [
              {
                  PropertyCode: 'PROP-001',
                  TenantNationalID: '0123456789',
                  TenantPhone: '0790000000',
                  GuarantorNationalID: '',
                  GuarantorPhone: '',
                  StartDate: new Date().toISOString().slice(0, 10),
                  DurationMonths: 12,
                  AnnualValue: 1200,
                  PaymentFrequency: 12,
                  PaymentMethod: 'Postpaid',
              },
          ],
          'contracts_template.xlsx',
          {
              extraSheets: companySheet ? [companySheet] : [],
          }
      );
      toast.success('تم تنزيل قالب العقود');
  };

  const handlePickImportFile = () => importRef.current?.click();

  const handleImportFile = async (file: File) => {
          const ok = await toast.confirm({
              title: 'استيراد العقود',
              message:
                  'سيتم استيراد العقود من الملف. سيتم تخطي أي سطر لا يمكن ربطه بعقار/مستأجر موجود. هل تريد المتابعة؟',
              confirmText: 'متابعة',
              cancelText: 'إلغاء',
          });
          if (!ok) return;

          let rows: Array<Record<string, string>> = [];
          try {
              rows = await readSpreadsheet(file);
          } catch (e: unknown) {
              const msg = e instanceof Error ? e.message : 'فشل قراءة ملف الاستيراد';
              toast.error(msg);
              return;
          }
          if (!rows.length) {
              toast.warning('الملف فارغ');
              return;
          }

          const pick = (row: Record<string, string>, keys: string[]) => {
              for (const k of keys) {
                  const v = row[k];
                  if (v !== undefined && v !== null && String(v).trim() !== '') return String(v).trim();
              }
              return '';
          };

          const isDesktopFastImport = isDesktopFast;

          // Desktop fast: resolve links through SQL search without loading full arrays.
          const propByCode = new Map<string, Pick<العقارات_tbl, 'رقم_العقار' | 'الكود_الداخلي'>>();
          const personByNationalId = new Map<string, Pick<الأشخاص_tbl, 'رقم_الشخص' | 'الرقم_الوطني' | 'رقم_الهاتف'>>();
          const personByPhone = new Map<string, Pick<الأشخاص_tbl, 'رقم_الشخص' | 'الرقم_الوطني' | 'رقم_الهاتف'>>();

          // De-dupe cache: for each property, set of "tenantId|startDate" keys.
          const existingByProperty = new Map<string, Set<string>>();

          const ensureExistingForProperty = async (propertyId: string) => {
              const pid = String(propertyId || '').trim();
              if (!pid) return new Set<string>();
              const cached = existingByProperty.get(pid);
              if (cached) return cached;

              const set = new Set<string>();
              if (isDesktopFastImport) {
                  const items = (await propertyContractsSmart(pid)) || [];
                  for (const it of items) {
                      const c = it?.contract;
                      const tid = normalize(c?.رقم_المستاجر);
                      const sd = normalize(c?.تاريخ_البداية);
                      if (tid && sd) set.add(`${tid}|${sd}`);
                  }
              } else {
                  const existingContracts = (DbService.getContracts() || []) as العقود_tbl[];
                  for (const c of existingContracts) {
                      if (normalize(c.رقم_العقار) !== normalize(pid)) continue;
                      const tid = normalize(c.رقم_المستاجر);
                      const sd = normalize(c.تاريخ_البداية);
                      if (tid && sd) set.add(`${tid}|${sd}`);
                  }
              }

              existingByProperty.set(pid, set);
              return set;
          };

          const findPropertyByCode = async (propertyCode: string) => {
              const codeNorm = normalize(propertyCode);
              if (!codeNorm) return null;
              const cached = propByCode.get(codeNorm);
              if (cached) return cached;

              if (isDesktopFastImport) {
                  const res = await propertyPickerSearchPagedSmart({ query: codeNorm, offset: 0, limit: 50 });
                  const exact = (res.items || []).map((it) => it.property).find((p: PropertyPickerItem['property']) => normalize(p?.الكود_الداخلي) === codeNorm) || null;

                  const pid = String(exact?.رقم_العقار || '').trim();
                  if (!pid) return null;
                  const out = { رقم_العقار: pid, الكود_الداخلي: String(exact?.الكود_الداخلي || '').trim() || undefined };
                  propByCode.set(codeNorm, out);
                  return out;
              }

              const propsAll = (DbService.getProperties() || []) as العقارات_tbl[];
              for (const p of propsAll) {
                  const c = normalize(p.الكود_الداخلي);
                  if (c && !propByCode.has(c)) propByCode.set(c, p);
              }
              return propByCode.get(codeNorm) || null;
          };

          const findPersonByNidOrPhone = async (nidRaw: string, phoneRaw: string) => {
              const nid = normalize(nidRaw);
              const ph = normalize(phoneRaw);
              if (nid && personByNationalId.has(nid)) return personByNationalId.get(nid) ?? null;
              if (ph && personByPhone.has(ph)) return personByPhone.get(ph) ?? null;

              if (isDesktopFastImport) {
                  // Desktop safety: do not fall back to in-memory scans.
                  if (!window.desktopDb?.domainPeoplePickerSearch) return null;

                  // Prefer national ID exact match; else phone exact match.
                  if (nid) {
                      const res = await peoplePickerSearchPagedSmart({ query: nid, offset: 0, limit: 50 });
                      const exact = (res.items || [])
                          .map((it: PeoplePickerItem) => it.person)
                          .find((p: PeoplePickerItem['person']) => normalize(p?.الرقم_الوطني) === nid) || null;
                      const id = String(exact?.رقم_الشخص || '').trim();
                      if (id) {
                          const out = { رقم_الشخص: id, الرقم_الوطني: String(exact?.الرقم_الوطني || '').trim() || undefined, رقم_الهاتف: String(exact?.رقم_الهاتف || '').trim() || undefined };
                          if (nid) personByNationalId.set(nid, out);
                          if (ph) personByPhone.set(ph, out);
                          return out;
                      }
                  }

                  if (ph) {
                      const res = await peoplePickerSearchPagedSmart({ query: ph, offset: 0, limit: 50 });
                      const exact = (res.items || [])
                          .map((it: PeoplePickerItem) => it.person)
                          .find((p: PeoplePickerItem['person']) => normalize(p?.رقم_الهاتف) === ph) || null;
                      const id = String(exact?.رقم_الشخص || '').trim();
                      if (id) {
                          const out = { رقم_الشخص: id, الرقم_الوطني: String(exact?.الرقم_الوطني || '').trim() || undefined, رقم_الهاتف: String(exact?.رقم_الهاتف || '').trim() || undefined };
                          if (nid) personByNationalId.set(nid, out);
                          if (ph) personByPhone.set(ph, out);
                          return out;
                      }
                  }

                  return null;
              }

              const peopleAll = (DbService.getPeople() || []) as الأشخاص_tbl[];
              for (const p of peopleAll) {
                  const pnid = normalize(p.الرقم_الوطني);
                  const pph = normalize(p.رقم_الهاتف);
                  const out = { رقم_الشخص: String(p.رقم_الشخص), الرقم_الوطني: String(p.الرقم_الوطني || '').trim() || undefined, رقم_الهاتف: String(p.رقم_الهاتف || '').trim() || undefined };
                  if (pnid && !personByNationalId.has(pnid)) personByNationalId.set(pnid, out);
                  if (pph && !personByPhone.has(pph)) personByPhone.set(pph, out);
              }
              if (nid && personByNationalId.has(nid)) return personByNationalId.get(nid) ?? null;
              if (ph && personByPhone.has(ph)) return personByPhone.get(ph) ?? null;
              return null;
          };

          let created = 0;
          let skipped = 0;

          for (const row of rows) {
              const propertyCode = pick(row, ['PropertyCode', 'Property', 'Code', 'الكود_الداخلي', 'كود_العقار']);
              const tenantNationalId = pick(row, ['TenantNationalID', 'NationalID', 'الرقم_الوطني', 'رقم_وطني_المستأجر']);
              const tenantPhone = pick(row, ['TenantPhone', 'Phone', 'رقم_الهاتف', 'هاتف_المستأجر']);
              const guarantorNationalId = pick(row, ['GuarantorNationalID', 'GuarantorNID', 'رقم_وطني_الكفيل']);
              const guarantorPhone = pick(row, ['GuarantorPhone', 'GuarantorPhoneNumber', 'هاتف_الكفيل']);
              const startDate = pick(row, ['StartDate', 'تاريخ_البداية', 'From']);
              const durationRaw = pick(row, ['DurationMonths', 'مدة_العقد_بالاشهر']);
              const endDateRaw = pick(row, ['EndDate', 'تاريخ_النهاية', 'To']);
              const annualValueRaw = pick(row, ['AnnualValue', 'القيمة_السنوية', 'Value']);
              const paymentFrequencyRaw = pick(row, ['PaymentFrequency', 'تكرار_الدفع']);
              const paymentMethodRaw = pick(row, ['PaymentMethod', 'طريقة_الدفع']);

              const prop = await findPropertyByCode(propertyCode);
              const tenant = await findPersonByNidOrPhone(tenantNationalId, tenantPhone);
              const guarantor = await findPersonByNidOrPhone(guarantorNationalId, guarantorPhone);

              const durationMonths = Number(durationRaw || 0);
              const annualValue = Number(annualValueRaw || 0);
              const paymentFrequency = Number(paymentFrequencyRaw || 0) || 12;

              if (!prop || !tenant) {
                  skipped++;
                  continue;
              }
              if (!startDate || !(durationMonths > 0) || !(annualValue > 0)) {
                  skipped++;
                  continue;
              }

              const endDate = endDateRaw || computeEndDate(startDate, durationMonths);
              if (!endDate) {
                  skipped++;
                  continue;
              }

              const propertyId = String(prop.رقم_العقار || '').trim();
              const tenantId = String(tenant.رقم_الشخص || '').trim();
              const key = `${normalize(tenantId)}|${normalize(startDate)}`;
              const existingKeysForProp = await ensureExistingForProperty(propertyId);
              if (existingKeysForProp.has(key)) {
                  skipped++;
                  continue;
              }

              const res = DbService.createContract(
                  {
                      رقم_العقار: propertyId,
                      رقم_المستاجر: tenantId,
                      رقم_الكفيل: String(guarantor?.رقم_الشخص || '').trim() || undefined,
                      تاريخ_البداية: startDate,
                      تاريخ_النهاية: endDate,
                      مدة_العقد_بالاشهر: durationMonths,
                      القيمة_السنوية: annualValue,
                      تكرار_الدفع: paymentFrequency,
                      طريقة_الدفع: mapPaymentMethod(paymentMethodRaw),
                      حالة_العقد: 'نشط',
                      isArchived: false,
                  } satisfies Partial<العقود_tbl>,
                  0,
                  0
              );

              if (res.success) {
                  created++;
                  existingKeysForProp.add(key);
              } else {
                  skipped++;
              }
          }

          loadData();
          toast.success(`تم الاستيراد: إضافة ${created} • تخطي ${skipped}`);
    };

    const handleExport = async () => {
          if (isDesktopFast) {
              if (fastTotal === 0) return toast.warning('لا توجد بيانات للتصدير');

              type DesktopExportRow = {
                  ContractId: string;
                  PropertyCode: string;
                  OwnerName: string;
                  TenantName: string;
                  StartDate: string;
                  EndDate: string;
                  AnnualValue: number;
                  PaymentFrequency: unknown;
                  PaymentMethod: unknown;
                  Status: string;
              };

              // Export the currently filtered Desktop set (paged fetch) on demand.
              const allItems: ContractPickerItem[] = [];
              const batch = 500;
              for (let off = 0; off < fastTotal; off += batch) {
                  const res = await contractPickerSearchPagedSmart({ query: searchTerm, tab: activeStatus, offset: off, limit: batch });
                  allItems.push(...(res.items || []));
                  if ((res.items || []).length < batch) break;
              }

              if (allItems.length === 0) return toast.warning('لا توجد بيانات للتصدير');

              const rows: DesktopExportRow[] = allItems.map((r) => {
                  const c = r.contract;
                  return {
                      ContractId: c.رقم_العقد,
                      PropertyCode: r.propertyCode || c.رقم_العقار,
                      OwnerName: r.ownerName || '',
                      TenantName: r.tenantName || '',
                      StartDate: c.تاريخ_البداية,
                      EndDate: c.تاريخ_النهاية,
                      AnnualValue: c.القيمة_السنوية,
                      // Preserve legacy export behavior: some Desktop payloads may include a non-standard field.
                      PaymentFrequency: (c as unknown as Record<string, unknown>)['نظام_الدفع'],
                      PaymentMethod: c.طريقة_الدفع,
                      Status: c.حالة_العقد,
                  };
              });

              const companySheet = buildCompanyLetterheadSheet(DbService.getSettings?.());
              const cols: Array<XlsxColumn<DesktopExportRow>> = [
                  { key: 'ContractId', header: 'ContractId' },
                  { key: 'PropertyCode', header: 'PropertyCode' },
                  { key: 'OwnerName', header: 'OwnerName' },
                  { key: 'TenantName', header: 'TenantName' },
                  { key: 'StartDate', header: 'StartDate' },
                  { key: 'EndDate', header: 'EndDate' },
                  { key: 'AnnualValue', header: 'AnnualValue' },
                  { key: 'PaymentFrequency', header: 'PaymentFrequency' },
                  { key: 'PaymentMethod', header: 'PaymentMethod' },
                  { key: 'Status', header: 'Status' },
              ];
              await exportToXlsx('Contracts', cols, rows, `contracts_export_${new Date().toISOString().slice(0, 10)}.xlsx`, {
                  extraSheets: companySheet ? [companySheet] : [],
              });
              toast.success('تم التصدير');
              return;
          }

          if (filteredContracts.length === 0) return toast.warning('لا توجد بيانات للتصدير');

      const companySheet = buildCompanyLetterheadSheet(DbService.getSettings?.());

      const rows = filteredContracts.map((c) => {
          const tenantName = peopleMap.get(String(c.رقم_المستاجر)) || '';
          const propertyCode = propsCodeMap.get(String(c.رقم_العقار)) || '';
          return {
              ID: c.رقم_العقد,
              PropertyCode: propertyCode,
              Tenant: tenantName,
              StartDate: c.تاريخ_البداية,
              EndDate: c.تاريخ_النهاية,
              DurationMonths: c.مدة_العقد_بالاشهر,
              AnnualValue: c.القيمة_السنوية,
              PaymentFrequency: c.تكرار_الدفع,
              PaymentMethod: c.طريقة_الدفع,
              Status: c.حالة_العقد,
          };
      });

      await exportToXlsx(
          'Contracts',
          [
              { key: 'ID', header: 'ID' },
              { key: 'PropertyCode', header: 'PropertyCode' },
              { key: 'Tenant', header: 'Tenant' },
              { key: 'StartDate', header: 'StartDate' },
              { key: 'EndDate', header: 'EndDate' },
              { key: 'DurationMonths', header: 'DurationMonths' },
              { key: 'AnnualValue', header: 'AnnualValue' },
              { key: 'PaymentFrequency', header: 'PaymentFrequency' },
              { key: 'PaymentMethod', header: 'PaymentMethod' },
              { key: 'Status', header: 'Status' },
          ],
          rows,
          `contracts_export_${new Date().toISOString().slice(0, 10)}.xlsx`,
          {
              extraSheets: companySheet ? [companySheet] : [],
          }
      );

      DbService.logEvent('User', 'Export', 'Contracts', `Exported ${filteredContracts.length} contracts`);
      toast.success('تم التصدير');
  };

    const desktopHasAnyAdvFilter = useMemo(() => {
        // Excluding createdMonth, since it's now a top-level quick filter.
        return Object.entries(advFilters).some(([k, v]) => k !== 'createdMonth' && String(v ?? '').trim() !== '');
    }, [advFilters]);

    const desktopFiltersApplied = useMemo(() => {
        return !!String(searchTerm || '').trim() || activeStatus !== 'active' || createdMonthApplied || (showAdvanced && desktopHasAnyAdvFilter);
    }, [searchTerm, activeStatus, showAdvanced, desktopHasAnyAdvFilter, createdMonthApplied]);

    const desktopCountsKnown = isDesktopFast && desktopCounts !== null;
    const desktopNoContractsKnown = desktopCountsKnown && Number(desktopCounts?.contracts || 0) <= 0;

    // Empty-state decisions (desktop fast mode can operate even if domainCounts is missing).
    const showEmptyNoContracts = isDesktopFast
        ? (!fastLoading && (desktopNoContractsKnown || (!desktopCountsKnown && !desktopFiltersApplied && fastRows.length === 0 && fastTotal === 0 && !fastError)))
        : contracts.length === 0;

    const showEmptyNoResults = !showEmptyNoContracts && (isDesktopFast ? (!fastLoading && fastRows.length === 0) : filteredContracts.length === 0);

    return (
            <div className="animate-fade-in space-y-6">
                <input
                    ref={importRef}
                    type="file"
                    accept=".xlsx,.xls,.csv"
                    className="hidden"
                    onChange={(e) => {
                        const f = e.target.files?.[0];
                        e.target.value = '';
                        if (f) void handleImportFile(f);
                    }}
                />

        <SmartFilterBar
            title="إدارة العقود"
            subtitle="دورة حياة كاملة للعقود: إنشاء، تجديد، مخالصات، وأرشفة."
            searchValue={searchTerm}
            onSearchChange={setSearchTerm}
            onAddClick={handleCreate}
            addLabel="عقد جديد"
            onRefresh={loadData}
          extraActions={
              <div className="flex flex-wrap items-center justify-end gap-2">
                      <SegmentedTabs
                          tabs={[
                              { id: 'active', label: 'سارية', icon: CheckCircle },
                              { id: 'expiring', label: 'قريبة الانتهاء', icon: Clock },
                              { id: 'expired', label: 'منتهية', icon: AlertTriangle },
                              { id: 'terminated', label: 'مفسوخة', icon: Ban },
                              { id: 'archived', label: 'الأرشيف', icon: Archive },
                          ]}
                          activeId={activeStatus}
                          onChange={(id) => setActiveStatus(id)}
                      />

                  <div className="app-card px-3 py-2 flex items-center gap-2">
                      <Filter size={16} className="text-gray-400" />
                      <input
                          type="month"
                          dir="ltr"
                          className="bg-transparent text-slate-700 dark:text-white outline-none text-sm font-bold"
                          value={advFilters.createdMonth}
                          onChange={(e) => setAdvFilters({ ...advFilters, createdMonth: e.target.value })}
                          title="تصفية حسب شهر إنشاء العقد"
                      />
                      {createdMonthApplied && (
                          <button
                              type="button"
                              onClick={() => setAdvFilters({ ...advFilters, createdMonth: '' })}
                              className="p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 dark:text-slate-400"
                              title="إلغاء فلتر الشهر"
                          >
                              <X size={14} />
                          </button>
                      )}
                  </div>

                  <Button
                      size="sm"
                      variant={advFilters.createdMonth === currentMonthKey ? 'secondary' : 'ghost'}
                      leftIcon={<CalendarDays size={16} />}
                      onClick={() => {
                          const isThisMonth = String(advFilters.createdMonth || '').trim() === currentMonthKey;
                          setAdvFilters({ ...advFilters, createdMonth: isThisMonth ? '' : currentMonthKey });
                      }}
                      title={advFilters.createdMonth === currentMonthKey ? 'إلغاء فلتر هذا الشهر' : 'عرض العقود المُنشأة هذا الشهر'}
                  >
                      هذا الشهر
                  </Button>

                  <Button variant="secondary" onClick={() => setShowAdvanced(!showAdvanced)} leftIcon={<SlidersHorizontal size={18}/>}>
                      {showAdvanced ? 'إخفاء' : 'تصفية'}
                  </Button>
                  <Button variant="secondary" onClick={handleDownloadTemplate} leftIcon={<Download size={18}/>}>قالب Excel</Button>
                  <RBACGuard requiredPermission="CREATE_CONTRACT">
                      <Button variant="secondary" onClick={handlePickImportFile} leftIcon={<Download size={18}/>}>استيراد</Button>
                  </RBACGuard>
                  <Button variant="secondary" onClick={handleExport} leftIcon={<Download size={18}/>} />
              </div>
          }
      />

      {showAdvanced && (
           <Card className="p-4 mb-6 grid grid-cols-1 md:grid-cols-4 gap-4 animate-slide-up bg-indigo-50/50 dark:bg-slate-800/50 border-indigo-100 dark:border-slate-700">
               <div>
                   <label className="text-xs font-bold block mb-1">تاريخ البداية (من - إلى)</label>
                   <div className="flex gap-2">
                       <input type="date" className="p-2 rounded border w-full text-xs" value={advFilters.startDateFrom} onChange={e => setAdvFilters({...advFilters, startDateFrom: e.target.value})} />
                       <input type="date" className="p-2 rounded border w-full text-xs" value={advFilters.startDateTo} onChange={e => setAdvFilters({...advFilters, startDateTo: e.target.value})} />
                   </div>
               </div>
               <div>
                   <label className="text-xs font-bold block mb-1">تاريخ النهاية (من - إلى)</label>
                   <div className="flex gap-2">
                       <input type="date" className="p-2 rounded border w-full text-xs" value={advFilters.endDateFrom} onChange={e => setAdvFilters({...advFilters, endDateFrom: e.target.value})} />
                       <input type="date" className="p-2 rounded border w-full text-xs" value={advFilters.endDateTo} onChange={e => setAdvFilters({...advFilters, endDateTo: e.target.value})} />
                   </div>
               </div>
               <div>
                   <label className="text-xs font-bold block mb-1">القيمة (من - إلى)</label>
                   <div className="flex gap-2">
                       <input type="number" placeholder="min" className="p-2 rounded border w-full text-xs" value={advFilters.minValue} onChange={e => setAdvFilters({...advFilters, minValue: e.target.value})} />
                       <input type="number" placeholder="max" className="p-2 rounded border w-full text-xs" value={advFilters.maxValue} onChange={e => setAdvFilters({...advFilters, maxValue: e.target.value})} />
                   </div>
               </div>
           </Card>
      )}

      {/* عرض EmptyState حسب الحالة */}
      {showEmptyNoContracts ? (
          <EmptyState type="contracts" onAction={handleCreate} />
      ) : showEmptyNoResults ? (
          <EmptyState
              type={searchTerm ? "search" : "filter"}
              title={searchTerm ? "لا توجد نتائج بحث" : "لا توجد نتائج"}
              message={searchTerm
                  ? `لم يتم العثور على عقود تطابق "${searchTerm}"`
                  : `لا توجد عقود تطابق الفلاتر المحددة`
              }
              actionLabel={searchTerm ? "مسح البحث" : "مسح الفلاتر"}
              onAction={() => {
                  setSearchTerm('');
                  setActiveStatus('active');
                  setShowAdvanced(false);
                  setAdvFilters({ startDateFrom: '', startDateTo: '', endDateFrom: '', endDateTo: '', minValue: '', maxValue: '', createdMonth: '' });
              }}
          />
      ) : (
          // حالة: عرض البيانات (بطاقات)
          <>
          {!isDesktopFast ? (
              <div className="flex items-center justify-between mb-3">
                  <div className="text-sm text-slate-500 dark:text-slate-400">
                      {filteredContracts.length.toLocaleString()} نتيجة
                  </div>
                  <div className="flex items-center gap-2">
                      <Button
                          size="sm"
                          variant="secondary"
                          disabled={uiPage <= 0}
                          onClick={() => setUiPage((p) => Math.max(0, p - 1))}
                      >
                          السابق
                      </Button>
                      <div className="text-sm text-slate-600 dark:text-slate-300">
                          {uiPage + 1} / {uiPageCount}
                      </div>
                      <Button
                          size="sm"
                          variant="secondary"
                          disabled={uiPage + 1 >= uiPageCount}
                          onClick={() => setUiPage((p) => p + 1)}
                      >
                          التالي
                      </Button>
                  </div>
              </div>
          ) : null}

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                            {isDesktopFast && fastLoading ? (
                                <div className="col-span-full text-center text-slate-500 text-sm p-6">جاري التحميل...</div>
                            ) : null}

                                {isDesktopFast
                                ? fastRows.map((item) => {
                                      const c = item.contract;
                                      return (
                                      <ContractCard
                                          key={String(c.رقم_العقد)}
                                          contract={c}
                                          propCode={String(item.propertyCode || c.رقم_العقار || '')}
                                          tenantName={String(item.tenantName || c.رقم_المستاجر || '')}
                                          ownerName={String(item.ownerName || '')}
                                          remainingAmount={Number(item.remainingAmount || 0) || 0}
                                          onOpenDetails={handleOpenDetails}
                                          onOpenClearance={handleOpenClearance}
                                          onArchive={handleArchive}
                                          onEdit={handleEdit}
                                          onDelete={handleDelete}
                                      />
                                      );
                                  })
                                : uiRows.map((c) => {
                                      const prop = propsById.get(String(c.رقم_العقار));
                                      const ownerName = prop?.رقم_المالك ? (peopleMap.get(String(prop.رقم_المالك)) || String(prop.رقم_المالك)) : '';
                                      const remainingAmount = remainingByContractId.get(String(c.رقم_العقد)) || 0;
                                      return (
                                      <ContractCard
                                          key={c.رقم_العقد}
                                          contract={c}
                                          propCode={propsCodeMap.get(String(c.رقم_العقار)) || c.رقم_العقار}
                                          tenantName={peopleMap.get(String(c.رقم_المستاجر)) || c.رقم_المستاجر}
                                          ownerName={ownerName}
                                          remainingAmount={remainingAmount}
                                          onOpenDetails={handleOpenDetails}
                                          onOpenClearance={handleOpenClearance}
                                          onArchive={handleArchive}
                                          onEdit={handleEdit}
                                          onDelete={handleDelete}
                                      />
                                      );
                                  })}
          </div>
                          </>
      )}

            {isDesktopFast ? (
                <div className="flex items-center justify-between gap-3 mt-4 text-sm">
                    <div className="text-slate-500">
                        النتائج: {fastTotal.toLocaleString('ar-JO')} • الصفحة {fastPage} / {Math.max(1, Math.ceil(fastTotal / fastPageSize))}
                    </div>
                    <div className="flex gap-2">
                        <Button variant="secondary" disabled={fastPage <= 1 || fastLoading} onClick={() => setFastPage((p) => Math.max(1, p - 1))}>
                            السابق
                        </Button>
                        <Button
                            variant="secondary"
                            disabled={fastLoading || fastPage >= Math.ceil(Math.max(1, fastTotal) / fastPageSize)}
                            onClick={() => setFastPage((p) => p + 1)}
                        >
                            التالي
                        </Button>
                    </div>
                </div>
            ) : null}
            </div>
  );
};

