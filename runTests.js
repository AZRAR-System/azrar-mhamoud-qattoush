/**
 * © 2025 — Developed by Mahmoud Qattoush
 * AZRAR Real Estate Management System
 *
 * سكريبت تشغيل الاختبارات التسلسلية
 * ملاحظة: هذه الاختبارات تعتمد على طبقة DbService وبيئة التطبيق (Browser/Electron Renderer).
 * لذلك تشغيلها عبر Node مباشرة لن يُشغّل الاختبارات الفعلية.
 */

function printHeader() {
  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║                                                            ║');
  console.log('║    🚀 بدء الاختبارات التسلسلية - إضافة البيانات           ║');
  console.log('║                                                            ║');
  console.log('╚════════════════════════════════════════════════════════════╝\n');
}

function printHowToRun() {
  console.log('ℹ️ هذا السكربت يُستخدم من داخل التطبيق (Electron/Vite) وليس من Node مباشرة.');
  console.log('\n✅ لتشغيل الاختبارات بشكل صحيح:');
  console.log('1) شغّل التطبيق (وضع الديسكتوب):');
  console.log('   npm run desktop:dev');
  console.log('2) افتح صفحة "Integration Tests" داخل النظام (أو افتح DevTools).');
  console.log('3) من Console نفّذ أحد الخيارين:');
  console.log('   await window.runIntegrationTests()');
  console.log('   أو');
  console.log('   await window.runTests()');
  console.log('\nملاحظة: قد تحتاج لتفعيل بيانات الاختبار عبر:');
  console.log('VITE_ENABLE_INTEGRATION_TEST_DATA=true (أو window.ENABLE_INTEGRATION_TEST_DATA=true)');
}

async function main() {
  printHeader();

  // Node environment
  if (typeof window === 'undefined') {
    printHowToRun();
    return;
  }

  // Browser/Electron renderer environment
  const runner = window.runIntegrationTests ?? window.runTests;
  if (typeof runner !== 'function') {
    console.log('⏳ لم يتم تحميل وحدة الاختبارات بعد.');
    console.log('افتح صفحة "Integration Tests" ثم أعد المحاولة.\n');
    printHowToRun();
    return;
  }

  console.log('⏳ جاري التحضير...\n');
  console.log('📊 بدء الاختبارات...\n');

  const results = await runner();
  const passed = Array.isArray(results) ? results.filter((r) => r?.status === 'PASS').length : 0;
  const total = Array.isArray(results) ? results.length : 0;

  console.log('\n✅ انتهت الاختبارات.');
  if (total > 0) {
    console.log(`✅ الاختبارات الناجحة: ${passed}/${total}`);
  }
}

// تأخير بسيط لتقليل تعارض التحميل في المتصفح
setTimeout(() => {
  main().catch((error) => {
    console.error('❌ خطأ في تشغيل الاختبارات:', error);
  });
}, 250);
