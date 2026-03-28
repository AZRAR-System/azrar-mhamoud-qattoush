/**
 * © 2025 - Developed by Mahmoud Qattoush
 * AZRAR Real Estate Management System - All Rights Reserved
 *
 * صفحة إدارة الأشخاص (People Management Page)
 * - عرض وإدارة جميع الأشخاص (مالكين، مستأجرين، كفلاء)
 * - البحث والفلترة المتقدمة
 * - إدارة القائمة السوداء
 * - التكامل الكامل مع DbService فقط (لا اعتماد عكسي)
 *
 * 📊 مصدر البيانات:
 * - DbService.getPeople() - جلب جميع الأشخاص
 * - DbService.getProperties() - للتحقق من حالة العقارات
 * - DbService.getLookupsByCategory('person_roles') - الأدوار المتاحة
 *
 * 🎯 متى يظهر EmptyState:
 * - عند عدم وجود أشخاص في النظام (people.length === 0)
 * - عند عدم وجود نتائج بحث (filtered.length === 0 && searchTerm)
 * - عند عدم وجود نتائج فلترة (filtered.length === 0 && activeRoleTab !== 'all')
 *
 * ⚠️ DataGuard:
 * - غير مستخدم في هذه الصفحة (لا توجد بيانات مطلوبة مسبقاً)
 */

import React from 'react';
import { usePeople } from '@/hooks/usePeople';
import { PeoplePageView } from '@/components/people/PeoplePageView';

export const People: React.FC = () => {
  const page = usePeople();
  return <PeoplePageView page={page} />;
};
