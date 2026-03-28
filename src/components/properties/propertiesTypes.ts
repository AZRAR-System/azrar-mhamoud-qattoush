import type { العقارات_tbl } from '@/types';

export type DesktopDbBridge = {
  domainPropertyPickerSearch?: unknown;
};

export type DesktopPropertyPickerItem = {
  property: العقارات_tbl;
  ownerName?: string;
  ownerPhone?: string;
  ownerNationalId?: string;
  active?: {
    contractId?: string;
    status?: string;
    startDate?: string;
    endDate?: string;
    tenantName?: string;
    tenantPhone?: string;
    guarantorName?: string;
    guarantorPhone?: string;
  } | null;
};

export type SaleFilter = '' | 'for-sale' | 'not-for-sale';
export type RentFilter = '' | 'for-rent' | 'not-for-rent';
export type ContractLinkFilter = 'all' | 'linked' | 'unlinked';

export type PropertyExtras = {
  IsRented?: boolean;
  isForRent?: boolean;
  نوع_التاثيث?: string;
  حقول_ديناميكية?: Record<string, unknown>;
};

export type PropertiesFiltersState = {
  status: string;
  type: string;
  furnishing: string;
  sale: SaleFilter;
  rent: RentFilter;
};

export type PropertiesAdvFiltersState = {
  minArea: string;
  maxArea: string;
  minPrice: string;
  maxPrice: string;
  floor: string;
  contractLink: ContractLinkFilter;
};
