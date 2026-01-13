/**
 * © 2025 — Developed by Mahmoud Qattoush
 * AZRAR Real Estate Management System
 * 
 * سكريبت سريع لتشغيل الاختبارات التسلسلية
 * Quick Test Runner
 */

import { IntegrationTestSuite } from './integrationTests';

/**
 * 🚀 تشغيل جميع الاختبارات
 */
export async function runTests() {
  try {
    const suite = new IntegrationTestSuite();
    const results = await suite.runAllTests();
    
    // تصدير النتائج
    const report = suite.exportResults();
    console.log('\n📋 تقرير الاختبارات المفصل:');
    console.log(report);
    
    return results;
  } catch (error) {
    console.error('❌ خطأ في تشغيل الاختبارات:', error);
    throw error;
  }
}

// للاستخدام في DevTools
if (typeof window !== 'undefined') {
  (window as any).runTests = runTests;
}
