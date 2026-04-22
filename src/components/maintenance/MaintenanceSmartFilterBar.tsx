import React from 'react';
import { SmartFilterBar } from '@/components/shared/SmartFilterBar';
import { Layers, Clock, CheckCircle } from 'lucide-react';

interface MaintenanceSmartFilterBarProps {
  onNewTicket: () => void;
  statusFilter: 'all' | 'open' | 'closed';
  setStatusFilter: (status: 'all' | 'open' | 'closed') => void;
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  onRefresh: () => void;
  totalResults: number;
  currentPage?: number;
  totalPages?: number;
  onPageChange?: (page: number) => void;
}

export const MaintenanceSmartFilterBar: React.FC<MaintenanceSmartFilterBarProps> = ({
  onNewTicket,
  statusFilter,
  setStatusFilter,
  searchQuery,
  setSearchQuery,
  onRefresh,
  totalResults,
  currentPage,
  totalPages,
  onPageChange,
}) => {
  return (
    <SmartFilterBar
      addButton={{
        label: 'طلب صيانة جديد',
        onClick: onNewTicket,
        permission: 'EDIT_MAINTENANCE',
      }}
      searchValue={searchQuery}
      onSearchChange={setSearchQuery}
      searchPlaceholder="بحث في طلبات الصيانة..."
      tabs={[
        { id: 'all', label: 'الكل', icon: Layers },
        { id: 'open', label: 'نشط', icon: Clock },
        { id: 'closed', label: 'مكتمل', icon: CheckCircle },
      ]}
      activeTab={statusFilter}
      onTabChange={(id) => setStatusFilter(id as 'all' | 'open' | 'closed')}
      onRefresh={onRefresh}
      totalResults={totalResults}
      currentPage={currentPage}
      totalPages={totalPages}
      onPageChange={onPageChange}
    />
  );
};
