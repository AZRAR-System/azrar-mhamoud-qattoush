export type DesktopDbPeopleBridge = {
  domainPeoplePickerSearch?: unknown;
};

export type PeopleAdvFiltersState = {
  address: string;
  nationalId: string;
  classification: string;
  minRating: number;
};

export type PeopleSortMode = 'name-asc' | 'name-desc' | 'updated-desc' | 'updated-asc';
