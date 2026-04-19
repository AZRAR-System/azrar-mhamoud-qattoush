import { memo, type FC, useState, useEffect } from 'react';
import { DS } from '@/constants/designSystem';
import { Button } from '@/components/ui/Button';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { PaginationControls } from '@/components/shared/PaginationControls';
import {
  Activity,
  CheckCircle,
  AlertTriangle,
  ShieldCheck,
  RotateCcw,
  Database,
  AlertOctagon,
  FileSearch,
  Calculator,
  Stethoscope,
  TrendingUp,
  Gauge,
  Wrench,
  FileQuestion,
  Zap,
  XCircle,
  BrainCircuit,
  Play,
  Terminal,
  Trash2,
  Upload,
  HardDrive,
  Key,
  RefreshCw,
} from 'lucide-react';
import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Legend,
} from 'recharts';
import type { useSystemMaintenance, TabKey } from '@/hooks/useSystemMaintenance';
import { SystemHealth, PredictiveInsight, PerformanceRow } from '@/types';

interface SystemMaintenancePageViewProps {
  page: ReturnType<typeof useSystemMaintenance>;
}

/* ========================= */
/*   Helper UI Components    */
/* ========================= */

const LoadingScreen = memo(() => (
  <div className="flex flex-col h-[60vh] items-center justify-center space-y-6 animate-fade-in">
    <div className="relative">
      <div className="w-20 h-20 border-4 border-slate-200 dark:border-slate-700 rounded-full" />
      <div className="w-20 h-20 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin absolute top-0 left-0" />
      <Activity
        className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 text-indigo-600"
        size={24}
      />
    </div>
    <p className="text-slate-500 dark:text-slate-400 font-bold animate-pulse">
      جاري فحص سلامة النظام وتشخيص الأداء...
    </p>
  </div>
));

interface HeaderProps {
  onRecheck: () => void;
  loading: boolean;
  activeTab: string;
}

const MaintenanceHeader = memo<HeaderProps>(({ onRecheck, loading, activeTab }) => (
  <div className={DS.components.pageHeader}>
    <div>
      <h2 className={`${DS.components.pageTitle} flex items-center gap-2`}>
        <BrainCircuit size={22} />
        صيانة النظام الذكية
      </h2>
      <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
        أدوات التشخيص المتقدمة، إصلاح الأخطاء، وتحليل الأداء الفني
      </p>
    </div>
    <Button
      variant="secondary"
      onClick={onRecheck}
      isLoading={loading}
      title={activeTab !== 'diagnostics' ? 'سيتم الرجوع لتبويب التشخيص بعد إعادة الفحص' : undefined}
      rightIcon={<RotateCcw size={16} />}
    >
      إعادة الفحص
    </Button>
  </div>
));

interface TabsProps {
  activeTab: string;
  setActiveTab: (tab: TabKey) => void;
  onRunPerfTest: () => void;
}

const MaintenanceTabs = memo<TabsProps>(({ activeTab, setActiveTab, onRunPerfTest }) => (
  <div className="flex flex-wrap gap-2">
    <Button
      variant={activeTab === 'diagnostics' ? 'primary' : 'secondary'}
      onClick={() => setActiveTab('diagnostics')}
      rightIcon={<Stethoscope size={18} />}
    >
      التشخيص الصحي
    </Button>
    <Button
      variant={activeTab === 'predictive' ? 'primary' : 'secondary'}
      onClick={() => setActiveTab('predictive')}
      rightIcon={<TrendingUp size={18} />}
    >
      التحليلات التنبؤية
    </Button>
    <Button
      variant={activeTab === 'performance' ? 'primary' : 'secondary'}
      onClick={onRunPerfTest}
      rightIcon={<Gauge size={18} />}
    >
      اختبار الأداء
    </Button>
    <Button
      variant={activeTab === 'testing' ? 'primary' : 'secondary'}
      onClick={() => setActiveTab('testing')}
      rightIcon={<Terminal size={18} />}
    >
      اختبار النظام
    </Button>
    <Button
      variant={activeTab === 'database' ? 'primary' : 'secondary'}
      onClick={() => setActiveTab('database')}
      rightIcon={<Database size={18} />}
    >
      قاعدة البيانات
    </Button>
  </div>
));

/* ========================= */
/*     Diagnostics View      */
/* ========================= */

interface DiagnosticsViewProps {
  health: SystemHealth;
  optimizing: boolean;
  onAutoFix: () => void;
}

const DiagnosticsView = memo<DiagnosticsViewProps>(({ health, optimizing, onAutoFix }) => {
  const scoreColor =
    health.score > 80
      ? 'text-emerald-500 border-emerald-500'
      : health.score > 60
        ? 'text-amber-500 border-amber-500'
        : 'text-red-500 border-red-500';

  const statusConfig = (() => {
    switch (health.status) {
      case 'Excellent':
        return {
          icon: CheckCircle,
          className: 'bg-emerald-100 text-emerald-700 border-emerald-200',
          label: 'ممتازة',
        };
      case 'Good':
        return {
          icon: ShieldCheck,
          className: 'bg-indigo-100 text-indigo-700 border-indigo-200',
          label: 'جيدة',
        };
      case 'Warning':
        return {
          icon: AlertTriangle,
          className: 'bg-amber-100 text-amber-700 border-amber-200',
          label: 'متوسطة',
        };
      case 'Critical':
      default:
        return {
          icon: XCircle,
          className: 'bg-red-100 text-red-700 border-red-200',
          label: 'حرجة',
        };
    }
  })();

  const StatusIcon = statusConfig.icon;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 animate-slide-up">
      <div className="lg:col-span-4 app-card p-8 rounded-3xl flex flex-col items-center justify-center text-center relative overflow-hidden min-h-[350px]">
        <div className="absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500" />
        <div className={`relative w-48 h-48 rounded-full border-[12px] flex items-center justify-center mb-8 ${scoreColor} bg-gray-50 dark:bg-slate-900 transition-all duration-500`}>
          <div className="flex flex-col items-center">
            <span className="text-5xl font-black text-slate-800 dark:text-white tracking-tighter">
              {health.score}%
            </span>
            <span className="text-xs text-slate-400 font-bold uppercase tracking-wider mt-1">
              درجة الصحة
            </span>
          </div>
        </div>
        <div className={`px-6 py-2.5 rounded-xl text-sm font-bold flex items-center gap-2 border ${statusConfig.className}`}>
          <StatusIcon size={18} />
          الحالة: {statusConfig.label}
        </div>
      </div>

      <div className="lg:col-span-8 flex flex-col gap-6">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {[
            { label: 'سلامة البيانات', val: health.stats.integrityWarnings, icon: Database, color: 'text-indigo-600', bg: 'bg-indigo-50 dark:bg-indigo-900/20' },
            { label: 'سجلات يتيمة', val: health.stats.orphans, icon: FileQuestion, color: 'text-amber-600', bg: 'bg-amber-50 dark:bg-amber-900/20' },
            { label: 'أخطاء منطقية', val: health.stats.logicErrors, icon: AlertOctagon, color: 'text-red-600', bg: 'bg-red-50 dark:bg-red-900/20' },
          ].map((item, idx) => (
            <div key={idx} className="app-card p-5 flex flex-col items-start hover:shadow-md transition">
              <div className={`p-3 rounded-xl ${item.bg} ${item.color} mb-3`}>
                <item.icon size={24} />
              </div>
              <span className="text-3xl font-bold text-slate-800 dark:text-white mb-1">{item.val}</span>
              <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">{item.label}</span>
            </div>
          ))}
        </div>

        <div className="flex-1 app-card rounded-3xl flex flex-col min-h-[300px]">
          <div className="p-5 border-b border-gray-100 dark:border-slate-700 bg-gray-50 dark:bg-slate-900/30 flex items-center justify-between">
            <h3 className="font-bold text-slate-800 dark:text-white flex items-center gap-2">
              <FileSearch size={20} className="text-indigo-500" />
              المشاكل المكتشفة ({health.issues.length})
            </h3>
            {health.issues.length > 0 && (
              <button
                onClick={onAutoFix}
                disabled={optimizing}
                className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-xl text-xs font-bold hover:bg-indigo-700 disabled:opacity-50 transition shadow-lg shadow-indigo-600/20"
              >
                {optimizing ? <><RotateCcw size={14} className="animate-spin" /> جاري المعالجة...</> : <><Wrench size={14} /> إصلاح ذكي</>}
              </button>
            )}
          </div>
          <div className="flex-1 overflow-y-auto max-h-[400px] custom-scrollbar p-4 space-y-3">
            {health.issues.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center p-8 text-center">
                <div className="w-16 h-16 bg-green-50 dark:bg-green-900/20 rounded-full flex items-center justify-center mb-4">
                  <CheckCircle size={32} className="text-green-500" />
                </div>
                <h4 className="text-slate-800 dark:text-white font-bold">النظام سليم تماماً</h4>
                <p className="text-sm text-slate-500 mt-1">لا توجد أخطاء في تكامل البيانات أو العلاقات.</p>
              </div>
            ) : (
              health.issues.map((issue) => (
                <div key={issue.id} className="p-4 bg-gray-50 dark:bg-slate-700/20 rounded-xl border border-gray-100 dark:border-slate-700 flex gap-4">
                  <div className={`mt-1 p-2 rounded-lg h-fit ${issue.type === 'Critical' ? 'bg-red-100 text-red-600' : 'bg-amber-100 text-amber-600'}`}>
                    {issue.type === 'Critical' ? <AlertOctagon size={18} /> : <AlertTriangle size={18} />}
                  </div>
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-bold text-slate-800 dark:text-white text-sm">{issue.category} Issue</span>
                      <StatusBadge status={issue.type} showIcon={false} className="!text-[10px] !px-2 !py-0.5 uppercase" />
                    </div>
                    <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">{issue.description}</p>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
});

/* ========================= */
/*     Predictive View       */
/* ========================= */

interface PredictiveViewProps {
  predictiveInsight: PredictiveInsight;
}

const PredictiveView = memo<PredictiveViewProps>(({ predictiveInsight }) => {
  const hasRiskFactors = predictiveInsight.riskFactors.length > 0;
  const riskColors = ['#3b82f6', '#ef4444', '#f59e0b', '#10b981'];

  return (
    <div className="space-y-8 animate-slide-up">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <div className="bg-gradient-to-br from-indigo-600 to-violet-800 rounded-3xl p-8 text-white shadow-xl shadow-indigo-500/20 relative overflow-hidden flex flex-col justify-between min-h-[300px]">
          <div className="relative z-10">
            <h3 className="text-indigo-100 font-bold flex items-center gap-2 mb-4"><Activity size={20} /> مؤشر الاستقرار المستقبلي</h3>
            <div className="flex items-baseline gap-2 mb-6">
              <span className="text-7xl font-black tracking-tight">{predictiveInsight.score}</span>
              <span className="text-2xl opacity-60 font-medium">/ 100</span>
            </div>
            <div className="flex flex-wrap gap-2 mb-4">
              <span className="px-3 py-1 rounded-lg text-sm font-bold bg-white/20 border border-white/10 backdrop-blur-md">{predictiveInsight.status === 'Safe' ? '✅ الوضع آمن' : '⚠️ يتطلب مراقبة'}</span>
              <span className="px-3 py-1 rounded-lg text-sm font-bold bg-white/20 border border-white/10 backdrop-blur-md">{predictiveInsight.trend === 'Improving' ? '📈 الاتجاه صاعد' : '➡️ الاتجاه مستقر'}</span>
            </div>
            <p className="text-sm text-indigo-100 opacity-90 leading-relaxed whitespace-normal break-words">
              {predictiveInsight.status === 'Safe' ? 'خوارزميات الذكاء الاصطناعي تتوقع استقراراً مالياً وتشغيلياً عالياً خلال الـ 30 يوماً القادمة.' : 'تم رصد مؤشرات قد تؤدي لتعثر مالي أو إداري، يرجى مراجعة التوصيات بعناية.'}
            </p>
          </div>
          <BrainCircuit className="absolute bottom-[-20px] left-[-20px] text-white opacity-10 w-64 h-64 rotate-12 pointer-events-none" />
          <div className="absolute top-0 right-0 w-64 h-64 bg-purple-500 opacity-20 blur-3xl rounded-full mix-blend-overlay pointer-events-none" />
        </div>

        <div className="app-card p-8 rounded-3xl flex flex-col min-h-[300px]">
          <h3 className="font-bold text-slate-800 dark:text-white mb-6 flex items-center gap-2 text-lg"><Zap size={24} className="text-amber-500 fill-amber-500" /> توصيات الذكاء الاصطناعي</h3>
          <div className="flex-1 overflow-y-auto custom-scrollbar pr-2 space-y-3 max-h-[300px]">
            {predictiveInsight.recommendations.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-gray-400 py-4"><CheckCircle size={40} className="mb-2 opacity-30" /><p>لا توجد توصيات، الأداء مثالي.</p></div>
            ) : (
              predictiveInsight.recommendations.map((rec, i) => (
                <div key={i} className="flex gap-3 p-3 bg-amber-50 dark:bg-amber-900/10 rounded-xl border border-amber-100 dark:border-amber-800/30">
                  <span className="w-6 h-6 rounded-full bg-amber-200 dark:bg-amber-800 text-amber-900 dark:text-amber-100 flex items-center justify-center text-xs font-bold flex-shrink-0 mt-0.5">{i + 1}</span>
                  <p className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed whitespace-normal">{rec}</p>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      <div className="app-card p-8 rounded-3xl">
        <h3 className="font-bold text-slate-800 dark:text-white mb-6 flex items-center gap-2 text-lg"><AlertOctagon size={24} className="text-red-500" /> توزيع المخاطر المحتملة</h3>
        <div className="flex flex-col md:flex-row items-center gap-12">
          <div className="w-full md:w-[350px] h-[300px] relative flex-shrink-0">
            {hasRiskFactors ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={predictiveInsight.riskFactors} cx="50%" cy="50%" innerRadius={80} outerRadius={120} paddingAngle={5} dataKey="count" stroke="none">
                    {predictiveInsight.riskFactors.map((_entry, index) => <Cell key={`cell-${index}`} fill={riskColors[index % riskColors.length]} />)}
                  </Pie>
                  <Tooltip contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)' }} />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex flex-col items-center justify-center text-gray-400 border-4 border-dashed border-gray-100 dark:border-slate-700 rounded-full w-64 h-64 mx-auto"><ShieldCheck size={48} className="mb-2 text-emerald-500 opacity-50" /><p className="text-sm font-bold">لا يوجد مخاطر</p></div>
            )}
            {hasRiskFactors && (
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                <span className="text-4xl font-bold text-slate-800 dark:text-white">{predictiveInsight.riskFactors.reduce((a, b) => a + b.count, 0)}</span>
                <span className="text-[10px] text-gray-400 uppercase tracking-widest font-bold">Risk Items</span>
              </div>
            )}
          </div>
          <div className="flex-1 w-full grid grid-cols-1 sm:grid-cols-2 gap-4">
            {predictiveInsight.riskFactors.map((factor, idx) => (
              <div key={idx} className="flex items-center justify-between p-5 bg-gray-50 dark:bg-slate-900/50 rounded-xl border border-gray-100 dark:border-slate-800">
                <div className="flex items-center gap-3">
                  <svg className="w-4 h-4" viewBox="0 0 16 16"><circle cx="8" cy="8" r="8" fill={riskColors[idx % riskColors.length]} /></svg>
                  <span className="font-bold text-slate-700 dark:text-slate-200 text-sm">{factor.category}</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-sm font-bold text-slate-500 dark:text-slate-400">{factor.count} سجل</span>
                  <span className="text-xs font-mono font-bold bg-white dark:bg-slate-800 px-2 py-1 rounded border border-gray-200 dark:border-slate-700">{factor.percentage}%</span>
                </div>
              </div>
            ))}
            {!hasRiskFactors && (
              <div className="col-span-2 p-6 bg-emerald-50 dark:bg-emerald-900/10 border border-emerald-100 dark:border-emerald-900/30 rounded-xl text-center"><p className="text-emerald-700 dark:text-emerald-400 font-bold">النظام يعمل في المنطقة الآمنة تماماً.</p><p className="text-xs text-emerald-600/70 mt-1">لا توجد أي تهديدات مالية أو تشغيلية مرصودة.</p></div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
});

/* ========================= */
/*    Performance View       */
/* ========================= */

interface PerformanceViewProps {
  performanceReport: PerformanceRow[];
}

const PerformanceView = memo<PerformanceViewProps>(({ performanceReport }) => {
  const [page, setPage] = useState(1);
  const pageSize = 12;
  const pageCount = Math.max(1, Math.ceil(performanceReport.length / pageSize));
  useEffect(() => { setPage((p) => Math.min(Math.max(1, p), pageCount)); }, [pageCount]);
  const visible = performanceReport.slice((page - 1) * pageSize, page * pageSize);

  return (
    <div className="app-card p-8 rounded-3xl animate-slide-up">
      <div className="flex flex-col md:flex-row md:items-start gap-6 mb-8">
        <div className="p-4 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 rounded-2xl flex-shrink-0"><Gauge size={32} /></div>
        <div><h3 className="text-xl font-bold text-slate-800 dark:text-white">تقرير أداء الفهرسة (Caching Performance) - تحديث</h3><p className="text-sm text-slate-500 dark:text-slate-400 mt-2 leading-relaxed max-w-3xl">مقارنة زمن القراءة بين تشغيلين متتاليين (لتقدير أثر الكاش/التجهيز)</p></div>
      </div>
      <div className="h-[450px] w-full mb-10 bg-slate-50 dark:bg-slate-900/20 rounded-2xl p-4 border border-slate-100 dark:border-slate-800">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={performanceReport} barGap={12} barSize={24} margin={{ top: 20, right: 30, left: 20, bottom: 60 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" strokeOpacity={0.5} />
            <XAxis dataKey="name" tick={{ fill: '#64748b', fontSize: 11, fontWeight: 600 }} tickLine={false} axisLine={false} dy={15} interval={0} angle={-10} textAnchor="end" />
            <YAxis label={{ value: 'الزمن (ms)', angle: -90, position: 'insideLeft', fill: '#94a3b8', fontSize: 12, dx: -10 }} tick={{ fill: '#94a3b8', fontSize: 11 }} tickLine={false} axisLine={false} width={60} />
            <Tooltip cursor={{ fill: 'rgba(0,0,0,0.04)' }} contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)', padding: '12px', backgroundColor: 'rgba(255, 255, 255, 0.95)' }} />
            <Legend verticalAlign="top" height={36} iconType="circle" formatter={(value) => <span className="text-slate-600 dark:text-slate-300 font-bold text-sm mr-4">{value}</span>} />
            <Bar dataKey="before" fill="#f87171" name="قبل الفهرسة (Original)" radius={[4, 4, 0, 0]} />
            <Bar dataKey="after" fill="#10b981" name="بعد الفهرسة (Optimized)" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
      <div className="app-table-wrapper mt-8">
        <div className="p-4 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 flex items-center justify-between gap-4">
          <div className="text-[10px] font-black text-slate-500 uppercase tracking-widest px-2">تفاصيل الأداء المقارن</div>
          <PaginationControls page={page} pageCount={pageCount} onPageChange={setPage} />
        </div>
        <div className="overflow-x-auto no-scrollbar">
          <table className="app-table">
            <thead className="app-table-thead"><tr><th className="app-table-th">نوع العملية</th><th className="app-table-th">التشغيل الأول (ms)</th><th className="app-table-th">التشغيل الثاني (ms)</th><th className="app-table-th">فرق الزمن / التحسن</th></tr></thead>
            <tbody className="divide-y divide-slate-100/50 dark:divide-slate-800/50">
              {visible.map((res) => {
                const improvement = res.before > 0 ? ((res.before - res.after) / res.before) * 100 : 0;
                return (
                  <tr key={res.name} className="app-table-row app-table-row-striped group">
                    <td className="app-table-td font-black text-slate-700 dark:text-slate-200 flex items-center gap-3"><div className="p-2 bg-slate-100 dark:bg-slate-800 rounded-lg text-slate-400 group-hover:text-indigo-500 transition-colors"><Calculator size={14} /></div>{res.name}</td>
                    <td className="app-table-td"><span className="text-rose-500 font-mono text-sm font-bold bg-rose-50 dark:bg-rose-900/10 px-2.5 py-1 rounded-lg border border-rose-100 dark:border-rose-900/30">{res.before.toFixed(2)}</span></td>
                    <td className="app-table-td"><span className="text-emerald-600 font-mono text-sm font-black bg-emerald-50 dark:bg-emerald-900/10 px-2.5 py-1 rounded-lg border border-emerald-100 dark:border-emerald-900/30">{res.after.toFixed(4)}</span></td>
                    <td className="app-table-td"><div className="flex items-center gap-4 min-w-[120px]"><div className="flex-1 h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden shadow-inner"><div className="h-full bg-gradient-to-r from-emerald-400 to-emerald-600 transition-all duration-1000 ease-out" style={{ width: `${Math.min(improvement, 100)}%` }} /></div><span className="text-[11px] font-black text-emerald-600 dark:text-emerald-400 w-12 text-left">{improvement.toFixed(1)}%</span></div></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
});

/* ========================= */
/*     Testing View (NEW)    */
/* ========================= */

interface SystemTestViewProps {
  testing: ReturnType<typeof useSystemMaintenance>['testing'];
  userRole: string;
}

const SystemTestView = memo<SystemTestViewProps>(({ testing, userRole }) => {
  const { running, allowMutation, setAllowMutation, results, resultsPage, setResultsPage, runTests, handleResetAllData } = testing;
  const resultsPageSize = 12;
  const summary = results ? { pass: results.filter((r) => r.status === 'PASS').length, fail: results.filter((r) => r.status === 'FAIL').length, skip: results.filter((r) => r.status === 'SKIP').length } : null;
  const resultsPageCount = Math.max(1, Math.ceil((results?.length ?? 0) / resultsPageSize));
  const visibleResults = (results || []).slice((resultsPage - 1) * resultsPageSize, resultsPage * resultsPageSize);

  return (
    <div className="app-card p-8 rounded-3xl animate-slide-up space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-start gap-3"><div className="p-3 bg-orange-100 dark:bg-orange-900/30 text-orange-600 rounded-xl"><Terminal size={24} /></div><div><h3 className="text-xl font-bold text-slate-800 dark:text-white">اختبار سيناريوهات النظام</h3><p className="text-sm text-slate-500 dark:text-slate-400 mt-2">الوضع الافتراضي آمن (قراءة فقط) ولا يضيف بيانات. يمكنك تفعيل إنشاء بيانات اختبار إذا رغبت.</p></div></div>
        <button onClick={runTests} disabled={running} className="flex items-center gap-2 bg-orange-600 text-white px-4 py-2 rounded-xl text-sm font-bold hover:bg-orange-700 disabled:opacity-50 transition">{running ? <><RotateCcw size={16} className="animate-spin" /> جاري التشغيل...</> : <><Play size={16} /> تشغيل الاختبارات</>}</button>
      </div>
      <div className="app-card bg-slate-50 dark:bg-slate-900/30 border-slate-100 dark:border-slate-700 flex flex-col md:flex-row gap-4 md:items-center justify-between rounded-2xl p-4">
        <label className="flex items-center gap-3 text-sm font-bold text-slate-700 dark:text-slate-200"><input type="checkbox" checked={allowMutation} onChange={(e) => setAllowMutation(e.target.checked)} />السماح بإنشاء بيانات اختبار (يغيّر بيانات النظام)</label>
        <p className="text-xs text-slate-500 dark:text-slate-400">لتفعيل الاختبارات المُولِّدة للبيانات قد تحتاج أيضاً لمقابلة المتغيرات اللازمة في النظام.</p>
      </div>
      {summary && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="p-4 rounded-2xl border border-emerald-200 bg-emerald-50 dark:bg-emerald-900/10 dark:border-emerald-900/30"><div className="text-2xl font-black text-emerald-700 dark:text-emerald-400">{summary.pass}</div><div className="text-xs font-bold text-emerald-800/70 dark:text-emerald-300/70">نجح</div></div>
          <div className="p-4 rounded-2xl border border-red-200 bg-red-50 dark:bg-red-900/10 dark:border-red-900/30"><div className="text-2xl font-black text-red-700 dark:text-red-400">{summary.fail}</div><div className="text-xs font-bold text-red-800/70 dark:text-red-300/70">فشل</div></div>
          <div className="app-card p-4 rounded-2xl dark:bg-slate-900/10"><div className="text-2xl font-black text-slate-700 dark:text-slate-200">{summary.skip}</div><div className="text-xs font-bold text-slate-500 dark:text-slate-400">تم تخطيه</div></div>
        </div>
      )}
      {!results ? <div className="text-sm text-slate-500 dark:text-slate-400">اضغط "تشغيل الاختبارات" لبدء فحص السيناريوهات.</div> : (
        <div className="space-y-3">
          <PaginationControls page={resultsPage} pageCount={resultsPageCount} onPageChange={setResultsPage} />
          {visibleResults.map((r) => (
            <div key={r.id} className="app-card p-4 rounded-2xl bg-white dark:bg-slate-900/20">
              <div className="flex items-center justify-between gap-3"><div className="font-bold text-slate-800 dark:text-white text-sm">{r.name}</div><StatusBadge status={r.status === 'PASS' ? 'نجح' : r.status === 'FAIL' ? 'فشل' : 'تم تخطيه'} className="text-[10px] px-2 py-1 rounded font-black" /></div>
              <div className="text-sm text-slate-600 dark:text-slate-300 mt-2">{r.message}</div>
              {typeof r.durationMs === 'number' && <div className="text-xs text-slate-400 mt-1">المدة: {(r.durationMs as number).toFixed(2)}ms</div>}
              {r.details && <details className="mt-3"><summary className="text-xs font-bold text-slate-600 dark:text-slate-300 cursor-pointer">تفاصيل</summary><pre className="mt-2 text-xs bg-slate-50 dark:bg-slate-900/40 p-3 rounded-xl overflow-auto border border-slate-100 dark:border-slate-700">{JSON.stringify(r.details, null, 2)}</pre></details>}
            </div>
          ))}
          {userRole === 'SuperAdmin' && (
            <div className="bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900/30 rounded-2xl p-5">
              <div className="flex items-start justify-between gap-4">
                <div><div className="text-sm font-black text-red-800 dark:text-red-300">منطقة الخطر (SuperAdmin)</div><div className="text-xs text-red-700/80 dark:text-red-300/80 mt-1">مسح جميع البيانات التشغيلية وإبقاء تكوينات النظام الأساسية فقط.</div></div>
                <button onClick={handleResetAllData} className="bg-red-600 hover:bg-red-700 text-white font-bold px-4 py-2 rounded-xl text-sm flex items-center gap-2"><Trash2 size={16} /> مسح كل البيانات</button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
});

/* ========================= */
/*    Database View (CSLD)   */
/* ========================= */

interface DatabaseViewProps {
  database: ReturnType<typeof useSystemMaintenance>['database'];
  isDesktop: boolean;
}

const DatabaseView = memo<DatabaseViewProps>(({ database, isDesktop }) => {
  const { dbPath, appVersion, installingFromFile, rebuilding, tables, tablesPage, setTablesPage, dbStats, resetLoading, handleRebuildIndexes, handleClearKey, doInstallFromFile, handleResetToFresh, handleClearAll } = database;
  const tablesPageSize = 10;
  const visibleTables = tables.slice((tablesPage - 1) * tablesPageSize, tablesPage * tablesPageSize);
  const tablesPageCount = Math.ceil(tables.length / tablesPageSize);

  const getCount = (key: string) => {
    const raw = localStorage.getItem(key);
    if (!raw) return '0';
    try { const parsed = JSON.parse(raw); return Array.isArray(parsed) ? String(parsed.length) : '1'; }
    catch { return '1'; }
  };
  const getSize = (key: string) => {
    const data = localStorage.getItem(key);
    return data ? (data.length / 1024).toFixed(1) + ' KB' : '0 KB';
  };

  return (
    <div className="space-y-8 animate-fade-in pb-10">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <div className="app-card p-6 rounded-3xl space-y-6">
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-start gap-3"><div className="p-3 bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 rounded-xl"><Database size={24} /></div><div><h3 className="text-xl font-bold text-slate-800 dark:text-white">إدارة كاش النظام والجداول</h3><p className="text-sm text-slate-500 dark:text-slate-400 mt-1">عرض حالة البيانات المحلية (LocalStorage) وإدارة الفهارس.</p></div></div>
              <button onClick={handleRebuildIndexes} disabled={rebuilding} className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-xl text-sm font-bold hover:bg-indigo-700 disabled:opacity-50 transition"><RefreshCw size={16} className={rebuilding ? 'animate-spin' : ''} />{rebuilding ? 'جاري البناء...' : 'إعادة بناء الفهارس'}</button>
            </div>
            <div className="app-table-wrapper rounded-2xl border border-slate-100 dark:border-slate-800">
              <table className="app-table">
                <thead className="app-table-thead"><tr><th className="app-table-th">الجدول</th><th className="app-table-th text-center">السجلات</th><th className="app-table-th text-center">الحجم</th><th className="app-table-th text-center">إجراء</th></tr></thead>
                <tbody className="divide-y divide-slate-100/50 dark:divide-slate-800/50">
                  {visibleTables.map((t) => (
                    <tr key={t.key} className="app-table-row group">
                      <td className="app-table-td"><div className="flex items-center gap-2"><t.icon size={14} className="text-slate-400" /><div className="flex flex-col"><span className="text-sm font-bold text-slate-700 dark:text-slate-200">{t.name}</span><span className="text-[10px] text-slate-400 font-mono">{t.key}</span></div></div></td>
                      <td className="app-table-td text-center font-mono text-xs">{getCount(t.key)}</td>
                      <td className="app-table-td text-center font-mono text-xs text-slate-400">{getSize(t.key)}</td>
                      <td className="app-table-td"><div className="flex justify-center opacity-0 group-hover:opacity-100 transition-opacity"><button onClick={() => handleClearKey(t.key)} className="p-1.5 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition" title="مسح"><Trash2 size={14} /></button></div></td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="p-3 border-t border-slate-100 dark:border-slate-800"><PaginationControls page={tablesPage} pageCount={tablesPageCount} onPageChange={setTablesPage} /></div>
            </div>
          </div>
        </div>
        <div className="space-y-6">
          {isDesktop && (
            <div className="app-card p-6 rounded-3xl space-y-4">
              <h4 className="font-bold text-slate-800 dark:text-white flex items-center gap-2"><HardDrive size={18} className="text-indigo-600" />معلومات المسار والنسخة</h4>
              <div className="space-y-3">
                <div><p className="text-[10px] font-bold text-slate-400 uppercase">موقع قاعدة البيانات</p><p className="text-xs font-mono text-slate-600 dark:text-slate-300 bg-slate-50 dark:bg-slate-900/40 p-2 rounded-lg mt-1 break-all border border-slate-100 dark:border-slate-800">{dbPath || 'غير متوفر'}</p></div>
                <div><p className="text-[10px] font-bold text-slate-400 uppercase">إصدار التطبيق</p><p className="text-sm font-black text-indigo-600 mt-1">{appVersion || '—'}</p></div>
              </div>
              <button onClick={doInstallFromFile} disabled={installingFromFile} className="w-full bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-white py-3 rounded-2xl text-sm font-bold flex items-center justify-center gap-2 transition disabled:opacity-50"><Upload size={16} />تثبيت تحديث من ملف</button>
            </div>
          )}
          <div className="app-card p-6 rounded-3xl space-y-4 border-2 border-red-100 dark:border-red-900/30">
            <h4 className="font-bold text-red-600 dark:text-red-400 flex items-center gap-2"><AlertTriangle size={18} />منطقة العمليات الخطرة</h4>
            <div className="space-y-3">
              <button onClick={handleResetToFresh} disabled={resetLoading} className="w-full bg-emerald-50 dark:bg-emerald-900/20 hover:bg-emerald-100 dark:hover:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300 py-3 rounded-2xl text-sm font-bold flex items-center justify-center gap-2 transition disabled:opacity-50 border border-emerald-100 dark:border-emerald-900/30"><RefreshCw size={16} className={resetLoading ? 'animate-spin' : ''} />إعادة تهيئة النظام (Fresh)</button>
              <button onClick={handleClearAll} disabled={resetLoading} className="w-full bg-red-50 dark:bg-red-900/20 hover:bg-red-100 dark:hover:bg-red-900/40 text-red-700 dark:text-red-300 py-3 rounded-2xl text-sm font-bold flex items-center justify-center gap-2 transition disabled:opacity-50 border border-red-100 dark:border-red-900/30"><Trash2 size={16} />حذف جميع البيانات</button>
            </div>
            <p className="text-[10px] text-slate-400 leading-relaxed text-center">* العمليات أعلاه تغير حالة النظام بشكل نهائي ولا يمكن التراجع عنها.</p>
          </div>
          <div className="app-card p-6 rounded-3xl bg-indigo-50 dark:bg-indigo-900/10 border border-indigo-100 dark:border-indigo-900/30">
            <div className="flex gap-3 text-indigo-800 dark:text-indigo-300">
              <Key size={20} className="shrink-0" />
              <div className="text-xs leading-relaxed">
                <p className="font-bold mb-1">
                  تلميح (إجمالي السجلات:{' '}
                  {(Object.values(dbStats) as number[]).reduce((a: number, b: number) => a + b, 0)}
                  ):
                </p>
                يتم مزامنة البيانات الأساسية مع المخدم تلقائياً إذا كان مفعل. إعدادات المخدم موجودة في "الإعدادات العامة".
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
});

/* ========================= */
/*    Main Component        */
/* ========================= */

export const SystemMaintenancePageView: FC<SystemMaintenancePageViewProps> = ({ page }) => {
  const {
    user,
    isDesktopFast,
    health,
    predictiveInsight,
    performanceReport,
    loading,
    optimizing,
    activeTab,
    setActiveTab,
    testing,
    database,
    runCheck,
    runPerfTest,
    handleAutoFix,
  } = page;

  if (loading) {
    return <LoadingScreen />;
  }

  return (
    <div className="animate-fade-in space-y-8 pb-10">
      <MaintenanceHeader onRecheck={runCheck} loading={loading} activeTab={activeTab} />
      <MaintenanceTabs activeTab={activeTab} setActiveTab={setActiveTab} onRunPerfTest={runPerfTest} />

      {activeTab === 'diagnostics' && health && <DiagnosticsView health={health} optimizing={optimizing} onAutoFix={handleAutoFix} />}
      {activeTab === 'predictive' && predictiveInsight && <PredictiveView predictiveInsight={predictiveInsight} />}
      {activeTab === 'performance' && performanceReport && <PerformanceView performanceReport={performanceReport} />}
      {activeTab === 'testing' && <SystemTestView testing={testing} userRole={user?.الدور ?? ''} />}
      {activeTab === 'database' && <DatabaseView database={database} isDesktop={isDesktopFast} />}
    </div>
  );
};
