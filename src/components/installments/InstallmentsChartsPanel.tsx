import type { InstallmentsPageModel } from '@/hooks/useInstallments';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell as RechartsCell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { BarChart3, PieChart as PieChartIcon } from 'lucide-react';

type Props = { page: InstallmentsPageModel };

export function InstallmentsChartsPanel({ page }: Props) {
  const { showCharts, financialStats } = page;

  return (
    <>
      {showCharts && financialStats && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 animate-in zoom-in duration-500">
          <div className="app-card p-6 lg:p-8 min-h-[400px] flex flex-col">
            <h3 className="text-sm font-black text-slate-500 mb-6 flex items-center gap-2 uppercase tracking-widest">
              <PieChartIcon size={16} /> حالة التحصيل المالي
            </h3>
            <div className="flex-1 min-h-[250px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={[
                      { name: 'محصل', value: financialStats.totalCollected },
                      {
                        name: 'متبقي',
                        value: Math.max(0, financialStats.totalExpected - financialStats.totalCollected),
                      },
                    ]}
                    innerRadius={60}
                    outerRadius={80}
                    paddingAngle={5}
                    dataKey="value"
                  >
                    <RechartsCell fill="#4f46e5" />
                    <RechartsCell fill="#e2e8f0" />
                  </Pie>
                  <Tooltip 
                    contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="flex justify-center gap-6 mt-4">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-indigo-600"></div>
                <span className="text-xs font-bold text-slate-600 dark:text-slate-400">
                  محصل: {financialStats.totalCollected.toLocaleString()}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-slate-200"></div>
                <span className="text-xs font-bold text-slate-600 dark:text-slate-400">
                  متبقي:{' '}
                  {Math.max(0, financialStats.totalExpected - financialStats.totalCollected).toLocaleString()}
                </span>
              </div>
            </div>
          </div>

          <div className="app-card p-6 lg:p-8 min-h-[400px] flex flex-col">
            <h3 className="text-sm font-black text-slate-500 mb-6 flex items-center gap-2 uppercase tracking-widest">
              <BarChart3 size={16} /> مقارنة القيم المالية
            </h3>
            <div className="flex-1 min-h-[250px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={[
                    { name: 'المتوقع', value: financialStats.totalExpected },
                    { name: 'المحصل', value: financialStats.totalCollected },
                    { name: 'المتأخر', value: financialStats.totalOverdue },
                  ]}
                  margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
                >
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis
                    dataKey="name"
                    axisLine={false}
                    tickLine={false}
                    tick={{ fontSize: 12, fontWeight: 700, fill: '#64748b' }}
                  />
                  <YAxis hide />
                  <Tooltip 
                    cursor={{ fill: '#f8fafc' }}
                    contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                  />
                  <Bar dataKey="value" radius={[10, 10, 0, 0]} barSize={40}>
                    {[
                      { name: 'المتوقع', color: '#4f46e5' },
                      { name: 'المحصل', color: '#10b981' },
                      { name: 'المتأخر', color: '#ef4444' },
                    ].map((entry, index) => (
                      <RechartsCell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
            <p className="text-[10px] text-center text-slate-400 mt-4 italic">
              * تعتمد هذه الإحصائيات على نتائج الفلترة الحالية
            </p>
          </div>
        </div>
      )}
    </>
  );
}
