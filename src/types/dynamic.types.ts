/**
 * � 2025 � Developed by Mahmoud Qattoush
 * AZRAR Real Estate Management System � All Rights Reserved
 * 
 * Dynamic Form and Attachment types
 */

export type FieldType = 'text' | 'number' | 'date' | 'boolean' | 'select';
export type ReferenceType = 'Person' | 'Property' | 'Contract' | 'Maintenance' | 'Sales' | 'Inspection';

export interface DynamicFormField {
  id: string;
  formId: string;
  name: string;
  label: string;
  type: FieldType;
  options?: string[];
}

export interface DynamicTable {
  id: string;
  title: string;
  fields: { id: string; name: string; label: string; type: FieldType }[];
}

export interface DynamicRecord {
  id: string;
  tableId: string;
  [key: string]: any;
}

export interface Attachment {
  id: string;
  referenceType: ReferenceType;
  referenceId: string;
  fileName: string;
  fileSize: number;
  fileType: string;
  fileExtension: string;
  fileData?: string;
  /** Desktop (Electron) filesystem relative path from attachments root */
  filePath?: string;
  uploadDate: string;
  uploadedBy: string;
}

export interface ActivityRecord {
  id: string;
  referenceType: ReferenceType;
  referenceId: string;
  actionType: string;
  description: string;
  date: string;
  employee: string;
}

export interface NoteRecord {
  id: string;
  referenceType: ReferenceType;
  referenceId: string;
  content: string;
  date: string;
  employee: string;
}
