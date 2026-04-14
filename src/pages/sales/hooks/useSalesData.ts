import { useCallback, useEffect, useState, useMemo } from 'react';
import { DbService } from '@/services/mockDb';
import { عروض_البيع_tbl, عروض_الشراء_tbl, اتفاقيات_البيع_tbl, العقارات_tbl, الأشخاص_tbl } from '@/types';
import { useDbSignal } from '@/hooks/useDbSignal';
import { useToast } from '@/context/ToastContext';
import { getErrorMessage } from '@/utils/errors';

export const useSalesData = () => {
  const dbSignal = useDbSignal();
  const toast = useToast();
  
  const [isLoading, setIsLoading] = useState(true);
  const [listings, setListings] = useState<عروض_البيع_tbl[]>([]);
  const [offers, setOffers] = useState<عروض_الشراء_tbl[]>([]);
  const [agreements, setAgreements] = useState<اتفاقيات_البيع_tbl[]>([]);
  
  // Data for resolution
  const [properties, setProperties] = useState<العقارات_tbl[]>([]);
  const [people, setPeople] = useState<الأشخاص_tbl[]>([]);
  const [employees, setEmployees] = useState<Array<{ id: string; label: string }>>([]);

  const loadData = useCallback(() => {
    try {
      setIsLoading(true);
      setListings(DbService.getSalesListings());
      setOffers(DbService.getSalesOffers());
      setAgreements(DbService.getSalesAgreements());
      
      setProperties(DbService.getProperties());
      setPeople(DbService.getPeople());

      // Fetch users who can be agents/employees
      const users = DbService.getUsers();
      setEmployees(users.map(u => ({ id: u.اسم_المستخدم, label: u.اسم_للعرض || u.اسم_المستخدم })));
      
      setTimeout(() => setIsLoading(false), 300);
    } catch (e: unknown) {
      toast.error(getErrorMessage(e) || 'فشل تحميل بيانات المبيعات');
      setListings([]);
      setOffers([]);
      setAgreements([]);
      setIsLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    loadData();
  }, [dbSignal, loadData]);

  const propertyMap = useMemo(() => {
    const map = new Map<string, العقارات_tbl>();
    properties.forEach(p => map.set(p.رقم_العقار, p));
    return map;
  }, [properties]);

  const personMap = useMemo(() => {
    const map = new Map<string, الأشخاص_tbl>();
    people.forEach(p => map.set(p.رقم_الشخص, p));
    return map;
  }, [people]);

  const getPropertyLabel = useCallback((id: string) => {
    const p = propertyMap.get(id);
    return p ? `${p.الكود_الداخلي} - ${p.العنوان}` : id;
  }, [propertyMap]);

  const getPersonName = useCallback((id: string) => {
    return personMap.get(id)?.الاسم || id;
  }, [personMap]);

  const stats = useMemo(() => {
    const totalSales = agreements
      .filter((a) => a.isCompleted)
      .reduce((sum, a) => sum + a.السعر_النهائي, 0);

    const activeListingsCount = listings.filter((l) => l.الحالة === 'Active').length;
    const pendingOffersCount = offers.filter((o) => o.الحالة === 'Pending').length;
    const pendingAgreementsCount = agreements.filter((a) => !a.isCompleted).length;

    return {
      totalSales,
      activeListings: activeListingsCount,
      pendingOffers: pendingOffersCount,
      pendingAgreements: pendingAgreementsCount,
    };
  }, [agreements, listings, offers]);

  return {
    isLoading,
    listings,
    offers,
    agreements,
    employees,
    getPropertyLabel,
    getPersonName,
    loadData,
    stats,
  };
};