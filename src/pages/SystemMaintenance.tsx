import React, {
  useState,
  useEffect,
  useCallback,
  memo,
} from 'react';
import { DS } from '@/constants/designSystem';
import { Button } from '@/components/ui/Button';
import { DbService } from '@/services/mockDb';
import { useAuth } from '@/context/AuthContext';
import { useSmartModal } from '@/context/ModalContext';
import { SystemHealth, PredictiveInsight } from '@/types';
import { useDbSignal } from '@/hooks/useDbSignal';
import { isTenancyRelevant } from '@/utils/tenancy';
import { validateAllData } from '@/services/dataValidation';
import { runSystemScenarioTests, UiTestResult } from '@/services/integrationTests';
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
  Upload
} from 'lucide-react';
import { useToast } from '@/context/ToastContext';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { PaginationControls } from '@/components/shared/PaginationControls';
import type { العقود_tbl, الكمبيالات_tbl } from '@/types/types';
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

type TabKey = 'diagnostics' | 'predictive' | 'performance' | 'testing' | 'database';

interface PerformanceRow {
  name: string;
  before: number;
  after: number;
}

type ViteMeta = {
  env?: {
    VITE_AUTORUN_SYSTEM_TESTS?: unknown;
    VITE_ENABLE_INTEGRATION_TEST_DATA?: unknown;
  };
};

const hasMessage = (value: unknown): value is { message: string } => {
  if (typeof value !== 'object' || value === null) return false;
  return typeof (value as Record<string, unknown>).message === 'string';
};

const getErrorMessage = (error: unknown): string | undefined => {
  if (error instanceof Error) return error.message;
  if (typeof error === 'string') return error;
  if (hasMessage(error)) return error.message;
  return undefined;
};

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
  activeTab: TabKey;
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
  activeTab: TabKey;
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
  // Simple HTML/CSS Circular Progress to avoid SVG complexity causing layout shifts
  const scoreColor =
    health.score > 80 ? 'text-emerald-500 border-emerald-500' : health.score > 60 ? 'text-amber-500 border-amber-500' : 'text-red-500 border-red-500';

  const statusConfig = (() => {
    switch (health.status) {
      case 'Excellent':
        return { icon: CheckCircle, className: 'bg-emerald-100 text-emerald-700 border-emerald-200', label: 'ممتازة' };
      case 'Good':
        return { icon: ShieldCheck, className: 'bg-indigo-100 text-indigo-700 border-indigo-200', label: 'جيدة' };
      case 'Warning':
        return { icon: AlertTriangle, className: 'bg-amber-100 text-amber-700 border-amber-200', label: 'متوسطة' };
      case 'Critical':
      default:
        return { icon: XCircle, className: 'bg-red-100 text-red-700 border-red-200', label: 'حرجة' };
    }
  })();

  const StatusIcon = statusConfig.icon;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 animate-slide-up">
      
      {/* 1. Health Score Card (Left Column) */}
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

      {/* 2. Stats & Issues (Right Column) */}
      <div className="lg:col-span-8 flex flex-col gap-6">
        
        {/* Stats Row */}
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

        {/* Detailed Issues List */}
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
                health.issues.map(issue => (
                  <div key={issue.id} className="p-4 bg-gray-50 dark:bg-slate-700/20 rounded-xl border border-gray-100 dark:border-slate-700 flex gap-4">
                    <div className={`mt-1 p-2 rounded-lg h-fit ${issue.type === 'Critical' ? 'bg-red-100 text-red-600' : 'bg-amber-100 text-amber-600'}`}>
                      {issue.type === 'Critical' ? <AlertOctagon size={18}/> : <AlertTriangle size={18}/>}
                    </div>
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-bold text-slate-800 dark:text-white text-sm">{issue.category} Issue</span>
                        <StatusBadge
                          status={issue.type}
                          showIcon={false}
                          className="!text-[10px] !px-2 !py-0.5 uppercase"
                        />
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
        
        {/* Score Card */}
        <div className="bg-gradient-to-br from-indigo-600 to-violet-800 rounded-3xl p-8 text-white shadow-xl shadow-indigo-500/20 relative overflow-hidden flex flex-col justify-between min-h-[300px]">
          <div className="relative z-10">
            <h3 className="text-indigo-100 font-bold flex items-center gap-2 mb-4">
              <Activity size={20} /> مؤشر الاستقرار المستقبلي
            </h3>
            <div className="flex items-baseline gap-2 mb-6">
              <span className="text-7xl font-black tracking-tight">{predictiveInsight.score}</span>
              <span className="text-2xl opacity-60 font-medium">/ 100</span>
            </div>
            
            <div className="flex flex-wrap gap-2 mb-4">
                <span className="px-3 py-1 rounded-lg text-sm font-bold bg-white/20 border border-white/10 backdrop-blur-md">
                  {predictiveInsight.status === 'Safe' ? '✅ الوضع آمن' : '⚠️ يتطلب مراقبة'}
                </span>
                <span className="px-3 py-1 rounded-lg text-sm font-bold bg-white/20 border border-white/10 backdrop-blur-md">
                  {predictiveInsight.trend === 'Improving' ? '📈 الاتجاه صاعد' : '➡️ الاتجاه مستقر'}
                </span>
            </div>
            
            <p className="text-sm text-indigo-100 opacity-90 leading-relaxed whitespace-normal break-words">
               {predictiveInsight.status === 'Safe' 
                 ? 'خوارزميات الذكاء الاصطناعي تتوقع استقراراً مالياً وتشغيلياً عالياً خلال الـ 30 يوماً القادمة.' 
                 : 'تم رصد مؤشرات قد تؤدي لتعثر مالي أو إداري، يرجى مراجعة التوصيات بعناية.'}
            </p>
          </div>
          
          {/* Background Decor */}
          <BrainCircuit className="absolute bottom-[-20px] left-[-20px] text-white opacity-10 w-64 h-64 rotate-12 pointer-events-none" />
          <div className="absolute top-0 right-0 w-64 h-64 bg-purple-500 opacity-20 blur-3xl rounded-full mix-blend-overlay pointer-events-none" />
        </div>

        {/* AI Recommendations */}
        <div className="app-card p-8 rounded-3xl flex flex-col min-h-[300px]">
          <h3 className="font-bold text-slate-800 dark:text-white mb-6 flex items-center gap-2 text-lg">
            <Zap size={24} className="text-amber-500 fill-amber-500" /> توصيات الذكاء الاصطناعي
          </h3>
          
          <div className="flex-1 overflow-y-auto custom-scrollbar pr-2 space-y-3 max-h-[300px]">
            {predictiveInsight.recommendations.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-gray-400 py-4">
                <CheckCircle size={40} className="mb-2 opacity-30" />
                <p>لا توجد توصيات، الأداء مثالي.</p>
              </div>
            ) : (
              predictiveInsight.recommendations.map((rec, i) => (
                <div key={i} className="flex gap-3 p-3 bg-amber-50 dark:bg-amber-900/10 rounded-xl border border-amber-100 dark:border-amber-800/30">
                  <span className="w-6 h-6 rounded-full bg-amber-200 dark:bg-amber-800 text-amber-900 dark:text-amber-100 flex items-center justify-center text-xs font-bold flex-shrink-0 mt-0.5">
                    {i + 1}
                  </span>
                  <p className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed whitespace-normal">{rec}</p>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Risk Analysis Chart */}
      <div className="app-card p-8 rounded-3xl">
         <h3 className="font-bold text-slate-800 dark:text-white mb-6 flex items-center gap-2 text-lg">
            <AlertOctagon size={24} className="text-red-500" /> توزيع المخاطر المحتملة
         </h3>
         
         <div className="flex flex-col md:flex-row items-center gap-12">
            {/* Pie Chart */}
            <div className="w-full md:w-[350px] h-[300px] relative flex-shrink-0">
               {hasRiskFactors ? (
                 <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                       <Pie
                          data={predictiveInsight.riskFactors}
                          cx="50%" cy="50%"
                          innerRadius={80} outerRadius={120}
                          paddingAngle={5}
                          dataKey="count"
                          stroke="none"
                       >
                          {predictiveInsight.riskFactors.map((entry, index) => (
                             <Cell key={`cell-${index}`} fill={riskColors[index % riskColors.length]} />
                          ))}
                       </Pie>
                       <Tooltip 
                          contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)' }}
                       />
                    </PieChart>
                 </ResponsiveContainer>
               ) : (
                  <div className="flex flex-col items-center justify-center text-gray-400 border-4 border-dashed border-gray-100 dark:border-slate-700 rounded-full w-64 h-64 mx-auto">
                    <ShieldCheck size={48} className="mb-2 text-emerald-500 opacity-50" />
                    <p className="text-sm font-bold">لا يوجد مخاطر</p>
                 </div>
               )}
               {hasRiskFactors && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                     <span className="text-4xl font-bold text-slate-800 dark:text-white">{predictiveInsight.riskFactors.reduce((a,b) => a+b.count,0)}</span>
                     <span className="text-[10px] text-gray-400 uppercase tracking-widest font-bold">Risk Items</span>
                  </div>
               )}
            </div>

            {/* Custom Legend / List - MOVED OUTSIDE PIE */}
            <div className="flex-1 w-full grid grid-cols-1 sm:grid-cols-2 gap-4">
               {predictiveInsight.riskFactors.map((factor, idx) => (
                  <div key={idx} className="flex items-center justify-between p-5 bg-gray-50 dark:bg-slate-900/50 rounded-xl border border-gray-100 dark:border-slate-800">
                     <div className="flex items-center gap-3">
                        <div className="w-4 h-4 rounded-full" style={{ backgroundColor: riskColors[idx % riskColors.length] }}></div>
                        <span className="font-bold text-slate-700 dark:text-slate-200 text-sm">{factor.category}</span>
                     </div>
                     <div className="flex items-center gap-3">
                        <span className="text-sm font-bold text-slate-500 dark:text-slate-400">{factor.count} سجل</span>
                        <span className="text-xs font-mono font-bold bg-white dark:bg-slate-800 px-2 py-1 rounded border border-gray-200 dark:border-slate-700">
                           {factor.percentage}%


                        </span>
                     </div>
                  </div>
               ))}
               {!hasRiskFactors && (
                  <div className="col-span-2 p-6 bg-emerald-50 dark:bg-emerald-900/10 border border-emerald-100 dark:border-emerald-900/30 rounded-xl text-center">
                     <p className="text-emerald-700 dark:text-emerald-400 font-bold">النظام يعمل في المنطقة الآمنة تماماً.</p>
                     <p className="text-xs text-emerald-600/70 mt-1">لا توجد أي تهديدات مالية أو تشغيلية مرصودة.</p>
                  </div>
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

  useEffect(() => {
    setPage((p) => Math.min(Math.max(1, p), pageCount));
  }, [pageCount]);

  const visible = performanceReport.slice((page - 1) * pageSize, page * pageSize);

  return (
  <div className="app-card p-8 rounded-3xl animate-slide-up">
    
    <div className="flex flex-col md:flex-row md:items-start gap-6 mb-8">
      <div className="p-4 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 rounded-2xl flex-shrink-0">
        <Gauge size={32} />
      </div>
      <div>
        <h3 className="text-xl font-bold text-slate-800 dark:text-white">
            تقرير أداء الفهرسة (Caching Performance) - تحديث
        </h3>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-2 leading-relaxed max-w-3xl">
            مقارنة زمن القراءة بين تشغيلين متتاليين (لتقدير أثر الكاش/التجهيز)
        </p>
      </div>
    </div>

    {/* Chart Section */}
    <div className="h-[450px] w-full mb-10 bg-slate-50 dark:bg-slate-900/20 rounded-2xl p-4 border border-slate-100 dark:border-slate-800">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart 
          data={performanceReport} 
          barGap={12} 
          barSize={24}
          margin={{ top: 20, right: 30, left: 20, bottom: 60 }} // Extra bottom margin for Arabic labels
        >
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" strokeOpacity={0.5} />
          <XAxis
            dataKey="name"
            tick={{ fill: '#64748b', fontSize: 11, fontWeight: 600 }}
            tickLine={false}
            axisLine={false}
            dy={15}
            interval={0}
            angle={-10} // Slight angle to prevent overlap
            textAnchor="end"
          />
          <YAxis
            label={{
              value: 'الزمن (ms)',
              angle: -90,
              position: 'insideLeft',
              fill: '#94a3b8',
              fontSize: 12,
              dx: -10
            }}
            tick={{ fill: '#94a3b8', fontSize: 11 }}
            tickLine={false}
            axisLine={false}
            width={60} // Ensure width for Y labels
          />
          <Tooltip
            cursor={{ fill: 'rgba(0,0,0,0.04)' }}
            contentStyle={{
              borderRadius: '12px',
              border: 'none',
              boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)',
              padding: '12px',
              backgroundColor: 'rgba(255, 255, 255, 0.95)'
            }}
          />
          <Legend 
            verticalAlign="top" 
            height={36} 
            iconType="circle"
            formatter={(value) => <span className="text-slate-600 dark:text-slate-300 font-bold text-sm mr-4">{value}</span>}
          />
          <Bar
            dataKey="before"
            fill="#f87171" // Red-400
            name="قبل الفهرسة (Original)"
            radius={[4, 4, 0, 0]}
          />
          <Bar
            dataKey="after"
            fill="#10b981" // Emerald-500
            name="بعد الفهرسة (Optimized)"
            radius={[4, 4, 0, 0]}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>

    {/* Table Details */}
    <div className="app-card">
      <div className="p-4 border-b border-gray-100 dark:border-slate-700 bg-gray-50 dark:bg-slate-900/50">
        <PaginationControls page={page} pageCount={pageCount} onPageChange={setPage} />
      </div>
      <table className="w-full text-right text-sm">
        <thead className="bg-gray-50 dark:bg-slate-900/80 text-slate-500 font-bold">
          <tr>
            <th className="p-4">نوع العملية</th>
              <th className="p-4">التشغيل الأول (ms)</th>
              <th className="p-4">التشغيل الثاني (ms)</th>
              <th className="p-4">فرق الزمن</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100 dark:divide-slate-700">
          {visible.map((res) => {
              const improvement = res.before > 0 ? ((res.before - res.after) / res.before) * 100 : 0;
            return (
              <tr key={res.name} className="bg-white dark:bg-slate-800 hover:bg-gray-50 dark:hover:bg-slate-700/30 transition">
                <td className="p-4 font-bold text-slate-700 dark:text-white flex items-center gap-2">
                  <Calculator size={14} className="text-gray-400" />
                  {res.name}
                </td>
                <td className="p-4 text-red-500 font-mono text-base font-medium">
                  {res.before.toFixed(2)}
                </td>
                <td className="p-4 text-emerald-600 font-mono text-base font-bold">
                  {res.after.toFixed(4)}
                </td>
                <td className="p-4">
                  <div className="flex items-center gap-2">
                    <div className="flex-1 h-2 bg-gray-100 dark:bg-slate-700 rounded-full overflow-hidden max-w-[100px]">
                       <div className="h-full bg-emerald-500" style={{ width: `${Math.min(improvement, 100)}%` }}></div>
                    </div>
                    <span className="text-xs font-bold text-emerald-600">{improvement.toFixed(1)}%</span>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  </div>
  );
});

/* ========================= */
/*     Testing View (NEW)    */
/* ========================= */

const SystemTestView = memo(() => {
  const toast = useToast();
  const { user } = useAuth();
  const { openPanel } = useSmartModal();
  const [running, setRunning] = useState(false);
  const [allowMutation, setAllowMutation] = useState(false);
  const [results, setResults] = useState<UiTestResult[] | null>(null);
  const [resultsPage, setResultsPage] = useState(1);
  const resultsPageSize = 12;

  const isAutorunEnabled = (() => {
    const flag = (import.meta as unknown as ViteMeta)?.env?.VITE_AUTORUN_SYSTEM_TESTS;
    if (typeof flag === 'string') return flag.toLowerCase() === 'true';
    return !!flag;
  })();

  const isIntegrationDataEnabled = (() => {
    const flag = (import.meta as unknown as ViteMeta)?.env?.VITE_ENABLE_INTEGRATION_TEST_DATA;
    if (typeof flag === 'string') return flag.toLowerCase() === 'true';
    return !!flag;
  })();

  const runTests = useCallback(async () => {
    setRunning(true);
    try {
      const r = await runSystemScenarioTests({ allowDataMutation: allowMutation });
      setResults(r);
      const failed = r.filter(x => x.status === 'FAIL').length;
      toast[failed > 0 ? 'warning' : 'success'](failed > 0 ? `تم الانتهاء: ${failed} اختبار فشل` : 'تم تشغيل الاختبارات بنجاح');
    } catch (e: unknown) {
      toast.error(getErrorMessage(e) || 'فشل تشغيل الاختبارات');
    } finally {
      setRunning(false);
    }
  }, [allowMutation, toast]);

  // Optional automation: run tests immediately and print a summary for terminal logs.
  useEffect(() => {
    if (!isAutorunEnabled) return;
    if (running) return;
    if (results) return;

    const allowDataMutation = isIntegrationDataEnabled;
    setAllowMutation(allowDataMutation);
    setRunning(true);

    (async () => {
      try {
        const r = await runSystemScenarioTests({ allowDataMutation });
        setResults(r);

        const fail = r.filter(x => x.status === 'FAIL').length;
        toast[fail > 0 ? 'warning' : 'success'](fail > 0 ? `تم الانتهاء: ${fail} اختبار فشل` : 'تم تشغيل الاختبارات بنجاح');
      } catch (e: unknown) {
        toast.error(getErrorMessage(e) || 'فشل تشغيل الاختبارات');
      } finally {
        setRunning(false);
      }
    })();
  }, [isAutorunEnabled, isIntegrationDataEnabled, results, running, toast]);

  const handleResetAllData = useCallback(() => {
    if (user?.الدور !== 'SuperAdmin') {
      toast.error('هذه العملية متاحة للسوبر أدمن فقط');
      return;
    }

    openPanel('CONFIRM_MODAL', 'reset_all_data_step1', {
      title: 'تحذير',
      variant: 'danger',
      confirmText: 'متابعة',
      message:
        '⚠️ تحذير: سيتم حذف جميع البيانات التشغيلية (عقارات/عقود/دفعات/عمولات/تنبيهات/سجلات... إلخ) مع الإبقاء على المستخدمين والصلاحيات والقوالب.\n\nهل تريد المتابعة؟',
      onConfirm: () => {
        openPanel('CONFIRM_MODAL', 'reset_all_data_step2', {
          title: 'تأكيد نهائي',
          variant: 'danger',
          confirmText: 'نعم، احذف',
          message: 'تأكيد نهائي: لا يوجد تراجع (Undo). هل أنت متأكد 100%؟',
          onConfirm: () => {
            try {
              const result = DbService.resetAllData?.();
              if (result?.success === false) {
                toast.error(result?.message || 'فشل مسح البيانات');
                return;
              }
              toast.success(result?.message || 'تم مسح البيانات بنجاح');
              setTimeout(() => window.location.reload(), 800);
            } catch (e: unknown) {
              toast.error(getErrorMessage(e) || 'فشل مسح البيانات');
            }
          },
        });
      },
    });
  }, [openPanel, toast, user?.الدور]);

  const summary = results
    ? {
        pass: results.filter(r => r.status === 'PASS').length,
        fail: results.filter(r => r.status === 'FAIL').length,
        skip: results.filter(r => r.status === 'SKIP').length,
      }
    : null;

  const resultsPageCount = Math.max(1, Math.ceil((results?.length ?? 0) / resultsPageSize));

  useEffect(() => {
    setResultsPage(1);
  }, [results?.length]);

  useEffect(() => {
    setResultsPage((p) => Math.min(Math.max(1, p), resultsPageCount));
  }, [resultsPageCount]);

  const visibleResults = (results || []).slice((resultsPage - 1) * resultsPageSize, resultsPage * resultsPageSize);

  return (
    <div className="app-card p-8 rounded-3xl animate-slide-up space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="p-3 bg-orange-100 dark:bg-orange-900/30 text-orange-600 rounded-xl">
            <Terminal size={24} />
          </div>
          <div>
            <h3 className="text-xl font-bold text-slate-800 dark:text-white">اختبار سيناريوهات النظام</h3>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-2">
              الوضع الافتراضي آمن (قراءة فقط) ولا يضيف بيانات. يمكنك تفعيل إنشاء بيانات اختبار إذا رغبت.
            </p>
          </div>
        </div>

        <button
          onClick={runTests}
          disabled={running}
          className="flex items-center gap-2 bg-orange-600 text-white px-4 py-2 rounded-xl text-sm font-bold hover:bg-orange-700 disabled:opacity-50 transition"
        >
          {running ? <><RotateCcw size={16} className="animate-spin" /> جاري التشغيل...</> : <><Play size={16} /> تشغيل الاختبارات</>}
        </button>
      </div>

      <div className="app-card bg-slate-50 dark:bg-slate-900/30 border-slate-100 dark:border-slate-700 flex flex-col md:flex-row gap-4 md:items-center justify-between rounded-2xl p-4">
        <label className="flex items-center gap-3 text-sm font-bold text-slate-700 dark:text-slate-200">
          <input
            type="checkbox"
            checked={allowMutation}
            onChange={(e) => setAllowMutation(e.target.checked)}
          />
          السماح بإنشاء بيانات اختبار (يغيّر بيانات النظام)
        </label>
        <p className="text-xs text-slate-500 dark:text-slate-400">
          لتفعيل الاختبارات المُولِّدة للبيانات قد تحتاج أيضاً لضبط `VITE_ENABLE_INTEGRATION_TEST_DATA=true` أو `window.ENABLE_INTEGRATION_TEST_DATA=true`.
        </p>
      </div>

      {summary && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="p-4 rounded-2xl border border-emerald-200 bg-emerald-50 dark:bg-emerald-900/10 dark:border-emerald-900/30">
            <div className="text-2xl font-black text-emerald-700 dark:text-emerald-400">{summary.pass}</div>
            <div className="text-xs font-bold text-emerald-800/70 dark:text-emerald-300/70">نجح</div>
          </div>
          <div className="p-4 rounded-2xl border border-red-200 bg-red-50 dark:bg-red-900/10 dark:border-red-900/30">
            <div className="text-2xl font-black text-red-700 dark:text-red-400">{summary.fail}</div>
            <div className="text-xs font-bold text-red-800/70 dark:text-red-300/70">فشل</div>
          </div>
          <div className="app-card p-4 rounded-2xl dark:bg-slate-900/10">
            <div className="text-2xl font-black text-slate-700 dark:text-slate-200">{summary.skip}</div>
            <div className="text-xs font-bold text-slate-500 dark:text-slate-400">تم تخطيه</div>
          </div>
        </div>
      )}

      {!results ? (
        <div className="text-sm text-slate-500 dark:text-slate-400">
          اضغط "تشغيل الاختبارات" لبدء فحص السيناريوهات.
        </div>
      ) : (
        <div className="space-y-3">
          <PaginationControls page={resultsPage} pageCount={resultsPageCount} onPageChange={setResultsPage} />

          {visibleResults.map(r => (
            <div key={r.id} className="app-card p-4 rounded-2xl bg-white dark:bg-slate-900/20">
              <div className="flex items-center justify-between gap-3">
                <div className="font-bold text-slate-800 dark:text-white text-sm">{r.name}</div>
                <StatusBadge
                  status={r.status === 'PASS' ? 'نجح' : r.status === 'FAIL' ? 'فشل' : 'تم تخطيه'}
                  className="text-[10px] px-2 py-1 rounded font-black"
                />
              </div>
              <div className="text-sm text-slate-600 dark:text-slate-300 mt-2">{r.message}</div>
              {typeof r.durationMs === 'number' && (
                <div className="text-xs text-slate-400 mt-1">المدة: {r.durationMs.toFixed(2)}ms</div>
              )}
              {r.details && (
                <details className="mt-3">
                  <summary className="text-xs font-bold text-slate-600 dark:text-slate-300 cursor-pointer">تفاصيل</summary>
                  <pre className="mt-2 text-xs bg-slate-50 dark:bg-slate-900/40 p-3 rounded-xl overflow-auto border border-slate-100 dark:border-slate-700">
{JSON.stringify(r.details, null, 2)}
                  </pre>
                </details>
              )}
            </div>
          ))}

         {user?.الدور === 'SuperAdmin' && (
        <div className="bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900/30 rounded-2xl p-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="text-sm font-black text-red-800 dark:text-red-300">منطقة الخطر (SuperAdmin)</div>
              <div className="text-xs text-red-700/80 dark:text-red-300/80 mt-1">
                مسح جميع البيانات التشغيلية وإبقاء تكوينات النظام الأساسية فقط.
              </div>
            </div>
            <button
              onClick={handleResetAllData}
              className="bg-red-600 hover:bg-red-700 text-white font-bold px-4 py-2 rounded-xl text-sm flex items-center gap-2"
            >
              <Trash2 size={16} /> مسح كل البيانات
            </button>
          </div>
        </div>
      )}
        </div>
      )}
    </div>
  );
});

/* ========================= */
/*    Database View (NEW)    */
/* ========================= */

const DatabaseView = memo(() => {
  const toast = useToast();
  const { openPanel } = useSmartModal();
  const [dbPath, setDbPath] = useState<string>('');
  // Backup/restore is centralized in Settings.

  const [appVersion, setAppVersion] = useState<string>('');
  const [installingFromFile, setInstallingFromFile] = useState<boolean>(false);

  useEffect(() => {
    if (window.desktopDb?.getPath) {
      window.desktopDb.getPath().then(p => setDbPath(p)).catch(() => setDbPath(''));
    }

    if (window.desktopUpdater?.getVersion) {
      window.desktopUpdater.getVersion().then(v => setAppVersion(v)).catch(() => setAppVersion(''));
    }
  }, []);

  const doInstallFromFile = async () => {
    if (!window.desktopUpdater?.installFromFile) {
      toast.warning('ميزة التحديث من ملف متاحة فقط في وضع Desktop (Electron)');
      return;
    }
    setInstallingFromFile(true);
    try {
      const res = (await window.desktopUpdater.installFromFile()) as unknown as { success?: boolean; message?: string } | null;
      if (res?.success === false) {
        toast.error(res?.message || 'فشل تثبيت التحديث من ملف');
      }
    } catch (e: unknown) {
      toast.error(getErrorMessage(e) || 'فشل تثبيت التحديث من ملف');
    } finally {
      setInstallingFromFile(false);
    }
  };

  const handleInstallFromFile = () => {
    if (!window.desktopUpdater?.installFromFile) {
      toast.warning('ميزة التحديث من ملف متاحة فقط في وضع Desktop (Electron)');
      return;
    }

    openPanel('CONFIRM_MODAL', 'install_from_file', {
      title: 'تثبيت تحديث',
      confirmText: 'موافق',
      message: `اختر ملف التحديث (مثبت البرنامج .exe).

سيتم أخذ نسخة احتياطية إجبارية تلقائياً قبل التحديث (لحماية بياناتك). إذا فشل أخذ النسخة سيتم إيقاف التحديث.

بعدها سيتم إغلاق البرنامج ثم فتح المثبت. هل تريد المتابعة؟`,
      onConfirm: () => {
        void doInstallFromFile();
      },
    });
  };

  const isDesktop = !!window.desktopDb;

  return (
    <div className="app-card p-8 rounded-3xl animate-slide-up space-y-6">
      <div className="flex items-start gap-3">
        <div className="p-3 bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 rounded-xl">
          <Database size={24} />
        </div>
        <div>
          <h3 className="text-xl font-bold text-slate-800 dark:text-white">إدارة قاعدة البيانات</h3>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-2">
            النسخ الاحتياطي/الاسترجاع متاح الآن من صفحة الإعدادات فقط لتجنب التكرار.
          </p>
        </div>
      </div>

      {isDesktop && dbPath && (
        <div className="bg-slate-50 dark:bg-slate-900/30 border border-slate-200 dark:border-slate-700 rounded-2xl p-4">
          <div className="text-xs font-bold text-slate-500 dark:text-slate-400 mb-1">موقع قاعدة البيانات:</div>
          <div className="text-sm text-slate-700 dark:text-slate-200 font-mono bg-white dark:bg-slate-800 px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-600 break-all">
            {dbPath}
          </div>
        </div>
      )}

      {isDesktop && (
        <div className="bg-slate-50 dark:bg-slate-900/30 border border-slate-200 dark:border-slate-700 rounded-2xl p-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="text-sm font-black text-slate-800 dark:text-white">تحديث البرنامج</div>
              <div className="text-xs text-slate-600 dark:text-slate-300 mt-1">
                الإصدار الحالي: <span className="font-mono">{appVersion || '—'}</span>
              </div>
              <div className="text-xs text-slate-500 dark:text-slate-400 mt-2">
                اختر ملف التحديث <span className="font-mono">.exe</span> من جهازك ليتم تثبيته تلقائياً.
              </div>
            </div>
          </div>

          <div className="mt-4">
            <button
              onClick={handleInstallFromFile}
              disabled={installingFromFile}
              className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 disabled:cursor-not-allowed text-white font-bold px-4 py-3 rounded-xl text-sm flex items-center justify-center gap-2"
            >
              {installingFromFile ? (
                <><RotateCcw size={16} className="animate-spin" /> فتح المثبت...</>
              ) : (
                <><Upload size={16} /> تثبيت تحديث من ملف</>
              )}
            </button>
          </div>
        </div>
      )}

      <div className="bg-indigo-50 dark:bg-indigo-900/10 border border-indigo-200 dark:border-indigo-900/30 rounded-2xl p-5">
        <div className="flex items-start gap-3">
          <AlertTriangle size={20} className="text-indigo-600 flex-shrink-0 mt-0.5" />
          <div className="text-sm text-indigo-800 dark:text-indigo-200">
            <div className="font-bold mb-1">ملاحظة</div>
            <div>
              لتجنب التكرار، تم توحيد النسخ الاحتياطي/الاسترجاع داخل صفحة الإعدادات.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
});

/* ========================= */
/*     Main Component        */
/* ========================= */

export const SystemMaintenance: React.FC = () => {
  const isDesktopFast = typeof window !== 'undefined' && !!window.desktopDb;
  const [health, setHealth] = useState<SystemHealth | null>(null);
  const [predictiveInsight, setPredictiveInsight] = useState<PredictiveInsight | null>(null);
  const [performanceReport, setPerformanceReport] = useState<PerformanceRow[] | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [optimizing, setOptimizing] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<TabKey>(() => {
    const flag = (import.meta as unknown as ViteMeta)?.env?.VITE_AUTORUN_SYSTEM_TESTS;
    const enabled = typeof flag === 'string' ? flag.toLowerCase() === 'true' : !!flag;
    return enabled ? 'testing' : 'diagnostics';
  });

  const toast = useToast();

  const dbSignal = useDbSignal();

  const buildHealthFromValidation = useCallback((): SystemHealth => {
    const validation = validateAllData();
    const integrityWarnings = validation.warnings.length;
    const logicErrors = validation.errors.length;

    // Orphans isn't directly reported; approximate via FK errors count
    const orphans = validation.errors.filter(e => e.includes('غير موجود')).length;

    const score = Math.max(0, Math.min(100, 100 - (logicErrors * 10 + integrityWarnings * 3)));
    const status: SystemHealth['status'] = score >= 90 ? 'Excellent' : score >= 75 ? 'Good' : score >= 55 ? 'Warning' : 'Critical';

    const categorize = (msg: string) => {
      if (msg.startsWith('تكرار')) return 'فهرسة/تكرار';
      if (msg.includes('غير موجود')) return 'علاقات/ربط';
      if (msg.includes('تاريخ')) return 'تواريخ';
      if (msg.includes('مدة')) return 'منطق/مدة';
      return 'بيانات';
    };

    const issues: SystemHealth['issues'] = [
      ...validation.errors.map((e, idx) => ({
        id: `E-${idx}`,
        type: 'Critical' as const,
        category: categorize(e),
        description: e,
      })),
      ...validation.warnings.map((w, idx) => ({
        id: `W-${idx}`,
        type: 'Warning' as const,
        category: categorize(w),
        description: w,
      })),
    ];

    return {
      score,
      status,
      issues,
      stats: {
        integrityWarnings,
        orphans,
        logicErrors,
      },
    };
  }, []);

  const buildPredictiveFromData = useCallback((): PredictiveInsight => {
    const today = new Date();
    const contracts = DbService.getContracts() as العقود_tbl[];
    const installments = DbService.getInstallments() as الكمبيالات_tbl[];

    const lateInstallments = installments.filter((inst) => {
      const dueDate = new Date(inst.تاريخ_استحقاق);
      return inst.حالة_الكمبيالة !== 'مدفوع' && dueDate < today;
    });

    const expiringContracts = contracts.filter((c) => {
      const endDate = new Date(c.تاريخ_النهاية);
      const daysUntil = Math.ceil((endDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
      return isTenancyRelevant(c) && daysUntil > 0 && daysUntil <= 30;
    });

    const riskFactors = [
      { category: 'LatePayments', count: lateInstallments.length, percentage: 0 },
      { category: 'ExpiringContracts', count: expiringContracts.length, percentage: 0 },
    ].filter(r => r.count > 0);

    const totalRisk = riskFactors.reduce((s, r) => s + r.count, 0);
    const normalized = riskFactors.map(r => ({
      ...r,
      percentage: totalRisk > 0 ? Math.round((r.count / totalRisk) * 100) : 0,
    }));

    const score = Math.max(0, Math.min(100, 100 - (lateInstallments.length * 4 + expiringContracts.length * 2)));
    const status: PredictiveInsight['status'] = score >= 70 ? 'Safe' : 'Risk';
    const trend: PredictiveInsight['trend'] = totalRisk === 0 ? 'Improving' : score >= 70 ? 'Stable' : 'Declining';

    const recommendations: string[] = [];
    if (lateInstallments.length > 0) recommendations.push(`يوجد ${lateInstallments.length} دفعة متأخرة. راجع صفحة الكمبيالات واتخذ إجراء متابعة.`);
    if (expiringContracts.length > 0) recommendations.push(`يوجد ${expiringContracts.length} عقد سينتهي خلال 30 يوم. ابدأ إجراءات التجديد مبكراً.`);
    if (recommendations.length === 0) recommendations.push('لا توجد مخاطر واضحة حالياً. استمر بالمراقبة الدورية.');

    return {
      score,
      status,
      trend,
      riskFactors: normalized,
      recommendations,
    };
  }, []);

  const runCheck = useCallback(() => {
    if (isDesktopFast) {
      const ok = window.confirm(
        'تنبيه: الفحص الشامل قد يكون ثقيلاً جداً على قواعد بيانات كبيرة (200k+).\n\nهل تريد المتابعة؟'
      );
      if (!ok) {
        setHealth({
          score: 75,
          status: 'Warning',
          issues: [
            {
              id: 'desktop-fast-skip',
              type: 'Warning',
              category: 'الأداء',
              description: 'تم إلغاء الفحص الشامل لتجنب تحميل/تجميد البيانات الكبيرة في وضع الديسكتوب السريع.',
            },
          ],
          stats: { integrityWarnings: 0, orphans: 0, logicErrors: 0 },
        });
        setPredictiveInsight({
          score: 75,
          status: 'Safe',
          trend: 'Stable',
          riskFactors: [],
          recommendations: ['قم بتشغيل الفحص يدوياً عند الحاجة (قد يستغرق وقتاً على بيانات كبيرة).'],
        });
        setLoading(false);
        return;
      }
    }
    setActiveTab('diagnostics');
    setLoading(true);

    // Ensure loading screen is visible at least one frame
    requestAnimationFrame(() => {
      try {
        const healthResult = buildHealthFromValidation();
        const predictiveResult = buildPredictiveFromData();
        setHealth(healthResult);
        setPredictiveInsight(predictiveResult);
      } catch (e: unknown) {
        toast.error(getErrorMessage(e) || 'حدث خطأ أثناء إعادة الفحص');
      } finally {
        setLoading(false);
      }
    });
  }, [buildHealthFromValidation, buildPredictiveFromData, isDesktopFast, toast]);

  const runPerfTest = useCallback(() => {
    if (isDesktopFast) {
      const ok = window.confirm(
        'تنبيه: اختبار الأداء يقوم بقراءات كاملة للبيانات وقد يسبب تجمد مؤقت على قواعد بيانات كبيرة.\n\nهل تريد المتابعة؟'
      );
      if (!ok) return;
    }
    setLoading(true);
    try {
      // Measure a few representative reads to build a simple, real report
      const measure = (name: string, fn: () => void): PerformanceRow => {
        const t0 = performance.now();
        fn();
        const t1 = performance.now();
        // "after" is a second run to capture cache effects
        const t2 = performance.now();
        fn();
        const t3 = performance.now();
        return { name, before: t1 - t0, after: t3 - t2 };
      };

      const report: PerformanceRow[] = [
        measure('قراءة الأشخاص', () => { DbService.getPeople(); }),
        measure('قراءة العقارات', () => { DbService.getProperties(); }),
        measure('قراءة العقود', () => { DbService.getContracts(); }),
        measure('قراءة الكمبيالات', () => { DbService.getInstallments(); }),
        measure('قراءة التنبيهات', () => { DbService.getAlerts(); }),
      ];

      setPerformanceReport(report);
      setActiveTab('performance');
    } finally {
      setLoading(false);
    }
  }, [isDesktopFast]);

  const handleAutoFix = useCallback(() => {
    setOptimizing(true);
    try {
      const result = DbService.optimizeSystem();
      toast.success(result.message);
      runCheck();
    } finally {
      setOptimizing(false);
    }
  }, [runCheck, toast]);

  useEffect(() => {
    // Avoid auto-running heavy checks in Desktop fast mode.
    if (!isDesktopFast) {
      runCheck();
      return;
    }

    setHealth({
      score: 85,
      status: 'Good',
      issues: [
        {
          id: 'desktop-fast-note',
          type: 'Warning',
          category: 'الأداء',
          description: 'تم تعطيل الفحص التلقائي في وضع الديسكتوب السريع لتجنب تحميل بيانات ضخمة. اضغط "إعادة الفحص" لتشغيل الفحص الشامل عند الحاجة.',
        },
      ],
      stats: { integrityWarnings: 0, orphans: 0, logicErrors: 0 },
    });
    setPredictiveInsight({
      score: 85,
      status: 'Safe',
      trend: 'Stable',
      riskFactors: [],
      recommendations: ['التشخيص التلقائي معطل في وضع الديسكتوب السريع.'],
    });
    setLoading(false);
  }, [runCheck, dbSignal, isDesktopFast]);

  if (loading) {
    return <LoadingScreen />;
  }

  return (
    <div className="animate-fade-in space-y-8 pb-10">
      <MaintenanceHeader onRecheck={runCheck} loading={loading} activeTab={activeTab} />


      <MaintenanceTabs
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        onRunPerfTest={runPerfTest}
      />

      {activeTab === 'diagnostics' && health && (
        <DiagnosticsView
          health={health}
          optimizing={optimizing}
          onAutoFix={handleAutoFix}
        />
      )}

      {activeTab === 'predictive' && predictiveInsight && (
        <PredictiveView predictiveInsight={predictiveInsight} />
      )}

      {activeTab === 'performance' && performanceReport && (
        <PerformanceView performanceReport={performanceReport} />
      )}

      {activeTab === 'testing' && (
        <SystemTestView />
      )}

      {activeTab === 'database' && (
        <DatabaseView />
      )}
    </div>
  );
};























































































