import { useState, useEffect } from 'react';
import { readSessionFilterJson, writeSessionFilterJson } from '@/utils/sessionFilterStorage';

const STATUS_FILTERS = [
  { id: 'all', label: 'الكل', color: 'gray' },
  { id: 'active', label: 'نشط', color: 'green' },
  { id: 'completed', label: 'مكتمل', color: 'emerald' },
  { id: 'cancelled', label: 'ملغي', color: 'red' }
];

type SalesFiltersSaved = { listingMarketingFilter?: 'all' | 'sale-only' | 'also-rentable' };

export const useSalesFilters = () => {
  const [activeTab, setActiveTab] = useState<'listings' | 'offers' | 'agreements'>('listings');
  const [statusFilter, setStatusFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  
  const savedSalesFilters = readSessionFilterJson<SalesFiltersSaved>('sales');
  const [listingMarketingFilter, setListingMarketingFilter] = useState<
    'all' | 'sale-only' | 'also-rentable'
  >(() => {
    const v = savedSalesFilters?.listingMarketingFilter;
    return v === 'sale-only' || v === 'also-rentable' || v === 'all' ? v : 'all';
  });

  useEffect(() => {
    writeSessionFilterJson('sales', { listingMarketingFilter });
  }, [listingMarketingFilter]);

  return {
    activeTab,
    setActiveTab,
    statusFilter,
    setStatusFilter,
    searchQuery,
    setSearchQuery,
    listingMarketingFilter,
    setListingMarketingFilter,
    STATUS_FILTERS
  };
};