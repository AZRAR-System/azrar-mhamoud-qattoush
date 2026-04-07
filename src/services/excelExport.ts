/**
 * نظام تصدير Excel شامل لجميع بيانات النظام
 */

import * as XLSX from 'xlsx';
import { saveAs } from 'file-saver';
import { formatDateOnly, formatCurrencyJOD } from '@/utils/format';
import { getPersons } from '@/services/db/persons';
import { getContracts } from '@/services/db/contracts';
import { getInstallments } from '@/services/db/installments';
import { getProperties } from '@/services/db/properties';

function getExcelDate(dateStr: string): string {
  return dateStr || '-';
}

/**
 * تصدير جميع الأشخاص إلى Excel
 */
export function exportAllPersons(): void {
  const persons = getPersons();
  const data = persons.map(p => ({
    'رقم الشخص': p.رقم_الشخص,
    'الاسم الكامل': p.الاسم,
    'رقم الهاتف': p.رقم_الهاتف,
    'الرقم الوطني': p.الرقم_الوطني,
    'البريد الإلكتروني': p.البريد_الالكتروني,
    'العنوان': p.العنوان,
    'الملاحظات': p.ملاحظات,
    'تاريخ الإنشاء': getExcelDate(p.تاريخ_الانشاء)
  }));

  const ws = XLSX.utils.json_to_sheet(data);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'الأشخاص');
  
  const buf = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
  saveAs(new Blob([buf]), `الاشخاص_${formatDateOnly(new Date())}.xlsx`);
}

/**
 * تصدير جميع العقود إلى Excel
 */
export function exportAllContracts(): void {
  const contracts = getContracts();
  const data = contracts.map(c => ({
    'رقم العقد': c.رقم_العقد,
    'رقم العقار': c.رقم_العقار,
    'رقم المستأجر': c.رقم_المستأجر,
    'تاريخ البداية': getExcelDate(c.تاريخ_البداية),
    'تاريخ النهاية': getExcelDate(c.تاريخ_النهاية),
    'مدة العقد (شهر)': c.مدة_العقد_بالاشهر,
    'قيمة العقد الشهرية': formatCurrencyJOD(c.قيمة_الشهرية),
    'إجمالي قيمة العقد': formatCurrencyJOD(c.القيمة_الاجمالية),
    'الحالة': c.حالة_العقد,
    'التجديد التلقائي': c.autoRenew ? 'مفعل' : 'غير مفعل',
    'تاريخ الفسخ': getExcelDate(c.terminationDate),
    'سبب الفسخ': c.terminationReason || '-'
  }));

  const ws = XLSX.utils.json_to_sheet(data);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'العقود');
  
  const buf = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
  saveAs(new Blob([buf]), `العقود_${formatDateOnly(new Date())}.xlsx`);
}

/**
 * تصدير جميع الأقساط والدفعات إلى Excel
 */
export function exportAllInstallments(): void {
  const installments = getInstallments();
  const data = installments.map(i => ({
    'رقم الكمبيالة': i.رقم_الكمبيالة,
    'رقم العقد': i.رقم_العقد,
    'ترتيب الكمبيالة': i.ترتيب_الكمبيالة,
    'تاريخ الاستحقاق': getExcelDate(i.تاريخ_استحقاق),
    'المبلغ': formatCurrencyJOD(i.المبلغ),
    'المبلغ المدفوع': formatCurrencyJOD(i.المبلغ_المدفوع || 0),
    'الحالة': i.حالة_الكمبيالة,
    'نوع الكمبيالة': i.نوع_الكمبيالة,
    'تاريخ الدفع': getExcelDate(i.تاريخ_الدفع),
    'ملاحظات': i.ملاحظات || '-'
  }));

  const ws = XLSX.utils.json_to_sheet(data);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'الأقساط والدفعات');
  
  const buf = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
  saveAs(new Blob([buf]), `الاقساط_${formatDateOnly(new Date())}.xlsx`);
}

/**
 * تصدير جميع العقارات إلى Excel
 */
export function exportAllProperties(): void {
  const properties = getProperties();
  const data = properties.map(p => ({
    'رقم العقار': p.رقم_العقار,
    'الكود الداخلي': p.الكود_الداخلي,
    'العنوان': p.العنوان,
    'النوع': p.نوع_العقار,
    'رقم المالك': p.رقم_المالك,
    'الحالة': p.حالة_العقار,
    'قيمة الايجار الشهرية': formatCurrencyJOD(p.قيمة_الايجار),
    'رقم اشتراك الكهرباء': p.رقم_اشتراك_الكهرباء || '-',
    'رقم اشتراك المياه': p.رقم_اشتراك_المياه || '-',
    'الملاحظات': p.ملاحظات || '-'
  }));

  const ws = XLSX.utils.json_to_sheet(data);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'العقارات');
  
  const buf = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
  saveAs(new Blob([buf]), `العقارات_${formatDateOnly(new Date())}.xlsx`);
}

/**
 * تصدير تقرير شامل كامل مع جميع الأوراق في ملف واحد
 */
export function exportFullSystemReport(): void {
  const wb = XLSX.utils.book_new();

  // ورقة الأشخاص
  const persons = getPersons().map(p => ({
    'رقم الشخص': p.رقم_الشخص,
    'الاسم الكامل': p.الاسم,
    'رقم الهاتف': p.رقم_الهاتف,
    'الرقم الوطني': p.الرقم_الوطني,
    'العنوان': p.العنوان
  }));
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(persons), 'الأشخاص');

  // ورقة العقارات
  const properties = getProperties().map(p => ({
    'رقم العقار': p.رقم_العقار,
    'الكود الداخلي': p.الكود_الداخلي,
    'العنوان': p.العنوان,
    'النوع': p.نوع_العقار,
    'الحالة': p.حالة_العقار,
    'قيمة الايجار': formatCurrencyJOD(p.قيمة_الايجار)
  }));
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(properties), 'العقارات');

  // ورقة العقود
  const contracts = getContracts().map(c => ({
    'رقم العقد': c.رقم_العقد,
    'رقم العقار': c.رقم_العقار,
    'رقم المستأجر': c.رقم_المستأجر,
    'تاريخ البداية': getExcelDate(c.تاريخ_البداية),
    'تاريخ النهاية': getExcelDate(c.تاريخ_النهاية),
    'قيمة الشهرية': formatCurrencyJOD(c.قيمة_الشهرية),
    'الحالة': c.حالة_العقد
  }));
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(contracts), 'العقود');

  // ورقة الأقساط
  const installments = getInstallments().map(i => ({
    'رقم الكمبيالة': i.رقم_الكمبيالة,
    'رقم العقد': i.رقم_العقد,
    'تاريخ الاستحقاق': getExcelDate(i.تاريخ_استحقاق),
    'المبلغ': formatCurrencyJOD(i.المبلغ),
    'الحالة': i.حالة_الكمبيالة
  }));
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(installments), 'الأقساط');

  const buf = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
  saveAs(new Blob([buf]), `تقرير_النظام_الشامل_${formatDateOnly(new Date())}.xlsx`);
}