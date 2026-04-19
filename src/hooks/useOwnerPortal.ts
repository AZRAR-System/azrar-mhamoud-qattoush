import { useState, useEffect, useMemo } from 'react';
import { useAuth } from '@/context/AuthContext';
import { getOwnerReport, exportOwnerReportPdf } from '@/services/ownerReport';
import { getPeopleByRole } from '@/services/db/people';
import { useToast } from '@/context/ToastContext';
import type { OwnerReportData } from '@/services/ownerReport';
import type { الأشخاص_tbl } from '@/types';

// دالة تحسين البحث
const normalizeSearchTerm = (str: string): string => {
  if (!str) return '';
  return String(str)
    .normalize('NFKD')
    .replace(/[\u064B-\u065F\u0610-\u061A]/g, '')
    .replace(/[يىئ]/g, 'ي')
    .replace(/[ؤو]/g, 'و')
    .replace(/[ةه]/g, 'ه')
    .replace(/[\s\-_.,]/g, '')
    .toLowerCase()
    .trim();
};

export type TabId = 'properties' | 'contracts' | 'revenue' | 'statement';

export function useOwnerPortal() {
  const { user } = useAuth();
  const toast = useToast();
  const [activeTab, setActiveTab]         = useState<TabId>('properties');
  const [report, setReport]               = useState<OwnerReportData | null>(null);
  const [loading, setLoading]             = useState(true);
  const [selectedOwnerId, setSelectedOwnerId] = useState<string | null>(null);
  const [filterContractId, setFilterContractId] = useState<string | null>(null);
  const [owners, setOwners]               = useState<الأشخاص_tbl[]>([]);
  const [searchTerm, setSearchTerm]       = useState('');

  useEffect(() => {
    const ownersList = getPeopleByRole('مالك');
    setOwners(ownersList);
    if (ownersList.length > 0 && !selectedOwnerId) {
      setSelectedOwnerId(ownersList[0].رقم_الشخص);
    } else if (ownersList.length === 0) {
      setLoading(false);
    }
  }, [selectedOwnerId]);

  const filteredOwners = useMemo(() => {
    if (!searchTerm.trim()) return owners;
    const n = normalizeSearchTerm(searchTerm);
    return owners.filter(o =>
      normalizeSearchTerm(o.الاسم).includes(n) ||
      normalizeSearchTerm(o.الرقم_الوطني || '').includes(n) ||
      normalizeSearchTerm(o.رقم_الهاتف || '').includes(n)
    );
  }, [owners, searchTerm]);

  useEffect(() => {
    if (selectedOwnerId) {
      setLoading(true);
      try {
        const data = getOwnerReport(selectedOwnerId, filterContractId || undefined);
        setReport(data);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
  }, [selectedOwnerId, filterContractId]);

  const handleExportPdf = async () => {
    if (!selectedOwnerId) return;
    toast.info('جاري توليد تقرير PDF...', 'التقارير');
    try {
      const path = await exportOwnerReportPdf(selectedOwnerId, filterContractId || undefined);
      if (path) {
        toast.success(`تم حفظ التقرير في: ${path}`, 'اكتمل التصدير');
      } else {
        toast.error('فشل تصدير التقرير', 'خطأ');
      }
    } catch {
      toast.error('خطأ أثناء التصدير', 'خطأ');
    }
  };

  const handlePrint = () => {
    window.print();
  };

  return {
    user,
    toast,
    activeTab,
    setActiveTab,
    report,
    loading,
    selectedOwnerId,
    setSelectedOwnerId,
    filterContractId,
    setFilterContractId,
    owners,
    searchTerm,
    setSearchTerm,
    filteredOwners,
    handleExportPdf,
    handlePrint,
  };
}

export type UseOwnerPortalReturn = ReturnType<typeof useOwnerPortal>;
