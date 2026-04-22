import React from 'react';
import { SmartFilterBar } from '@/components/shared/SmartFilterBar';
import { BadgeDollarSign, FileSignature, Layers, Clock, CheckCircle, XCircle } from 'lucide-react';
import { Button } from '@/components/ui/Button';

interface SalesSmartFilterBarProps {
  activeTab: 'listings' | 'offers' | 'agreements';
  setActiveTab: (tab: 'listings' | 'offers' | 'agreements') => void;
  statusFilter: string;
  setStatusFilter: (status: string) => void;
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  listingMarketingFilter: 'all' | 'sale-only' | 'also-rentable';
  setListingMarketingFilter: (v: 'all' | 'sale-only' | 'also-rentable') => void;
  onNewListing: () => void;
  onNewAgreement: () => void;
  totalResults: number;
}

export const SalesSmartFilterBar: React.FC<SalesSmartFilterBarProps> = ({
  activeTab,
  setActiveTab,
  statusFilter,
  setStatusFilter,
  searchQuery,
  setSearchQuery,
  listingMarketingFilter,
  setListingMarketingFilter,
  onNewListing,
  onNewAgreement,
  totalResults,
}) => {
  return (
    <SmartFilterBar
      addButton={{
        label: 'عرض بيع جديد',
        onClick: onNewListing,
        permission: 'EDIT_SALES',
      }}
      searchValue={searchQuery}
      onSearchChange={setSearchQuery}
      searchPlaceholder="بحث بالعقار، المالك، السعر..."
      tabs={[
        { id: 'listings', label: 'عروض البيع', icon: BadgeDollarSign },
        { id: 'offers', label: 'عروض الشراء', icon: Clock },
        { id: 'agreements', label: 'الاتفاقيات والعقود', icon: FileSignature },
      ]}
      activeTab={activeTab}
      onTabChange={(id) => setActiveTab(id as 'listings' | 'offers' | 'agreements')}
      totalResults={totalResults}
      moreActions={[
        {
          label: 'إنشاء اتفاقية',
          onClick: onNewAgreement,
          permission: 'EDIT_SALES',
          icon: FileSignature,
        },
      ]}
    >
      <div className="flex flex-wrap gap-2">
        <div className="flex bg-slate-100 dark:bg-slate-800 rounded-lg p-1">
          {[
            { id: 'all', label: 'الكل', icon: <Layers size={14} /> },
            { id: 'active', label: 'نشط', icon: <Clock size={14} /> },
            { id: 'completed', label: 'مكتمل', icon: <CheckCircle size={14} /> },
            { id: 'cancelled', label: 'ملغي', icon: <XCircle size={14} /> },
          ].map((f) => (
            <Button
              key={f.id}
              size="sm"
              variant={statusFilter === f.id ? 'secondary' : 'ghost'}
              onClick={() => setStatusFilter(f.id)}
              className="text-[10px] font-bold h-7"
            >
              {f.icon}
              <span className="mr-1">{f.label}</span>
            </Button>
          ))}
        </div>

        {activeTab === 'listings' && (
          <select
            value={listingMarketingFilter}
            onChange={(e) => setListingMarketingFilter(e.target.value as 'all' | 'sale-only' | 'also-rentable')}
            className="bg-slate-100 dark:bg-slate-800 text-[10px] font-bold rounded-lg px-2 h-9 outline-none border-none ring-1 ring-slate-200 dark:ring-slate-700 focus:ring-2 focus:ring-indigo-500/20"
          >
            <option value="all">كل التصنيفات</option>
            <option value="also-rentable">متاح للبيع والإيجار</option>
            <option value="sale-only">للبيع فقط</option>
          </select>
        )}
      </div>
    </SmartFilterBar>
  );
};
