import React from 'react';
import { BadgeDollarSign, Plus, FileSignature } from 'lucide-react';
import { PageHero } from '@/components/shared/PageHero';
import { Button } from '@/components/ui/Button';
import { useSalesData } from './hooks/useSalesData';
import { useSalesFilters } from './hooks/useSalesFilters';
import { SalesDashboard } from './components/SalesDashboard';
import { SalesFilterBar } from './components/SalesFilterBar';
import { SalesListingsTab } from './components/SalesListingsTab';
import { SalesOffersTab } from './components/SalesOffersTab';
import { SalesAgreementsTab } from './components/SalesAgreementsTab';

const t = (s: string) => s;

export const Sales: React.FC = () => {
  const { isLoading, stats, listings, offers, agreements, loadData } = useSalesData();
  const {
    activeTab,
    setActiveTab,
    statusFilter,
    setStatusFilter,
    searchQuery,
    setSearchQuery,
    listingMarketingFilter,
    setListingMarketingFilter,
    STATUS_FILTERS
  } = useSalesFilters();

  return (
    <div className="space-y-8 animate-fade-in pb-10">
      <PageHero
        icon={<BadgeDollarSign size={28} />}
        iconVariant="featured"
        title={t('إدارة المبيعات')}
        subtitle={t('نظام متكامل لإدارة عروض البيع، المفاوضات، ونقل الملكية')}
        actions={
          <>
            <Button
              variant="secondary"
              className="bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 font-black px-6 py-3 rounded-2xl shadow-soft hover:shadow-md transition-all active:scale-95"
              leftIcon={<FileSignature size={20} />}
            >
              {t('إنشاء اتفاقية')}
            </Button>
            <Button
              className="bg-indigo-600 hover:bg-indigo-700 text-white font-black px-6 py-3 rounded-2xl shadow-lg shadow-indigo-600/20 transition-all active:scale-95"
              leftIcon={<Plus size={20} />}
            >
              {t('عرض بيع جديد')}
            </Button>
          </>
        }
      />

      <SalesDashboard stats={stats} />

      <div className="app-card overflow-hidden">
        <div className="flex bg-slate-50/50 dark:bg-slate-950/20 p-2 border-b border-slate-100 dark:border-slate-800">
          <button
            onClick={() => setActiveTab('listings')}
            className={`flex-1 py-4 font-black text-sm flex items-center justify-center gap-2 rounded-2xl transition-all duration-300 ${activeTab === 'listings' ? 'bg-white dark:bg-slate-800 text-indigo-600 shadow-soft border border-slate-100 dark:border-slate-700' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}
          >
            {t('عروض البيع')}
          </button>
          <button
            onClick={() => setActiveTab('offers')}
            className={`flex-1 py-4 font-black text-sm flex items-center justify-center gap-2 rounded-2xl transition-all duration-300 ${activeTab === 'offers' ? 'bg-white dark:bg-slate-800 text-indigo-600 shadow-soft border border-slate-100 dark:border-slate-700' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}
          >
            {t('عروض الشراء')}
          </button>
          <button
            onClick={() => setActiveTab('agreements')}
            className={`flex-1 py-4 font-black text-sm flex items-center justify-center gap-2 rounded-2xl transition-all duration-300 ${activeTab === 'agreements' ? 'bg-white dark:bg-slate-800 text-indigo-600 shadow-soft border border-slate-100 dark:border-slate-700' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}
          >
            {t('الاتفاقيات والعقود')}
          </button>
        </div>

        <SalesFilterBar
          searchQuery={searchQuery}
          setSearchQuery={setSearchQuery}
          statusFilter={statusFilter}
          setStatusFilter={setStatusFilter}
          STATUS_FILTERS={STATUS_FILTERS}
        />

        <div className="p-8">
          {activeTab === 'listings' && (
            <SalesListingsTab
              listings={listings}
              isLoading={isLoading}
              listingMarketingFilter={listingMarketingFilter}
              setListingMarketingFilter={setListingMarketingFilter}
              statusFilter={statusFilter}
              searchQuery={searchQuery}
            />
          )}
          {activeTab === 'offers' && (
            <SalesOffersTab offers={offers} isLoading={isLoading} />
          )}
          {activeTab === 'agreements' && (
            <SalesAgreementsTab agreements={agreements} isLoading={isLoading} listings={listings} />
          )}
        </div>
      </div>
    </div>
  );
};