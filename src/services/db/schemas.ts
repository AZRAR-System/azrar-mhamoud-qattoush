/**
 * © 2025 — Developed by Mahmoud Qattoush
 * AZRAR Real Estate Management System — All Rights Reserved
 * 
 * Data Integrity Layer: Zod Schemas for Core Tables
 */

import { z } from 'zod';
import { KEYS } from './keys';

// --- Shared Components ---
const DynamicFieldsSchema = z.record(z.string(), z.any()).optional();

// --- Core Schemas ---

export const PeopleSchema = z.object({
  رقم_الشخص: z.string().min(1),
  الاسم: z.string().min(1),
  الرقم_الوطني: z.string().optional(),
  رقم_الهاتف: z.string().min(1),
  رقم_هاتف_اضافي: z.string().optional(),
  البريد_الإلكتروني: z.string().optional(),
  العنوان: z.string().optional(),
  عنوان_السكن: z.string().optional(),
  ملاحظات: z.string().optional(),
  رقم_نوع_الشخص: z.string().optional(),
  تصنيف: z.string().optional(),
  تقييم: z.number().min(0).max(10).optional(),
  نوع_الملف: z.enum(['فرد', 'منشأة']).optional(),
  طبيعة_الشركة: z.string().optional(),
  تصنيف_السلوك: z.object({
    type: z.string(),
    points: z.number(),
    history: z.array(z.object({
      date: z.string(),
      paymentType: z.enum(['full', 'partial', 'late']),
      pointsChange: z.number(),
      points: z.number()
    }))
  }).optional(),
  حقول_ديناميكية: DynamicFieldsSchema,
});

export const PropertySchema = z.object({
  رقم_العقار: z.string().min(1),
  الكود_الداخلي: z.string().min(1),
  رقم_المالك: z.string().min(1),
  النوع: z.string().min(1),
  العنوان: z.string().min(1),
  المدينة: z.string().optional(),
  المنطقة: z.string().optional(),
  حالة_العقار: z.string(),
  الإيجار_التقديري: z.number().min(0).optional(),
  IsRented: z.boolean(),
  المساحة: z.number().min(0),
  الطابق: z.string().optional(),
  عدد_الغرف: z.string().optional(),
  نوع_التاثيث: z.string().optional(),
  رقم_اشتراك_الكهرباء: z.string().optional(),
  رقم_اشتراك_المياه: z.string().optional(),
  اسم_اشتراك_الكهرباء: z.string().optional(),
  اسم_اشتراك_المياه: z.string().optional(),
  اسم_الحوض: z.string().optional(),
  رقم_قطعة: z.string().optional(),
  رقم_لوحة: z.string().optional(),
  رقم_شقة: z.string().optional(),
  isForRent: z.boolean().optional(),
  isForSale: z.boolean().optional(),
  salePrice: z.number().min(0).optional(),
  minSalePrice: z.number().min(0).optional(),
  حدود_المأجور: z.string().optional(),
  ملاحظات: z.string().optional(),
  الصفة: z.string().optional(),
  حقول_ديناميكية: DynamicFieldsSchema,
});

export const ContractSchema = z.object({
  رقم_العقد: z.string().min(1),
  رقم_العقار: z.string().min(1),
  رقم_المستاجر: z.string().min(1),
  رقم_الكفيل: z.string().optional(),
  تاريخ_الانشاء: z.string().optional(),
  رقم_الفرصة: z.string().optional(),
  رقم_المبنى: z.string().optional(),
  رقم_الكفيل_1: z.string().optional(),
  تاريخ_البداية: z.string().min(1),
  تاريخ_النهاية: z.string().min(1),
  مدة_العقد_بالاشهر: z.number(),
  نص_مدة_العقد: z.string().optional(),
  نص_كيفية_أداء_البدل: z.string().optional(),
  القيمة_السنوية: z.number().min(0),
  تكرار_الدفع: z.number().min(1),
  طريقة_الدفع: z.string(),
  قيمة_التأمين: z.number().min(0).optional(),
  يوجد_دفعة_اولى: z.boolean().optional(),
  قيمة_الدفعة_الاولى: z.number().min(0).optional(),
  عدد_أشهر_الدفعة_الأولى: z.number().min(0).optional(),
  تقسيط_الدفعة_الأولى: z.boolean().optional(),
  عدد_أقساط_الدفعة_الأولى: z.number().min(0).optional(),
  احتساب_فرق_ايام: z.boolean().optional(),
  يوم_الدفع: z.number().min(1).max(31).optional(),
  مبلغ_الفرقية: z.number().min(0).optional(),
  حالة_العقد: z.string(),
  isArchived: z.boolean(),
  عقد_مرتبط: z.string().optional(),
  linkedContractId: z.string().optional(),
  terminationDate: z.string().optional(),
  terminationReason: z.string().optional(),
  autoRenew: z.boolean().optional(),
  lateFeeType: z.enum(['fixed', 'percentage', 'daily', 'none']),
  lateFeeValue: z.number().min(0),
  lateFeeGraceDays: z.number().min(0),
  lateFeeMaxAmount: z.number().min(0).optional(),
  حقول_ديناميكية: DynamicFieldsSchema,
});

export const InstallmentSchema = z.object({
  رقم_الكمبيالة: z.string().min(1),
  رقم_العقد: z.string().min(1),
  تاريخ_استحقاق: z.string().min(1),
  تاريخ_التأجيل: z.string().optional(),
  تاريخ_الاستحقاق_السابق: z.string().optional(),
  القيمة: z.number().min(0),
  القيمة_المتبقية: z.number().min(0).optional(),
  حالة_الكمبيالة: z.string(),
  isArchived: z.boolean().optional(),
  تاريخ_الدفع: z.string().optional(),
  نوع_الكمبيالة: z.string(),
  ترتيب_الكمبيالة: z.number().optional(),
  نوع_الدفعة: z.string().optional(),
  رقم_القسط: z.number().optional(),
  سجل_الدفعات: z.array(z.object({
    رقم_العملية: z.string(),
    المبلغ: z.number(),
    التاريخ: z.string(),
    الملاحظات: z.string().optional(),
    المستخدم: z.string(),
    الدور: z.string(),
    النوع: z.enum(['FULL', 'PARTIAL'])
  })).optional(),
  ملاحظات: z.string().optional(),
});

// --- Schema Mapping ---

const schemaMap: Record<string, z.ZodSchema> = {
  [KEYS.PEOPLE]: z.array(PeopleSchema),
  [KEYS.PROPERTIES]: z.array(PropertySchema),
  [KEYS.CONTRACTS]: z.array(ContractSchema),
  [KEYS.INSTALLMENTS]: z.array(InstallmentSchema),
};

export function validateBeforeSave(key: string, data: unknown): { valid: boolean; errors?: string[] } {
  const schema = schemaMap[key];
  if (!schema) return { valid: true }; // Keys without schemas pass through
  
  const result = schema.safeParse(data);
  if (result.success) return { valid: true };
  
  const errors = result.error.issues.map(e => `${e.path.join('.')}: ${e.message}`);
  console.error(`[Schema Validation Blocked] ${key}:`, errors);
  return { valid: false, errors };
}
