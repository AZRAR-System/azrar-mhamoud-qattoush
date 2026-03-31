/**
 * RTL Kanban: متأخرة → اليوم → هذا الأسبوع → مكتملة
 */

import React from 'react';
import { CheckCircle, Clock, Edit2, Trash2 } from 'lucide-react';
import { formatNumber, formatTimeFromHM } from '@/utils/format';
import type { الأشخاص_tbl, العقارات_tbl, العقود_tbl } from '@/types';
import type { KanbanBucketId, KanbanTask } from './taskBuckets';
import { isValidDueYMD } from './taskBuckets';

export interface TasksKanbanBoardProps {
  columns: Record<KanbanBucketId, KanbanTask[]>;
  todayStr: string;
  now: Date;
  peopleById: Map<string, الأشخاص_tbl>;
  contractsById: Map<string, العقود_tbl>;
  propertiesById: Map<string, العقارات_tbl>;
  properties: العقارات_tbl[];
  onToggle: (id: string) => void;
  onEdit: (task: KanbanTask) => void;
  onDelete: (id: string) => void;
}

const COLS: { id: KanbanBucketId; title: string; bar: string }[] = [
  { id: 'overdue', title: 'متأخرة', bar: 'from-rose-500 to-red-600' },
  { id: 'today', title: 'اليوم', bar: 'from-amber-500 to-orange-500' },
  { id: 'week', title: 'هذا الأسبوع', bar: 'from-sky-500 to-indigo-600' },
  { id: 'completed', title: 'مكتملة', bar: 'from-emerald-500 to-green-600' },
];

const toMinutes = (hm?: string): number | null => {
  const raw = String(hm || '').trim();
  if (!raw) return null;
  const m = raw.match(/^([01]\d|2[0-3]):([0-5]\d)$/);
  if (!m) return null;
  return Number(m[1]) * 60 + Number(m[2]);
};

export const TasksKanbanBoard: React.FC<TasksKanbanBoardProps> = ({
  columns,
  todayStr,
  now,
  peopleById,
  contractsById,
  propertiesById,
  properties,
  onToggle,
  onEdit,
  onDelete,
}) => {
  return (
    <div dir="rtl" className="flex flex-col xl:flex-row gap-4 overflow-x-auto pb-2 xl:pb-0">
      {COLS.map((col) => {
        const list = columns[col.id];
        return (
          <div
            key={col.id}
            className="flex-1 min-w-[min(100%,280px)] xl:min-w-0 flex flex-col rounded-2xl border border-slate-200 dark:border-slate-600 bg-slate-50/50 dark:bg-slate-900/30 overflow-hidden"
          >
            <div
              className={`px-4 py-3 bg-gradient-to-l ${col.bar} text-white flex items-center justify-between gap-2`}
            >
              <span className="font-black text-sm">{col.title}</span>
              <span className="text-xs font-bold bg-white/20 rounded-full px-2 py-0.5">
                {formatNumber(list.length)}
              </span>
            </div>
            <div className="p-2 flex-1 max-h-[min(70vh,520px)] overflow-y-auto space-y-2">
              {list.length === 0 ? (
                <p className="text-center text-xs text-slate-500 dark:text-slate-400 py-6">
                  لا يوجد
                </p>
              ) : (
                list.map((task) => (
                  <KanbanTaskCard
                    key={task.id}
                    task={task}
                    columnId={col.id}
                    todayStr={todayStr}
                    now={now}
                    peopleById={peopleById}
                    contractsById={contractsById}
                    propertiesById={propertiesById}
                    properties={properties}
                    onToggle={onToggle}
                    onEdit={onEdit}
                    onDelete={onDelete}
                  />
                ))
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
};

interface CardProps {
  task: KanbanTask;
  columnId: KanbanBucketId;
  todayStr: string;
  now: Date;
  peopleById: Map<string, الأشخاص_tbl>;
  contractsById: Map<string, العقود_tbl>;
  propertiesById: Map<string, العقارات_tbl>;
  properties: العقارات_tbl[];
  onToggle: (id: string) => void;
  onEdit: (task: KanbanTask) => void;
  onDelete: (id: string) => void;
}

const KanbanTaskCard: React.FC<CardProps> = ({
  task,
  columnId,
  todayStr,
  now,
  peopleById,
  contractsById,
  propertiesById,
  properties,
  onToggle,
  onEdit,
  onDelete,
}) => {
  const nowMinutes = now.getHours() * 60 + now.getMinutes();
  const taskMinutes = toMinutes(task.dueTime);
  const isOverdueNow =
    task.status === 'pending' &&
    task.dueDate === todayStr &&
    taskMinutes !== null &&
    nowMinutes >= taskMinutes;

  const showNoDateBadge = columnId === 'week' && !isValidDueYMD(task.dueDate);

  return (
    <div
      className={`rounded-xl border p-3 transition ${
        task.status === 'completed'
          ? 'bg-green-50 dark:bg-green-950 border-green-200 dark:border-green-800 opacity-70'
          : task.priority === 'عالية'
            ? 'bg-red-50 dark:bg-red-950 border-red-200 dark:border-red-800'
            : task.priority === 'متوسطة'
              ? 'bg-orange-50 dark:bg-orange-950 border-orange-200 dark:border-orange-800'
              : 'bg-green-50 dark:bg-green-950 border-green-200 dark:border-green-800'
      }`}
    >
      <div className="flex items-start gap-2">
        <button
          type="button"
          onClick={() => onToggle(task.id)}
          className="mt-0.5 p-1 hover:bg-white/60 dark:hover:bg-slate-700 rounded transition flex-shrink-0"
          title={task.status === 'completed' ? 'تحويل إلى معلقة' : 'تحديد كمكتملة'}
        >
          <CheckCircle
            size={16}
            className={
              task.status === 'completed' ? 'text-green-500 fill-green-500' : 'text-gray-400'
            }
          />
        </button>
        <div className="flex-1 min-w-0">
          <p
            className={`text-sm font-bold leading-snug ${
              task.status === 'completed'
                ? 'line-through text-slate-500'
                : 'text-slate-900 dark:text-white'
            }`}
          >
            {task.title}
          </p>
          {task.description ? (
            <p className="text-[11px] text-slate-600 dark:text-slate-400 mt-1 line-clamp-2">
              {task.description}
            </p>
          ) : null}

          {(() => {
            const personId = String(task.personId || '').trim();
            const contractId = String(task.contractId || '').trim();
            const propertyId = String(task.propertyId || '').trim();
            if (!personId && !contractId && !propertyId) return null;

            const person = personId ? peopleById.get(personId) : undefined;
            const contract = contractId ? contractsById.get(contractId) : undefined;
            const derivedPropertyId = propertyId || String(contract?.رقم_العقار || '').trim();
            const property = derivedPropertyId ? propertiesById.get(derivedPropertyId) : undefined;

            const personName = String(person?.الاسم || task.clientName || '').trim();
            const phone = String(task.phone || person?.رقم_الهاتف || '').trim();
            const propertyCode = String(property?.الكود_الداخلي || '').trim();

            const address = String(property?.العنوان || '').trim();
            const contractStart = contract?.تاريخ_البداية
              ? String(contract.تاريخ_البداية).slice(0, 10)
              : '';
            const contractEnd = contract?.تاريخ_النهاية
              ? String(contract.تاريخ_النهاية).slice(0, 10)
              : '';
            const contractRange =
              contractStart && contractEnd ? `${contractStart} → ${contractEnd}` : '';

            const ownedProperties = personId
              ? properties.filter((p) => String(p?.رقم_المالك || '').trim() === personId)
              : [];
            const ownedSummary = ownedProperties.length
              ? ownedProperties
                  .slice()
                  .sort((a, b) =>
                    String(a?.الكود_الداخلي || '').localeCompare(String(b?.الكود_الداخلي || ''))
                  )
                  .slice(0, 3)
                  .map((p) => String(p?.الكود_الداخلي || p?.رقم_العقار || '').trim())
                  .filter(Boolean)
              : [];

            return (
              <div className="text-[10px] text-slate-600 dark:text-slate-400 mt-1 flex flex-wrap gap-x-2 gap-y-0.5">
                {personName ? <span>الشخص: {personName}</span> : null}
                {phone ? <span dir="ltr">{phone}</span> : null}
                {contractId ? <span dir="ltr">العقد: {contractId}</span> : null}
                {propertyCode ? (
                  <span>العقار: {propertyCode}</span>
                ) : derivedPropertyId ? (
                  <span dir="ltr">العقار: {derivedPropertyId}</span>
                ) : null}
                {contractRange ? <span dir="ltr">{contractRange}</span> : null}
                {address ? <span>العنوان: {address}</span> : null}
                {ownedProperties.length > 0 ? (
                  <span>
                    عقارات يملكها: {formatNumber(ownedProperties.length)}
                    {ownedSummary.length ? ` (${ownedSummary.join('، ')})` : ''}
                  </span>
                ) : null}
              </div>
            );
          })()}

          <div className="flex items-center gap-1.5 mt-2 flex-wrap">
            <span className="text-[10px] bg-indigo-200 dark:bg-indigo-900 text-indigo-800 dark:text-indigo-200 px-1.5 py-0.5 rounded">
              {task.category}
            </span>
            <span
              className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${
                task.priority === 'عالية'
                  ? 'bg-red-200 dark:bg-red-900 text-red-800 dark:text-red-200'
                  : task.priority === 'متوسطة'
                    ? 'bg-orange-200 dark:bg-orange-900 text-orange-800 dark:text-orange-200'
                    : 'bg-green-200 dark:bg-green-900 text-green-800 dark:text-green-200'
              }`}
            >
              {task.priority}
            </span>
            <span className="text-[10px] text-slate-600 dark:text-slate-400 flex items-center gap-0.5">
              <Clock size={10} />
              <span dir="ltr">
                {showNoDateBadge ? '—' : task.dueDate}
                {!showNoDateBadge && task.dueTime
                  ? ` • ${formatTimeFromHM(task.dueTime, { locale: 'en-US', hour12: true })}`
                  : ''}
              </span>
            </span>
            {showNoDateBadge ? (
              <span className="text-[10px] bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200 px-1.5 py-0.5 rounded font-bold">
                بدون تاريخ
              </span>
            ) : null}
            {isOverdueNow && (
              <span className="text-[10px] bg-red-200 dark:bg-red-900 text-red-800 dark:text-red-200 px-1.5 py-0.5 rounded font-bold">
                متأخرة الآن
              </span>
            )}
          </div>
        </div>
        <div className="flex flex-col gap-1 flex-shrink-0">
          <button
            type="button"
            onClick={() => onEdit(task)}
            className="p-1.5 hover:bg-gray-200 dark:hover:bg-slate-700 rounded transition"
            title="تعديل"
          >
            <Edit2 size={14} className="text-indigo-500" />
          </button>
          <button
            type="button"
            onClick={() => onDelete(task.id)}
            className="p-1.5 hover:bg-gray-200 dark:hover:bg-slate-700 rounded transition"
            title="حذف"
          >
            <Trash2 size={14} className="text-red-500" />
          </button>
        </div>
      </div>
    </div>
  );
};
