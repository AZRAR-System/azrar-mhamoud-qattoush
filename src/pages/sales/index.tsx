import React, { useState, useCallback } from 'react';
import { BadgeDollarSign } from 'lucide-react';
import { SmartPageHero } from '@/components/shared/SmartPageHero';
import { SalesSmartFilterBar } from './components/SalesSmartFilterBar';
import { SalesDashboard } from './components/SalesDashboard';
import { SalesListingsTab } from './components/SalesListingsTab';
import { SalesOffersTab } from './components/SalesOffersTab';
import { SalesAgreementsTab } from './components/SalesAgreementsTab';
import { AgreementModal } from './components/modals/AgreementModal';
import { TransferOwnershipModal } from './components/modals/TransferOwnershipModal';
import { NewListingModal } from './components/modals/NewListingModal';
import { NewOfferModal } from './components/modals/NewOfferModal';
import { عروض_البيع_tbl, عروض_الشراء_tbl, اتفاقيات_البيع_tbl } from '@/types';
import { DbService } from '@/services/mockDb';
import { useToast } from '@/context/ToastContext';
import { useSalesData } from './hooks/useSalesData';
import { useSalesFilters } from './hooks/useSalesFilters';
const t = (s: string) => s;

const SalesComponent: React.FC = () => {
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
  } = useSalesFilters();

  const [isListingModalOpen, setIsListingModalOpen] = useState(false);
  const [isOfferModalOpen, setIsOfferModalOpen] = useState(false);
  const [isAgreementModalOpen, setIsAgreementModalOpen] = useState(false);
  const [isTransferModalOpen, setIsTransferModalOpen] = useState(false);
  const [selectedListing, setSelectedListing] = useState<عروض_البيع_tbl | null>(null);
  const [selectedAgreement, setSelectedAgreement] = useState<اتفاقيات_البيع_tbl | null>(null);

  const handleCreateListing = useCallback(async (data: Partial<عروض_البيع_tbl>) => {
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
  }, [selectedListing, toast, loadData]);

  const handleUpdateOfferStatus = useCallback(async (offerId: string, status: 'Accepted' | 'Rejected') => {
    const res = DbService.updateSalesOfferStatus(offerId, status);
    if (res.success) {
      toast.success(res.message);
      loadData();
    } else {
      toast.error(res.message);
    }
  }, [toast, loadData]);

  const handleDeleteOffer = useCallback(async (offer: عروض_الشراء_tbl) => {
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
  }, [toast, loadData]);

  const handleCreateOffer = useCallback(async (data: Partial<عروض_الشراء_tbl>) => {
    const res = DbService.addSalesOffer({ ...data, listingId: selectedListing?.id });
    if (res.success) {
      toast.success(res.message);
      setIsOfferModalOpen(false);
      loadData();
    } else {
      toast.error(res.message);
    }
  }, [selectedListing, toast, loadData]);

  const handleCreateAgreement = useCallback(
    async (data: Partial<اتفاقيات_البيع_tbl>) => {
      const listingId = String(data.listingId || selectedListing?.id || '').trim();
      const buyerId = String(data.رقم_المشتري || '').trim();

      if (!listingId) {
        toast.error('يرجى اختيار عرض البيع (العقار) المرتبط بالاتفاقية من الخطوة الأولى.');
        return;
      }
      if (!buyerId) {
        toast.error('يرجى تحديد المشتري: اختر عرض شراء معلّق، أو أدخل رقم المشتري عند غياب العروض.');
        return;
      }

      const payload: Partial<اتفاقيات_البيع_tbl> = { ...data, listingId, رقم_المشتري: buyerId };

      const res = selectedAgreement?.id
        ? DbService.updateSalesAgreement(selectedAgreement.id, payload)
        : DbService.addSalesAgreement(payload);

      if (res.success) {
        toast.success(res.message);
        setIsAgreementModalOpen(false);
        setSelectedAgreement(null);
        setSelectedListing(null);
        loadData();
      } else {
        toast.error(res.message);
      }
    },
    [selectedAgreement, selectedListing, toast, loadData]
  );

  const handleEditAgreement = useCallback((agreement: اتفاقيات_البيع_tbl) => {
    setSelectedListing(null);
    setSelectedAgreement(agreement);
    setIsAgreementModalOpen(true);
  }, []);

  const handleEditListing = useCallback((listing: عروض_البيع_tbl) => {
    setSelectedListing(listing);
    setIsListingModalOpen(true);
  }, []);

  const handleDeleteListing = useCallback(async (listing: عروض_البيع_tbl) => {
    const ok = await toast.confirm({
      title: 'تأكيد الحذف',
      message: 'هل أنت متأكد من حذف عرض البيع هذا؟ سيتم إرجاع حالة العقار لوضعها الطبيعي.',
      isDangerous: true
    });
    if (ok && listing.id) {
      const res = DbService.deleteSalesListing(listing.id);
      if (res.success) {
        toast.success(res.message);
        loadData();
      } else {
        toast.error(res.message);
      }
    }
  }, [toast, loadData]);

  return (
    <div className="space-y-6">
      <SmartPageHero
        variant="premium"
        icon={<BadgeDollarSign size={28} />}
        title={t('إدارة المبيعات')}
        description={t('نظام متكامل لإدارة عروض البيع، المفاوضات، ونقل الملكية')}
      />

      <SalesSmartFilterBar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        statusFilter={statusFilter}
        setStatusFilter={setStatusFilter}
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
        listingMarketingFilter={listingMarketingFilter}
        setListingMarketingFilter={setListingMarketingFilter}
        onNewListing={() => setIsListingModalOpen(true)}
        onNewAgreement={() => {
          setSelectedAgreement(null);
          setSelectedListing(null);
          setIsAgreementModalOpen(true);
        }}
        totalResults={
          activeTab === 'listings' ? listings.length :
          activeTab === 'offers' ? offers.length :
          agreements.length
        }
      />

      <SalesDashboard stats={stats} />

      <div className="app-card overflow-hidden">
        <div className="p-0">
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
        onClose={() => {
          setIsAgreementModalOpen(false);
          setSelectedAgreement(null);
          setSelectedListing(null);
        }}
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

export const Sales = React.memo(SalesComponent);