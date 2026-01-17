/**
 * � 2025 � Developed by Mahmoud Qattoush
 * AZRAR Real Estate Management System � All Rights Reserved
 * 
 * Report and Legal types
 */

export type ReportCategory = 'Financial' | 'Contracts' | 'Properties' | 'Tenants' | 'Maintenance';

export interface ReportDefinition {
  id: string;
  title: string;
  description: string;
  category: ReportCategory;
}

export interface ReportResult {
  title: string;
  generatedAt: string;
  columns: { key: string; header: string; type?: 'text' | 'number' | 'currency' | 'date' | 'status' }[];
  data: unknown[];
  summary?: { label: string; value: string | number }[];
}

export interface LegalNoticeTemplate {
  id: string;
  title: string;
  category: 'Warning' | 'Eviction' | 'Renewal' | 'General';
  content: string;
}

export interface LegalNoticeRecord {
  id: string;
  contractId: string;
  tenantId: string;
  templateTitle: string;
  contentSnapshot: string;
  sentDate: string;
  sentMethod: 'WhatsApp' | 'Email' | 'Print';
  createdBy: string;
  note?: string;
  reply?: string;
}
