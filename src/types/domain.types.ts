import type {
  الأشخاص_tbl,
  العقارات_tbl,
  العقود_tbl,
  الكمبيالات_tbl,
  ContractDetailsResult,
  PersonDetailsResult,
} from '@/types/types';

export type DomainEntity = 'people' | 'properties' | 'contracts';

export type DomainEntityMap = {
  people: الأشخاص_tbl;
  properties: العقارات_tbl;
  contracts: العقود_tbl;
};

export type PropertyPickerOccupancy = 'all' | 'rented' | 'vacant';
export type PropertyPickerSale = 'for-sale' | 'not-for-sale' | '';
export type PropertyPickerRent = 'for-rent' | 'not-for-rent' | '';
export type PropertyPickerContractLink = '' | 'linked' | 'unlinked' | 'all';

export type PropertyPickerSearchPayload = {
  query: string;
  status?: string;
  type?: string;
  forceVacant?: boolean;
  occupancy?: PropertyPickerOccupancy;
  sale?: PropertyPickerSale;
  rent?: PropertyPickerRent;
  minArea?: string;
  maxArea?: string;
  floor?: string;
  minPrice?: string;
  maxPrice?: string;
  contractLink?: PropertyPickerContractLink;
  offset?: number;
  limit?: number;
};

export type PropertyPickerItem = {
  property: العقارات_tbl;
  ownerName?: string;
  ownerPhone?: string;
  ownerNationalId?: string;
  active?: العقود_tbl;
};

export type ContractPickerItem = {
  contract: العقود_tbl;
  propertyCode?: string;
  ownerName?: string;
  tenantName?: string;
  ownerNationalId?: string;
  tenantNationalId?: string;
  remainingAmount?: number;
};

export type PeoplePickerLink = {
  contractId: string;
  status?: string;
  propertyCode?: string;
  tenantName?: string;
  guarantorName?: string;
  source?: 'tenant' | 'guarantor' | 'owner' | '';
};

export type PeoplePickerItem = {
  person: الأشخاص_tbl;
  roles?: string[];
  isBlacklisted?: boolean;
  link?: PeoplePickerLink | null;
};

export type InstallmentsContractsItem = {
  contract: العقود_tbl;
  tenant?: الأشخاص_tbl;
  property?: العقارات_tbl;
  installments?: الكمبيالات_tbl[];
  hasDebt?: boolean;
  hasDueSoon?: boolean;
  isFullyPaid?: boolean;
};

export type { ContractDetailsResult, PersonDetailsResult };
