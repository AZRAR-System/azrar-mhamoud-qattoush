/**
 * © 2025 — Developed by Mahmoud Qattoush
 * AZRAR Real Estate Management System
 * 
 * مكون واجهة الاختبارات التسلسلية
 * Integration Tests UI Component
 */

import React, { useState } from 'react';
import { Play, RotateCw, Download, ChevronDown, ChevronUp } from 'lucide-react';
import { IntegrationTestSuite, type TestResult } from '../services/integrationTests';

interface ExpandedTests {
  [key: number]: boolean;
}

export const IntegrationTestsPanel: React.FC = () => {
  const [results, setResults] = useState<TestResult[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const [expandedTests, setExpandedTests] = useState<ExpandedTests>({});
  const [error, setError] = useState<string | null>(null);

  const handleRunTests = async () => {
    setIsRunning(true);
    setError(null);
    setResults([]);

    try {
      const suite = new IntegrationTestSuite();
      const testResults = await suite.runAllTests();
      setResults(testResults);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'حدث خطأ غير معروف');
    } finally {
      setIsRunning(false);
    }
  };

  const toggleTestExpand = (index: number) => {
    setExpandedTests(prev => ({
      ...prev,
      [index]: !prev[index]
    }));
  };

  const handleDownloadReport = () => {
    const suite = new IntegrationTestSuite();
    const report = suite.exportResults();
    const element = document.createElement('a');
    element.setAttribute('href', 'data:text/plain;charset=utf-8,' + encodeURIComponent(report));
    element.setAttribute('download', `integration-tests-${new Date().toISOString()}.json`);
    element.style.display = 'none';
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
  };

  const passedCount = results.filter(r => r.status === 'PASS').length;
  const failedCount = results.filter(r => r.status === 'FAIL').length;
  const skippedCount = results.filter(r => r.status === 'SKIP').length;

  return (
    <div className="w-full h-full bg-gray-900 text-gray-100 p-6 overflow-auto" dir="rtl">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2 flex items-center gap-2">
            🧪 الاختبارات التسلسلية
          </h1>
          <p className="text-gray-400">اختبر النظام من إضافة شخص إلى عمولة بشكل متسلسل</p>
        </div>

        {/* Controls */}
        <div className="flex gap-4 mb-8">
          <button
            onClick={handleRunTests}
            disabled={isRunning}
            className={`flex items-center gap-2 px-6 py-3 rounded-lg font-semibold transition ${
              isRunning
                ? 'bg-gray-600 text-gray-400 cursor-not-allowed'
                : 'bg-indigo-600 hover:bg-indigo-700 text-white'
            }`}
          >
            <Play size={20} />
            {isRunning ? 'جاري التشغيل...' : 'تشغيل الاختبارات'}
          </button>

          {results.length > 0 && (
            <>
              <button
                onClick={() => {
                  setResults([]);
                  setExpandedTests({});
                }}
                className="flex items-center gap-2 px-6 py-3 rounded-lg font-semibold bg-gray-700 hover:bg-gray-600 text-white transition"
              >
                <RotateCw size={20} />
                إعادة تعيين
              </button>

              <button
                onClick={handleDownloadReport}
                className="flex items-center gap-2 px-6 py-3 rounded-lg font-semibold bg-green-600 hover:bg-green-700 text-white transition"
              >
                <Download size={20} />
                تنزيل التقرير
              </button>
            </>
          )}
        </div>

        {/* Error Display */}
        {error && (
          <div className="bg-red-900 border border-red-700 rounded-lg p-4 mb-8 text-red-100">
            <h3 className="font-semibold mb-2">❌ خطأ</h3>
            <p>{error}</p>
          </div>
        )}

        {/* Summary */}
        {results.length > 0 && (
          <div className="grid grid-cols-4 gap-4 mb-8">
            <div className="bg-green-900 rounded-lg p-4 border border-green-700">
              <div className="text-3xl font-bold text-green-400">{passedCount}</div>
              <div className="text-green-300 text-sm">✅ نجح</div>
            </div>
            <div className="bg-red-900 rounded-lg p-4 border border-red-700">
              <div className="text-3xl font-bold text-red-400">{failedCount}</div>
              <div className="text-red-300 text-sm">❌ فشل</div>
            </div>
            <div className="bg-yellow-900 rounded-lg p-4 border border-yellow-700">
              <div className="text-3xl font-bold text-yellow-400">{skippedCount}</div>
              <div className="text-yellow-300 text-sm">⏭️ تم تخطيه</div>
            </div>
            <div className="bg-indigo-900 rounded-lg p-4 border border-indigo-700">
              <div className="text-3xl font-bold text-indigo-400">{results.length}</div>
              <div className="text-indigo-300 text-sm">📊 الإجمالي</div>
            </div>
          </div>
        )}

        {/* Results */}
        {results.length > 0 && (
          <div className="space-y-4">
            <h2 className="text-xl font-bold mb-4">📋 نتائج الاختبارات</h2>
            {results.map((result, index) => (
              <div
                key={index}
                className={`rounded-lg border overflow-hidden ${
                  result.status === 'PASS'
                    ? 'bg-green-900 border-green-700'
                    : result.status === 'FAIL'
                    ? 'bg-red-900 border-red-700'
                    : 'bg-yellow-900 border-yellow-700'
                }`}
              >
                {/* Test Header */}
                <button
                  onClick={() => toggleTestExpand(index)}
                  className="w-full p-4 flex items-center justify-between hover:opacity-80 transition text-right"
                >
                  <div className="flex items-center gap-3 flex-1">
                    <span className="text-2xl">
                      {result.status === 'PASS'
                        ? '✅'
                        : result.status === 'FAIL'
                        ? '❌'
                        : '⏭️'}
                    </span>
                    <div className="text-right">
                      <div className="font-semibold">{result.testName}</div>
                      <div className="text-sm opacity-75">{result.message}</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {result.duration && (
                      <span className="text-sm opacity-75">
                        {result.duration.toFixed(2)}ms
                      </span>
                    )}
                    {expandedTests[index] ? (
                      <ChevronUp size={20} />
                    ) : (
                      <ChevronDown size={20} />
                    )}
                  </div>
                </button>

                {/* Test Details */}
                {expandedTests[index] && result.data && (
                  <div className="bg-black bg-opacity-30 p-4 border-t border-opacity-30 border-current">
                    <div className="space-y-2 font-mono text-sm">
                      {typeof result.data === 'object' ? (
                        Object.entries(result.data).map(([key, value]) => (
                          <div key={key} className="flex items-start gap-4">
                            <span className="text-indigo-400 flex-shrink-0 min-w-fit">
                              {key}:
                            </span>
                            <span className="text-gray-300 break-all">
                              {Array.isArray(value)
                                ? `[${value.length} عنصر]`
                                : typeof value === 'object'
                                ? JSON.stringify(value, null, 2)
                                : String(value)}
                            </span>
                          </div>
                        ))
                      ) : (
                        <div className="text-gray-300">{String(result.data)}</div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Empty State */}
        {results.length === 0 && !isRunning && (
          <div className="text-center py-12">
            <div className="text-6xl mb-4">🧪</div>
            <h3 className="text-xl font-semibold mb-2">لم يتم تشغيل أي اختبارات بعد</h3>
            <p className="text-gray-400 mb-6">
              اضغط على زر "تشغيل الاختبارات" لبدء الاختبار التسلسلي الكامل
            </p>
            <button
              onClick={handleRunTests}
              className="inline-flex items-center gap-2 px-8 py-3 bg-indigo-600 hover:bg-indigo-700 rounded-lg font-semibold text-white transition"
            >
              <Play size={20} />
              ابدأ الاختبارات الآن
            </button>
          </div>
        )}

        {/* Loading State */}
        {isRunning && (
          <div className="text-center py-12">
            <div className="inline-block">
              <div className="animate-spin text-6xl">⚙️</div>
            </div>
            <h3 className="text-xl font-semibold mt-4">جاري تشغيل الاختبارات...</h3>
            <p className="text-gray-400 mt-2">يرجى الانتظار</p>
          </div>
        )}

        {/* Test Sequence Info */}
        {results.length === 0 && (
          <div className="mt-12 bg-indigo-900 border border-indigo-700 rounded-lg p-6">
            <h3 className="font-semibold mb-4">📚 تسلسل الاختبارات</h3>
            <div className="space-y-3 text-sm">
              <div className="flex gap-3">
                <span className="text-indigo-400 font-semibold">1️⃣</span>
                <div>
                  <div className="font-semibold">إضافة شخص (مالك)</div>
                  <div className="text-gray-400">إضافة شخص جديد مع بيانات صحيحة</div>
                </div>
              </div>
              <div className="flex gap-3">
                <span className="text-indigo-400 font-semibold">2️⃣</span>
                <div>
                  <div className="font-semibold">إضافة عقار</div>
                  <div className="text-gray-400">إضافة عقار للمالك الذي تم إضافته</div>
                </div>
              </div>
              <div className="flex gap-3">
                <span className="text-indigo-400 font-semibold">3️⃣</span>
                <div>
                  <div className="font-semibold">إنشاء عقد إيجار</div>
                  <div className="text-gray-400">ربط العقار بمستأجر جديد وإنشاء عقد</div>
                </div>
              </div>
              <div className="flex gap-3">
                <span className="text-indigo-400 font-semibold">4️⃣</span>
                <div>
                  <div className="font-semibold">التحقق من الكمبيالات</div>
                  <div className="text-gray-400">التحقق من إنشاء الكمبيالات تلقائياً</div>
                </div>
              </div>
              <div className="flex gap-3">
                <span className="text-indigo-400 font-semibold">5️⃣</span>
                <div>
                  <div className="font-semibold">التحقق من العمولات</div>
                  <div className="text-gray-400">التحقق من إنشاء العمولات للمالك والمستأجر</div>
                </div>
              </div>
              <div className="flex gap-3">
                <span className="text-indigo-400 font-semibold">6️⃣</span>
                <div>
                  <div className="font-semibold">سداد كمبيالة</div>
                  <div className="text-gray-400">تحديث حالة الكمبيالة إلى مدفوع</div>
                </div>
              </div>
              <div className="flex gap-3">
                <span className="text-indigo-400 font-semibold">7️⃣</span>
                <div>
                  <div className="font-semibold">التحقق من سلامة البيانات</div>
                  <div className="text-gray-400">التحقق من عدم وجود أخطاء في المراجع</div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
