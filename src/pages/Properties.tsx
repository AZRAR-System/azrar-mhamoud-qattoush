/**
 * © 2025 - Developed by Mahmoud Qattoush
 * AZRAR Real Estate Management System - All Rights Reserved
 *
 * صفحة إدارة العقارات (Properties Management Page)
 * - عرض وإدارة جميع العقارات (شقق، فلل، مكاتب، محلات)
 * - البحث والفلترة المتقدمة
 * - إدارة حالات العقارات
 * - التكامل الكامل مع DbService فقط (لا اعتماد عكسي)
 *
 * 📊 مصدر البيانات:
 * - DbService.getProperties() - جلب جميع العقارات
 * - DbService.getPeople() - للحصول على أسماء المالكين
 *
 * 🎯 متى يظهر EmptyState:
 * - عند عدم وجود عقارات في النظام (properties.length === 0)
 * - عند عدم وجود نتائج بحث (filteredProperties.length === 0 && searchTerm)
 * - عند عدم وجود نتائج فلترة (filteredProperties.length === 0 && filters)
 *
 * ⚠️ DataGuard:
 * - غير مستخدم في هذه الصفحة (لا توجد بيانات مطلوبة مسبقاً)
 */

import React from 'react';
import { useProperties } from '@/hooks/useProperties';
import { PropertiesPageView } from '@/components/properties/PropertiesPageView';

export const Properties: React.FC = () => {
  const page = useProperties();
  return <PropertiesPageView page={page} />;
};
