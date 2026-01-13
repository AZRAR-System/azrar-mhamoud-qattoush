/**
 * © 2025 - Developed by Mahmoud Qattoush
 * AZRAR Real Estate Management System - All Rights Reserved
 * 
 * Data Guards & Navigation Safety
 * يوفر حماية للتنقل بين الصفحات والتحقق من وجود البيانات المطلوبة
 */

import { DbService } from '@/services/mockDb';

const isDesktopRuntime = () => typeof window !== 'undefined' && !!(window as any)?.desktopDb;

/**
 * نتيجة التحقق من البيانات
 */
export interface DataGuardResult {
  isValid: boolean;
  message?: string;
  missingData?: string[];
}

/**
 * التحقق من وجود شخص معين
 */
export const guardPersonExists = (personId: string): DataGuardResult => {
  if (!personId) {
    return {
      isValid: false,
      message: 'معرف الشخص مطلوب',
      missingData: ['personId']
    };
  }

  // Desktop focus: avoid loading huge arrays in renderer.
  if (isDesktopRuntime()) {
    return { isValid: true };
  }

  const people = DbService.getPeople();
  const person = people.find(p => p.رقم_الشخص === personId);

  if (!person) {
    return {
      isValid: false,
      message: `الشخص غير موجود (${personId})`,
      missingData: ['person']
    };
  }

  return { isValid: true };
};

/**
 * التحقق من وجود عقار معين
 */
export const guardPropertyExists = (propertyId: string): DataGuardResult => {
  if (!propertyId) {
    return {
      isValid: false,
      message: 'معرف العقار مطلوب',
      missingData: ['propertyId']
    };
  }

  // Desktop focus: avoid loading huge arrays in renderer.
  if (isDesktopRuntime()) {
    return { isValid: true };
  }

  const properties = DbService.getProperties();
  const property = properties.find(p => p.رقم_العقار === propertyId);

  if (!property) {
    return {
      isValid: false,
      message: `العقار غير موجود (${propertyId})`,
      missingData: ['property']
    };
  }

  return { isValid: true };
};

/**
 * التحقق من وجود عقد معين
 */
export const guardContractExists = (contractId: string): DataGuardResult => {
  if (!contractId) {
    return {
      isValid: false,
      message: 'معرف العقد مطلوب',
      missingData: ['contractId']
    };
  }

  // Desktop focus: avoid loading huge arrays in renderer.
  if (isDesktopRuntime()) {
    return { isValid: true };
  }

  const contracts = DbService.getContracts();
  const contract = contracts.find(c => c.رقم_العقد === contractId);

  if (!contract) {
    return {
      isValid: false,
      message: `العقد غير موجود (${contractId})`,
      missingData: ['contract']
    };
  }

  return { isValid: true };
};

/**
 * التحقق من وجود بيانات في النظام
 */
export const guardHasData = (): DataGuardResult => {
  // Desktop focus: avoid loading huge arrays in renderer.
  // Pages that need strict checks should use SQL counts (domainCountsSmart) instead.
  if (isDesktopRuntime()) {
    return { isValid: true };
  }

  const people = DbService.getPeople();
  const properties = DbService.getProperties();
  const contracts = DbService.getContracts();

  const missingData: string[] = [];

  if (people.length === 0) missingData.push('people');
  if (properties.length === 0) missingData.push('properties');
  if (contracts.length === 0) missingData.push('contracts');

  if (missingData.length > 0) {
    return {
      isValid: false,
      message: 'لا توجد بيانات كافية في النظام',
      missingData
    };
  }

  return { isValid: true };
};

/**
 * التحقق من وجود أشخاص في النظام
 */
export const guardHasPeople = (): DataGuardResult => {
  if (isDesktopRuntime()) {
    return { isValid: true };
  }

  const people = DbService.getPeople();

  if (people.length === 0) {
    return {
      isValid: false,
      message: 'لا يوجد أشخاص في النظام. يرجى إضافة أشخاص أولاً.',
      missingData: ['people']
    };
  }

  return { isValid: true };
};

/**
 * التحقق من وجود عقارات في النظام
 */
export const guardHasProperties = (): DataGuardResult => {
  if (isDesktopRuntime()) {
    return { isValid: true };
  }

  const properties = DbService.getProperties();

  if (properties.length === 0) {
    return {
      isValid: false,
      message: 'لا توجد عقارات في النظام. يرجى إضافة عقارات أولاً.',
      missingData: ['properties']
    };
  }

  return { isValid: true };
};

/**
 * التحقق من وجود عقود في النظام
 */
export const guardHasContracts = (): DataGuardResult => {
  if (isDesktopRuntime()) {
    return { isValid: true };
  }

  const contracts = DbService.getContracts();

  if (contracts.length === 0) {
    return {
      isValid: false,
      message: 'لا توجد عقود في النظام. يرجى إضافة عقود أولاً.',
      missingData: ['contracts']
    };
  }

  return { isValid: true };
};

