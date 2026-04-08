import { useCallback, useEffect, useState } from 'react';
import { DbService } from '@/services/mockDb';
import { عروض_البيع_tbl, عروض_الشراء_tbl, اتفاقيات_البيع_tbl } from '@/types';
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

  const loadData = useCallback(() => {
    try {
      setIsLoading(true);
      setListings(DbService.getSalesListings());
      setOffers(DbService.getSalesOffers());
      setAgreements(DbService.getSalesAgreements());
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

  const totalSales = agreements
    .filter((a) => a.isCompleted)
    .reduce((sum, a) => sum + a.السعر_النهائي, 0);

  const activeListings = listings.filter((l) => l.الحالة === 'Active');
  const pendingOffers = offers.filter((o) => o.الحالة === 'Pending');
  const pendingAgreements = agreements.filter((a) => !a.isCompleted);

  return {
    isLoading,
    listings,
    offers,
    agreements,
    loadData,
    stats: {
      totalSales,
      activeListings: activeListings.length,
      pendingOffers: pendingOffers.length,
      pendingAgreements: pendingAgreements.length,
    }
  };
};