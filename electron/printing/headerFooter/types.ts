export type HeaderFooterInput = {
  headerEnabled?: boolean;
  footerEnabled?: boolean;

  headerTemplate?: string;
  footerTemplate?: string;

  companyName?: string;
  companySlogan?: string;
  companyIdentityText?: string;

  userName?: string;
  dateIso?: string;
};

export type HeaderFooterResolved = {
  headerEnabled: boolean;
  footerEnabled: boolean;
  headerLines: string[];
  footerLine: string;
};
