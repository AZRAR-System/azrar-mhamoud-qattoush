/**
 * © 2025 — Developed by Mahmoud Qattoush
 * AZRAR Real Estate Management System
 *
 * سكريبت تشغيل الاختبارات التسلسلية
 * ملاحظة: هذه الاختبارات تعتمد على طبقة DbService وبيئة التطبيق (Browser/Electron Renderer).
 * لذلك تشغيلها عبر Node مباشرة لن يُشغّل الاختبارات الفعلية.
 */

function getConsole() {
  const c = globalThis && globalThis.console;
  if (!c) return null;
  if (typeof c.log !== 'function') return null;
  return c;
}

function log(...args) {
  const c = getConsole();
  if (c) c.log(...args);
}

function warn(...args) {
  const c = getConsole();
  if (c && typeof c.warn === 'function') c.warn(...args);
  else log(...args);
}

function logError(...args) {
  const c = getConsole();
  if (c && typeof c.error === 'function') c.error(...args);
  else log(...args);
}

function printHeader() {
  log('╔════════════════════════════════════════════════════════════╗');
  log('║                                                            ║');
  log('║    🚀 بدء الاختبارات التسلسلية - إضافة البيانات           ║');
  log('║                                                            ║');
  log('╚════════════════════════════════════════════════════════════╝\n');
}

function printHowToRun() {
  log('ℹ️ هذا السكربت يُستخدم من داخل التطبيق (Electron/Vite) وليس من Node مباشرة.');
  log('\n✅ لتشغيل الاختبارات بشكل صحيح:');
  log('1) شغّل التطبيق (وضع الديسكتوب):');
  log('   npm run desktop:dev');
  log('2) افتح صفحة "Integration Tests" داخل النظام (أو افتح DevTools).');
  log('3) من Console نفّذ أحد الخيارين:');
  log('   await window.runIntegrationTests()');
  log('   أو');
  log('   await window.runTests()');
  log('\nملاحظة: قد تحتاج لتفعيل بيانات الاختبار عبر:');
  log('VITE_ENABLE_INTEGRATION_TEST_DATA=true (أو window.ENABLE_INTEGRATION_TEST_DATA=true)');
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
    warn('⏳ لم يتم تحميل وحدة الاختبارات بعد.');
    warn('افتح صفحة "Integration Tests" ثم أعد المحاولة.\n');
    printHowToRun();
    return;
  }

  log('⏳ جاري التحضير...\n');
  log('📊 بدء الاختبارات...\n');

  const results = await runner();
  const passed = Array.isArray(results) ? results.filter((r) => r?.status === 'PASS').length : 0;
  const total = Array.isArray(results) ? results.length : 0;

  log('\n✅ انتهت الاختبارات.');
  if (total > 0) {
    log(`✅ الاختبارات الناجحة: ${passed}/${total}`);
  }
}

// تأخير بسيط لتقليل تعارض التحميل في المتصفح
setTimeout(() => {
  main().catch((err) => {
    logError('❌ خطأ في تشغيل الاختبارات:', err);
  });
}, 250);
