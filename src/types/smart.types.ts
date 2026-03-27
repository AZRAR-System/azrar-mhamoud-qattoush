/**
 * � 2025 � Developed by Mahmoud Qattoush
 * AZRAR Real Estate Management System � All Rights Reserved
 *
 * Smart Engine types
 */

export type SmartCategory = 'person' | 'property' | 'contract' | 'maintenance';

export interface SmartBehaviorPattern {
  category: SmartCategory;
  field: string;
  value: unknown;
  timestamp: number;
}

export interface SmartSuggestion {
  field: string;
  suggestedValue: unknown;
  confidence: number; // 0 to 1
  reason?: string;
}

export interface SmartRule {
  learningKey: string; // matches field name
  hint: string;
  expectedType: 'string' | 'number' | 'email' | 'phone' | 'date';
  validation?: {
    regex?: RegExp;
    min?: number;
    max?: number;
    options?: string[];
  };
  severity: 'info' | 'warning' | 'error';
}
