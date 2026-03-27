/**
 * © 2025 - Developed by Mahmoud Qattoush
 * AZRAR Real Estate Management System - All Rights Reserved
 *
 * صفحة إدارة العقود (Contracts Management Page)
 * - عرض وإدارة جميع عقود الإيجار
 * - البحث والفلترة المتقدمة
 * - إدارة حالات العقود (نشط، منتهي، مفسوخ)
 * - التكامل الكامل مع DbService فقط (لا اعتماد عكسي)
 *
 * 📊 مصدر البيانات:
 * - DbService.getContracts() - جلب جميع العقود
 * - DbService.getPeople() - للحصول على أسماء المستأجرين
 * - DbService.getProperties() - للحصول على أكواد العقارات
 *
 * 🎯 متى يظهر EmptyState:
 * - عند عدم وجود عقود في النظام (contracts.length === 0)
 * - عند عدم وجود نتائج بحث (filteredContracts.length === 0 && searchTerm)
 * - عند عدم وجود نتائج فلترة (filteredContracts.length === 0 && filters)
 *
 * ⚠️ DataGuard:
 * - يُستخدم للتحقق من وجود أشخاص وعقارات قبل إنشاء عقد جديد
 * - يظهر رسالة تنبيه إذا لم تكن البيانات المطلوبة موجودة
 */

import React from 'react';
import { useContracts } from '@/hooks/useContracts';
import { ContractsPageView } from '@/components/contracts/ContractsPageView';

export const Contracts: React.FC = () => {
  const page = useContracts();
  return <ContractsPageView page={page} />;
};
