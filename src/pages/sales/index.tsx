import React, { useState } from 'react';
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
import { AgreementModal } from './components/modals/AgreementModal';
import { TransferOwnershipModal } from './components/modals/TransferOwnershipModal';
import { NewListingModal } from './components/modals/NewListingModal';
import { NewOfferModal } from './components/modals/NewOfferModal';
import { DbService } from '@/services/mockDb';
import { useToast } from '@/context/ToastContext';
import { عروض_البيع_tbl, اتفاقيات_البيع_tbl } from '@/types';

const t = (s: string) => s;

export const Sales: React.FC = () => {
  const { 
    isLoading, 
    stats, 
    listings, 
    offers, 
    agreements, 
    employees,
    getPropertyLabel,
    getPersonName,
    loadData 
  } = useSalesData();
  const toast = useToast();
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

  const [isListingModalOpen, setIsListingModalOpen] = useState(false);
  const [isOfferModalOpen, setIsOfferModalOpen] = useState(false);
  const [isAgreementModalOpen, setIsAgreementModalOpen] = useState(false);
  const [isTransferModalOpen, setIsTransferModalOpen] = useState(false);
  const [selectedListing, setSelectedListing] = useState<عروض_البيع_tbl | null>(null);
  const [selectedAgreement, setSelectedAgreement] = useState<اتفاقيات_البيع_tbl | null>(null);

  const handleCreateListing = async (data: any) => {
    const res = selectedListing?.id 
      ? DbService.updateSalesListing(selectedListing.id, data)
      : DbService.addSalesListing(data);
      
    if (res.success) {
      toast.success(res.message);
      setIsListingModalOpen(false);
      setSelectedListing(null);
      loadData();
    } else {
      toast.error(res.message);
    }
  };

  const handleUpdateOfferStatus = async (offerId: string, status: 'Accepted' | 'Rejected') => {
    const res = DbService.updateSalesOfferStatus(offerId, status);
    if (res.success) {
      toast.success(res.message);
      loadData();
    } else {
      toast.error(res.message);
    }
  };

  const handleDeleteOffer = async (offer: any) => {
    const ok = await toast.confirm({
      title: 'تأكيد الحذف',
      message: 'هل أنت متأكد من حذف عرض الشراء هذا؟',
      isDangerous: true
    });
    if (ok) {
      const res = DbService.deleteSalesOffer(offer.id);
      if (res.success) {
        toast.success(res.message);
        loadData();
      } else {
        toast.error(res.message);
      }
    }
  };

  const handleCreateOffer = async (data: any) => {
    const res = DbService.addSalesOffer({ ...data, listingId: selectedListing?.id });
    if (res.success) {
      toast.success(res.message);
      setIsOfferModalOpen(false);
      loadData();
    } else {
      toast.error(res.message);
    }
  };

  const handleCreateAgreement = async (data: any) => {
    const res = selectedAgreement?.id 
      ? DbService.updateSalesAgreement(selectedAgreement.id, data)
      : DbService.addSalesAgreement({ ...data, listingId: selectedListing?.id });
      
    if (res.success) {
      toast.success(res.message);
      setIsAgreementModalOpen(false);
      setSelectedAgreement(null);
      loadData();
    } else {
      toast.error(res.message);
    }
  };

  const handleEditAgreement = (agreement: اتفاقيات_البيع_tbl) => {
    setSelectedAgreement(agreement);
    setIsAgreementModalOpen(true);
  };

  const handleEditListing = (listing: عروض_البيع_tbl) => {
    setSelectedListing(listing);
    setIsListingModalOpen(true);
  };

  const handleDeleteListing = async (listing: عروض_البيع_tbl) => {
    const ok = await toast.confirm({
      title: 'تأكيد الحذف',
      message: 'هل أنت متأكد من حذف عرض البيع هذا؟ سيتم إرجاع حالة العقار لوضعها الطبيعي.',
      isDangerous: true
    });
    if (ok) {
      const res = DbService.deleteSalesListing(listing.id!);
      if (res.success) {
        toast.success(res.message);
        loadData();
      } else {
        toast.error(res.message);
      }
    }
  };

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
              onClick={() => setIsAgreementModalOpen(true)}
            >
              {t('إنشاء اتفاقية')}
            </Button>
            <Button
              className="bg-indigo-600 hover:bg-indigo-700 text-white font-black px-6 py-3 rounded-2xl shadow-lg shadow-indigo-600/20 transition-all active:scale-95"
              leftIcon={<Plus size={20} />}
              onClick={() => setIsListingModalOpen(true)}
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
              getPropertyLabel={getPropertyLabel}
              getPersonName={getPersonName}
              onView={handleEditListing}
              onEdit={handleEditListing}
              onCreateOffer={(l) => {
                setSelectedListing(l);
                setIsOfferModalOpen(true);
              }}
              onDelete={handleDeleteListing}
            />
          )}
          {activeTab === 'offers' && (
            <SalesOffersTab 
              offers={offers} 
              isLoading={isLoading} 
              getPropertyLabel={getPropertyLabel}
              getPersonName={getPersonName}
              listings={listings}
              onUpdateStatus={handleUpdateOfferStatus}
              onDelete={handleDeleteOffer}
            />
          )}
          {activeTab === 'agreements' && (
            <SalesAgreementsTab 
              agreements={agreements} 
              isLoading={isLoading} 
              listings={listings}
              getPropertyLabel={getPropertyLabel}
              getPersonName={getPersonName}
              onFinalize={(a) => {
                setSelectedAgreement(a);
                setIsTransferModalOpen(true);
              }}
              onEdit={handleEditAgreement}
            />
          )}
        </div>
      </div>

      <NewListingModal 
        isOpen={isListingModalOpen} 
        onClose={() => {
          setIsListingModalOpen(false);
          setSelectedListing(null);
        }} 
        onSubmit={handleCreateListing} 
        initialData={selectedListing}
      />
      
      <NewOfferModal 
        isOpen={isOfferModalOpen} 
        onClose={() => setIsOfferModalOpen(false)} 
        onSubmit={handleCreateOffer}
      />

      <AgreementModal
        isOpen={isAgreementModalOpen}
        onClose={() => setIsAgreementModalOpen(false)}
        onSubmit={handleCreateAgreement}
        listings={listings}
        offers={offers}
        getPropertyLabel={getPropertyLabel}
        getPersonName={getPersonName}
        employees={employees}
        initialData={selectedAgreement}
      />

      <TransferOwnershipModal 
        isOpen={isTransferModalOpen}
        onClose={() => {
          setIsTransferModalOpen(false);
          setSelectedAgreement(null);
        }}
        agreement={selectedAgreement}
        getPropertyLabel={getPropertyLabel}
        getPersonName={getPersonName}
        employees={employees}
        onSuccess={loadData}
      />
    </div>
  );
};