/**
 * © 2025 - Developed by Mahmoud Qattoush
 * Calendar & Tasks Layer - Events and task management
 */

import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { Calendar, Clock, CheckCircle, AlertCircle, FileText, Zap, Plus, Trash2, Edit2 } from 'lucide-react';
import { DashboardData } from '@/hooks/useDashboardData';
import { DbService } from '@/services/mockDb';
import { isTenancyRelevant } from '@/utils/tenancy';
import { useSmartModal } from '@/context/ModalContext';
import { formatDateYMD, formatMonthYear, formatNumber, formatTimeFromHM } from '@/utils/format';
import { parseDateOnly, daysBetweenDateOnly, toDateOnly } from '@/utils/dateOnly';
import { useToast } from '@/context/ToastContext';
import { storage } from '@/services/storage';
import type { FollowUpTask, الأشخاص_tbl, العقارات_tbl, العقود_tbl } from '@/types';

interface Task {
  id: string;
  title: string;
  dueDate: string;
  dueTime?: string;
  priority: 'عالية' | 'متوسطة' | 'منخفضة';
  status: 'pending' | 'completed';
  category: string;
  description?: string;

  // Linked entities (optional)
  personId?: string;
  contractId?: string;
  propertyId?: string;

  // Cached person info (optional)
  clientName?: string;
  phone?: string;
}

interface CalendarTasksLayerProps {
  data: DashboardData;
}

const isRecord = (v: unknown): v is Record<string, unknown> => {
  return !!v && typeof v === 'object' && !Array.isArray(v);
};

export const CalendarTasksLayer: React.FC<CalendarTasksLayerProps> = ({ data: _data }) => {
  const { openPanel } = useSmartModal();
  const toast = useToast();
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [tasks, setTasks] = useState<Task[]>([]);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [newTask, setNewTask] = useState<Partial<Task>>({
    title: '',
    dueDate: formatDateYMD(new Date()),
    dueTime: '',
    priority: 'متوسطة',
    status: 'pending',
    category: 'عام',
    description: '',
    personId: '',
    contractId: '',
    propertyId: '',
    clientName: '',
    phone: '',
  });

  const todayStr = formatDateYMD(new Date());

  const dataRef = useRef(_data);
  useEffect(() => {
    dataRef.current = _data;
  }, [_data]);

  const toMinutes = (hm?: string): number | null => {
    const raw = String(hm || '').trim();
    if (!raw) return null;
    const m = raw.match(/^([01]\d|2[0-3]):([0-5]\d)$/);
    if (!m) return null;
    return Number(m[1]) * 60 + Number(m[2]);
  };

  const people = useMemo(() => {
    try {
      return (Array.isArray(_data?.people) ? (_data.people as unknown as الأشخاص_tbl[]) : []) || [];
    } catch {
      return [] as الأشخاص_tbl[];
    }
  }, [_data]);

  const contracts = useMemo(() => {
    try {
      return (Array.isArray(_data?.contracts) ? (_data.contracts as unknown as العقود_tbl[]) : []) || [];
    } catch {
      return [] as العقود_tbl[];
    }
  }, [_data]);

  const properties = useMemo(() => {
    try {
      return (Array.isArray(_data?.properties) ? (_data.properties as unknown as العقارات_tbl[]) : []) || [];
    } catch {
      return [] as العقارات_tbl[];
    }
  }, [_data]);

  const peopleById = useMemo(() => {
    const map = new Map<string, الأشخاص_tbl>();
    for (const p of people) {
      const id = String(p?.رقم_الشخص || '').trim();
      if (id) map.set(id, p);
    }
    return map;
  }, [people]);

  const contractsById = useMemo(() => {
    const map = new Map<string, العقود_tbl>();
    for (const c of contracts) {
      const id = String(c?.رقم_العقد || '').trim();
      if (id) map.set(id, c);
    }
    return map;
  }, [contracts]);

  const propertiesById = useMemo(() => {
    const map = new Map<string, العقارات_tbl>();
    for (const p of properties) {
      const id = String(p?.رقم_العقار || '').trim();
      if (id) map.set(id, p);
    }
    return map;
  }, [properties]);

  const expiringContracts = useMemo(() => {
    try {
      const desktopExpiring = _data.desktopHighlights?.expiringContracts ?? [];
      if (desktopExpiring.length > 0) {
        const today = toDateOnly(new Date());
        const list: Array<{ id: string; propertyCode: string; tenantName: string; endDate: string; daysUntil: number }> = [];

        for (const r of desktopExpiring) {
          const contractId = String(r?.contractId || '').trim();
          if (!contractId) continue;
          const endIso = String(r?.endDate || '').trim();
          const end = parseDateOnly(endIso);
          if (!end) continue;
          const daysUntil = daysBetweenDateOnly(today, end);
          if (daysUntil < 0 || daysUntil > 90) continue;

          list.push({
            id: contractId,
            propertyCode: String(r?.propertyCode || '').trim() || '—',
            tenantName: String(r?.tenantName || '').trim() || '—',
            endDate: endIso,
            daysUntil,
          });
        }

        list.sort((a, b) => a.daysUntil - b.daysUntil);
        return list.slice(0, 8);
      }

      const today = toDateOnly(new Date());
      const list: Array<{ id: string; propertyCode: string; tenantName: string; endDate: string; daysUntil: number }> = [];

      for (const c of contracts) {
        if (!isTenancyRelevant(c)) continue;

        const endIso = String(c?.تاريخ_النهاية || '').trim();
        const end = parseDateOnly(endIso);
        if (!end) continue;

        const daysUntil = daysBetweenDateOnly(today, end);
        if (daysUntil < 0 || daysUntil > 90) continue;

        const contractId = String(c?.رقم_العقد || '').trim();
        if (!contractId) continue;

        const propertyId = String(c?.رقم_العقار || '').trim();
        const tenantId = String(c?.رقم_المستاجر || '').trim();

        const property = propertyId ? propertiesById.get(propertyId) : undefined;
        const tenant = tenantId ? peopleById.get(tenantId) : undefined;

        const propertyCode = String(property?.الكود_الداخلي || '').trim() || '—';
        const tenantName = String(tenant?.الاسم || '').trim() || '—';

        list.push({
          id: contractId,
          propertyCode,
          tenantName,
          endDate: endIso,
          daysUntil,
        });
      }

      list.sort((a, b) => a.daysUntil - b.daysUntil);
      return list.slice(0, 8);
    } catch {
      return [] as Array<{ id: string; propertyCode: string; tenantName: string; endDate: string; daysUntil: number }>;
    }
  }, [contracts, peopleById, propertiesById, _data.desktopHighlights]);

  const resolvePersonInfo = useCallback(
    (personId?: string) => {
      const id = String(personId || '').trim();
      if (!id) return { clientName: undefined, phone: undefined } as const;
      const person = peopleById.get(id);
      const clientName = String(person?.الاسم || '').trim() || undefined;
      const phone = String(person?.رقم_الهاتف || '').trim() || undefined;
      return { clientName, phone } as const;
    },
    [peopleById]
  );

  const pickBestContractForPerson = useCallback(
    (personId?: string) => {
      const id = String(personId || '').trim();
      if (!id) return undefined;

      const now = new Date();
      const candidates = contracts
        .filter((c) => !c?.isArchived && (String(c?.رقم_المستاجر) === id || String(c?.رقم_الكفيل || '') === id))
        .map((c) => {
          const start = new Date(String(c?.تاريخ_البداية || ''));
          const end = new Date(String(c?.تاريخ_النهاية || ''));
          const isActive = isTenancyRelevant(c) && start <= now && end >= now;
          const isTenant = String(c?.رقم_المستاجر) === id;
          const endTime = Number.isFinite(end.getTime()) ? end.getTime() : 0;
          const startTime = Number.isFinite(start.getTime()) ? start.getTime() : 0;
          return { c, isActive, isTenant, endTime, startTime };
        });

      if (candidates.length === 0) return undefined;

      candidates.sort((a, b) => {
        if (a.isActive !== b.isActive) return a.isActive ? -1 : 1;
        if (a.isTenant !== b.isTenant) return a.isTenant ? -1 : 1;
        // Prefer the contract that ends sooner (for follow-up/renewal), then latest start.
        if (a.endTime !== b.endTime) return a.endTime - b.endTime;
        return b.startTime - a.startTime;
      });

      return candidates[0]?.c;
    },
    [contracts]
  );

  const pickBestContractForProperty = useCallback(
    (propertyId?: string) => {
      const id = String(propertyId || '').trim();
      if (!id) return undefined;

      const now = new Date();
      const candidates = contracts
        .filter((c) => !c?.isArchived && String(c?.رقم_العقار) === id)
        .map((c) => {
          const start = new Date(String(c?.تاريخ_البداية || ''));
          const end = new Date(String(c?.تاريخ_النهاية || ''));
          const isActive = isTenancyRelevant(c) && start <= now && end >= now;
          const endTime = Number.isFinite(end.getTime()) ? end.getTime() : 0;
          const startTime = Number.isFinite(start.getTime()) ? start.getTime() : 0;
          return { c, isActive, endTime, startTime };
        });

      if (candidates.length === 0) return undefined;

      // Prefer active tenancy contracts, then most recent end date.
      candidates.sort((a, b) => {
        if (a.isActive !== b.isActive) return a.isActive ? -1 : 1;
        if (a.endTime !== b.endTime) return b.endTime - a.endTime;
        return b.startTime - a.startTime;
      });

      return candidates[0]?.c;
    },
    [contracts]
  );

  const sortedTasks = useMemo(() => {
    return [...tasks].sort((a, b) => {
      // Pending first
      if (a.status !== b.status) return a.status === 'pending' ? -1 : 1;

      // Then by due date
      if (a.dueDate !== b.dueDate) return a.dueDate.localeCompare(b.dueDate);

      // Then by time within the day
      const am = toMinutes(a.dueTime);
      const bm = toMinutes(b.dueTime);
      const av = am === null ? Number.POSITIVE_INFINITY : am;
      const bv = bm === null ? Number.POSITIVE_INFINITY : bm;
      if (av !== bv) return av - bv;

      return String(a.title || '').localeCompare(String(b.title || ''));
    });
  }, [tasks]);

  const loadTasks = useCallback(() => {
    try {
      // One-time migration from legacy localStorage tasks into DbService follow-ups
      const legacy = localStorage.getItem('dashboard_tasks');
      if (legacy) {
        try {
          const parsed = JSON.parse(legacy) as unknown;
          const items = Array.isArray(parsed) ? parsed : [];
          const today = new Date();
          const addDays = (n: number) => new Date(today.getFullYear(), today.getMonth(), today.getDate() + n);

          items.forEach((raw) => {
            const t = isRecord(raw) ? raw : {};
            const rawDue = String(t.dueDate ?? '');
            const mappedDate =
              /^\d{4}-\d{2}-\d{2}$/.test(rawDue) ? rawDue :
              rawDue === 'اليوم' ? formatDateYMD(today) :
              rawDue === 'غدا' ? formatDateYMD(addDays(1)) :
              rawDue === 'بعد يومين' ? formatDateYMD(addDays(2)) :
              rawDue === 'هذا الأسبوع' ? formatDateYMD(addDays(7)) :
              rawDue === 'الأسبوع القادم' ? formatDateYMD(addDays(14)) :
              formatDateYMD(today);

            const priority = String(t.priority ?? 'متوسطة');
            const priorityKey: FollowUpTask['priority'] = priority === 'عالية' ? 'High' : priority === 'منخفضة' ? 'Low' : 'Medium';

            const id = DbService.addFollowUp({
              task: String(t.title ?? '').trim() || 'مهمة',
              type: 'Task',
              dueDate: mappedDate,
              priority: priorityKey,
              category: String(t.category ?? 'عام'),
              note: String(t.description ?? ''),
            });

            if (String(t.status) === 'completed') {
              DbService.updateFollowUp(id, { status: 'Done' });
            }
          });
        } catch {
          // ignore legacy parse errors
        }
        try {
          void storage.removeItem('dashboard_tasks');
        } catch {
          // ignore
        }
        localStorage.removeItem('dashboard_tasks');
      }

      const all = dataRef.current.followUps || [];
      const mapped: Task[] = all.map((f) => {
        const pr = String(f.priority || 'Medium');
        const priority: Task['priority'] = pr === 'High' ? 'عالية' : pr === 'Low' ? 'منخفضة' : 'متوسطة';
        const status: Task['status'] = String(f.status) === 'Done' ? 'completed' : 'pending';
        const category = String(f.category || (f.type === 'Task' ? 'عام' : f.type || 'عام'));
        const description = String(f.note || '').trim() || undefined;

        return {
          id: String(f.id),
          title: String(f.task || ''),
          dueDate: String(f.dueDate || ''),
          dueTime: String(f.dueTime || '').trim() || undefined,
          priority,
          status,
          category,
          description,
          personId: String(f.personId || '').trim() || undefined,
          contractId: String(f.contractId || '').trim() || undefined,
          propertyId: String(f.propertyId || '').trim() || undefined,
          clientName: String(f.clientName || '').trim() || undefined,
          phone: String(f.phone || '').trim() || undefined,
        };
      });
      setTasks(mapped);
    } catch (error) {
      console.error('Error loading tasks:', error);
      setTasks([]);
    }
  }, []);

  // Load tasks from database
  useEffect(() => {
    loadTasks();
  }, [loadTasks]);

  // Live refresh when tasks/reminders change elsewhere (daily panel, banner)
  useEffect(() => {
    const handler = () => loadTasks();
    window.addEventListener('azrar:tasks-changed', handler);
    return () => window.removeEventListener('azrar:tasks-changed', handler);
  }, [loadTasks]);

  const handleAddTask = () => {
    if (!newTask.title?.trim()) {
      toast.warning('يرجى إدخال عنوان المهمة');
      return;
    }

    const pr = String(newTask.priority || 'متوسطة');
    const priorityKey: FollowUpTask['priority'] = pr === 'عالية' ? 'High' : pr === 'منخفضة' ? 'Low' : 'Medium';

    const selectedContractId = String(newTask.contractId || '').trim() || undefined;
    const selectedPropertyId = String(newTask.propertyId || '').trim() || undefined;

    const selectedPersonId = String(newTask.personId || '').trim() || undefined;
    const personInfo = resolvePersonInfo(selectedPersonId);

    DbService.addFollowUp({
      task: newTask.title,
      type: 'Task',
      dueDate: newTask.dueDate || formatDateYMD(new Date()),
      dueTime: String(newTask.dueTime || '').trim() || undefined,
      priority: priorityKey,
      category: newTask.category || 'عام',
      note: newTask.description || '',
      personId: selectedPersonId,
      contractId: selectedContractId,
      propertyId: selectedPropertyId,
      clientName: personInfo.clientName,
      phone: personInfo.phone,
    });

    loadTasks();
    setNewTask({ title: '', dueDate: formatDateYMD(new Date()), dueTime: '', priority: 'متوسطة', status: 'pending', category: 'عام', description: '', personId: '', contractId: '', propertyId: '', clientName: '', phone: '' });
    setShowAddModal(false);
  };

  const handleUpdateTask = () => {
    if (!editingTask || !editingTask.title?.trim()) {
      toast.warning('يرجى إدخال عنوان المهمة');
      return;
    }

    const pr = String(editingTask.priority || 'متوسطة');
    const priorityKey: FollowUpTask['priority'] = pr === 'عالية' ? 'High' : pr === 'منخفضة' ? 'Low' : 'Medium';
    const selectedContractId = String(editingTask.contractId || '').trim() || undefined;
    const selectedPropertyId = String(editingTask.propertyId || '').trim() || undefined;

    const selectedPersonId = String(editingTask.personId || '').trim() || undefined;
    const personInfo = resolvePersonInfo(selectedPersonId);

    DbService.updateFollowUp(editingTask.id, {
      task: editingTask.title,
      dueDate: editingTask.dueDate,
      dueTime: String(editingTask.dueTime || '').trim() || undefined,
      priority: priorityKey,
      category: editingTask.category,
      note: editingTask.description || '',
      status: editingTask.status === 'completed' ? 'Done' : 'Pending',
      personId: selectedPersonId,
      contractId: selectedContractId,
      propertyId: selectedPropertyId,
      clientName: personInfo.clientName,
      phone: personInfo.phone,
    });
    loadTasks();
    setEditingTask(null);
  };

  const handleToggleTask = (id: string) => {
    const target = tasks.find(t => t.id === id);
    if (!target) return;
    if (target.status === 'pending') {
      DbService.completeFollowUp(id);
    } else {
      DbService.updateFollowUp(id, { status: 'Pending' });
    }
    loadTasks();
  };

  const handleDeleteTask = async (id: string) => {
    const ok = await toast.confirm({
      title: 'تأكيد الحذف',
      message: 'هل تريد حذف هذه المهمة؟',
      confirmText: 'حذف',
      cancelText: 'إلغاء',
    });
    if (!ok) return;
    DbService.deleteFollowUp(id);
    loadTasks();
  };

  // Mini calendar for current month
  const getDaysInMonth = (date: Date) => {
    return new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
  };

  const getFirstDayOfMonth = (date: Date) => {
    return new Date(date.getFullYear(), date.getMonth(), 1).getDay();
  };

  const daysInMonth = getDaysInMonth(selectedDate);
  const firstDay = getFirstDayOfMonth(selectedDate);
  // ✅ Important dates from real data
  const getImportantDates = () => {
    try {
      const highlights = _data.desktopHighlights;

      const contracts = _data.contracts;
      const followUps = _data.followUps;
      const installments = _data.installments;
      const properties = _data.properties;
      const people = _data.people;

      const dates: { date: string; events: string[] }[] = [];
      const today = new Date();
      const tomorrow = new Date(today.getTime() + 24 * 60 * 60 * 1000);

      // Today's events
      const todayEvents: string[] = [];

      // Follow-ups today
      const todayStr = formatDateYMD(today);
      const todayFollowUps = followUps.filter((f) => String(f?.dueDate) === todayStr && String(f?.status) !== 'Done');
      todayFollowUps.forEach((f) => {
        const name = String(f?.clientName || '').trim();
        todayEvents.push(name ? `مهمة: ${f.task} • ${name}` : `مهمة: ${f.task}`);
      });

      // Installments due today
      const desktopDue = highlights?.dueInstallmentsToday ?? [];
      if (desktopDue.length > 0) {
        desktopDue.slice(0, 5).forEach((r) => {
          const tenantName = String(r?.tenantName || '').trim() || 'مستأجر';
          todayEvents.push(`موعد دفع - ${tenantName}`);
        });
      } else {
        const todayInstallments = installments.filter((i) => {
          const dueDate = i.تاريخ_استحقاق?.split('T')[0];
          const todayStr = today.toISOString().split('T')[0];
          return dueDate === todayStr && i.حالة_الكمبيالة !== 'مدفوع';
        });

        todayInstallments.forEach((i) => {
          const contract = contracts.find((c) => c.رقم_العقد === i.رقم_العقد);
          const tenant = contract ? people.find((p) => p.رقم_الشخص === contract.رقم_المستاجر) : null;
          todayEvents.push(`موعد دفع - ${tenant?.الاسم || 'مستأجر'}`);
        });
      }

      if (todayEvents.length > 0) {
        dates.push({ date: 'اليوم', events: todayEvents.slice(0, 3) });
      }

      // Tomorrow's events
      const tomorrowEvents: string[] = [];
      const tomorrowFollowUps = followUps.filter((f) => {
        const tomorrowStr = formatDateYMD(tomorrow);
        return String(f?.dueDate) === tomorrowStr && String(f?.status) !== 'Done';
      });

      tomorrowFollowUps.forEach((f) => {
        const name = String(f?.clientName || '').trim();
        tomorrowEvents.push(name ? `مهمة: ${f.task} • ${name}` : `مهمة: ${f.task}`);
      });

      if (tomorrowEvents.length > 0) {
        dates.push({ date: 'غدا', events: tomorrowEvents.slice(0, 2) });
      }

      // Contracts expiring soon
      const desktopExpiring = highlights?.expiringContracts ?? [];
      if (desktopExpiring.length > 0) {
        desktopExpiring.slice(0, 2).forEach((r) => {
          const endIso = String(r?.endDate || '').trim();
          const endDate = new Date(endIso);
          const dateStr = Number.isFinite(endDate.getTime()) ? formatDateYMD(endDate) : endIso || '—';
          const propertyCode = String(r?.propertyCode || '').trim() || 'عقار';

          const existingDate = dates.find((d) => d.date === dateStr);
          if (existingDate) {
            existingDate.events.push(`تجديد عقد - ${propertyCode}`);
          } else {
            dates.push({ date: dateStr, events: [`تجديد عقد - ${propertyCode}`] });
          }
        });
      } else {
        const expiringContracts = contracts.filter((c) => {
          const endDate = new Date(c.تاريخ_النهاية);
          const daysUntilExpiry = Math.ceil((endDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
          return isTenancyRelevant(c) && daysUntilExpiry > 0 && daysUntilExpiry <= 30;
        });

        expiringContracts.slice(0, 2).forEach((contract) => {
          const property = properties.find((p) => p.رقم_العقار === contract.رقم_العقار);
          const endDate = new Date(contract.تاريخ_النهاية);
          const dateStr = formatDateYMD(endDate);

          const existingDate = dates.find((d) => d.date === dateStr);
          if (existingDate) {
            existingDate.events.push(`تجديد عقد - ${property?.الكود_الداخلي || 'عقار'}`);
          } else {
            dates.push({ date: dateStr, events: [`تجديد عقد - ${property?.الكود_الداخلي || 'عقار'}`] });
          }
        });
      }

      return dates;
    } catch (error) {
      console.error('Error loading important dates:', error);
      return [{ date: 'اليوم', events: ['خطأ في تحميل الأحداث'] }];
    }
  };

  const importantDates = getImportantDates();
  const weeklyEventsCount = importantDates.reduce((sum, d) => sum + d.events.length, 0);
  const expiringSoonCount = (() => {
    try {
      const desktopExpiring = _data.desktopHighlights?.expiringContracts ?? [];
      if (desktopExpiring.length > 0) return desktopExpiring.length;
      const today = new Date();
      return (contracts || []).filter((c) => {
        const endDate = new Date(c.تاريخ_النهاية);
        const daysUntilExpiry = Math.ceil((endDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
        return isTenancyRelevant(c) && daysUntilExpiry > 0 && daysUntilExpiry <= 30;
      }).length;
    } catch {
      return 0;
    }
  })();

  return (
    <div className="space-y-6">
      {/* Key Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-gradient-to-br from-orange-500 to-orange-600 text-white p-6 rounded-2xl shadow-lg hover:shadow-xl transition group">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm font-medium opacity-90">المهام المعلقة</p>
              <p className="text-3xl font-bold mt-2">{formatNumber(tasks.filter(t => t.status === 'pending').length)}</p>
              <p className="text-sm opacity-75 mt-2">تحتاج الاهتمام</p>
            </div>
            <AlertCircle className="w-12 h-12 opacity-20 group-hover:opacity-30 transition" />
          </div>
        </div>

        <div className="bg-gradient-to-br from-indigo-500 to-indigo-600 text-white p-6 rounded-2xl shadow-lg hover:shadow-xl transition group">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm font-medium opacity-90">الأحداث هذا الأسبوع</p>
              <p className="text-3xl font-bold mt-2">{formatNumber(weeklyEventsCount)}</p>
              <p className="text-sm opacity-75 mt-2">أحداث مهمة</p>
            </div>
            <Calendar className="w-12 h-12 opacity-20 group-hover:opacity-30 transition" />
          </div>
        </div>

        <div className="bg-gradient-to-br from-green-500 to-green-600 text-white p-6 rounded-2xl shadow-lg hover:shadow-xl transition group">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm font-medium opacity-90">عقود منتهية قريبا</p>
              <p className="text-3xl font-bold mt-2">{formatNumber(expiringSoonCount)}</p>
              <p className="text-sm opacity-75 mt-2">تجديد مطلوب</p>
            </div>
            <FileText className="w-12 h-12 opacity-20 group-hover:opacity-30 transition" />
          </div>
        </div>
      </div>

      {/* Mini Calendar and Important Dates */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Mini Calendar */}
        <div className="app-card p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-bold text-slate-700 dark:text-slate-300">
              {formatMonthYear(selectedDate)}
            </h3>
            <div className="flex gap-2">
              <button
                className="p-1 hover:bg-gray-200 dark:hover:bg-slate-700 rounded"
                onClick={() => setSelectedDate(new Date(selectedDate.getFullYear(), selectedDate.getMonth() - 1, 1))}
                title="الشهر السابق"
              >
                ←
              </button>
              <button
                className="p-1 hover:bg-gray-200 dark:hover:bg-slate-700 rounded"
                onClick={() => setSelectedDate(new Date(selectedDate.getFullYear(), selectedDate.getMonth() + 1, 1))}
                title="الشهر التالي"
              >
                →
              </button>
            </div>
          </div>

          <div className="grid grid-cols-7 gap-2 text-center text-xs mb-2">
            {['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'].map(day => (
              <div key={day} className="font-bold text-slate-600 dark:text-slate-400 py-1">
                {day.slice(0, 2)}
              </div>
            ))}
          </div>

          <div className="grid grid-cols-7 gap-2">
            {Array.from({ length: firstDay }).map((_, i) => (
              <div key={`empty-${i}`} className="p-2 text-center"></div>
            ))}
            {Array.from({ length: daysInMonth }).map((_, i) => {
              const day = i + 1;
              const isToday = day === new Date().getDate() && selectedDate.getMonth() === new Date().getMonth();
              const dateObj = new Date(selectedDate.getFullYear(), selectedDate.getMonth(), day);
              const ymd = formatDateYMD(dateObj);
              return (
                <button
                  key={day}
                  onClick={() => {
                    setSelectedDate(dateObj);
                    openPanel('CALENDAR_EVENTS', ymd, { title: `أحداث يوم ${ymd}` });
                  }}
                  className={`p-2 rounded-lg text-sm font-medium transition ${
                    isToday
                      ? 'bg-indigo-500 text-white'
                      : 'hover:bg-gray-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300'
                  }`}
                >
                  {formatNumber(day)}
                </button>
              );
            })}
          </div>
        </div>

        {/* Important Dates */}
        <div className="lg:col-span-2 app-card p-6">
          <h3 className="font-bold text-slate-700 dark:text-slate-300 mb-4 flex items-center gap-2">
            <Calendar className="text-indigo-500" />
            التواريخ المهمة
          </h3>
          <div className="space-y-3">
            {importantDates.map((item, index) => (
              <div
                key={index}
                className="p-4 bg-gradient-to-r from-indigo-50 to-purple-50 dark:from-slate-700 dark:to-slate-600 rounded-lg border border-indigo-100 dark:border-slate-600"
              >
                <div className="flex items-start gap-3">
                  <div className="w-2 h-2 rounded-full bg-indigo-500 mt-1.5 flex-shrink-0"></div>
                  <div className="flex-1">
                    <p className="font-bold text-slate-900 dark:text-white">{item.date}</p>
                    <ul className="mt-1 space-y-1">
                      {item.events.map((event, idx) => (
                        <li key={idx}>
                          <button
                            type="button"
                            onClick={() => openPanel('GENERIC_ALERT', undefined, {
                              alert: {
                                level: 'info',
                                title: 'حدث مهم',
                                description: event,
                                timestamp: item.date,
                              }
                            })}
                            className="w-full text-right text-sm text-slate-600 dark:text-slate-300 hover:underline"
                          >
                            • {event}
                          </button>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Tasks by Priority */}
      <div className="app-card p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-bold text-slate-700 dark:text-slate-300 flex items-center gap-2">
            <Zap className="text-yellow-500" />
            قائمة المهام
          </h3>
          <button
            onClick={() => setShowAddModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-bold transition shadow"
          >
            <Plus size={18} />
            مهمة جديدة
          </button>
        </div>

        {tasks.length === 0 ? (
          <div className="text-center py-8">
            <AlertCircle className="w-12 h-12 text-gray-400 mx-auto mb-2" />
            <p className="text-slate-600 dark:text-slate-400">لا توجد مهام</p>
          </div>
        ) : (
          <div className="space-y-2">
            {sortedTasks.map((task) => {
              const now = new Date();
              const nowMinutes = now.getHours() * 60 + now.getMinutes();
              const taskMinutes = toMinutes(task.dueTime);
              const isOverdueNow = task.status === 'pending' && task.dueDate === todayStr && taskMinutes !== null && nowMinutes >= taskMinutes;

              return (
              <div
                key={task.id}
                className={`flex items-start gap-3 p-4 rounded-lg border transition ${
                  task.status === 'completed'
                    ? 'bg-green-50 dark:bg-green-950 border-green-200 dark:border-green-800 opacity-60'
                    : task.priority === 'عالية'
                    ? 'bg-red-50 dark:bg-red-950 border-red-200 dark:border-red-800'
                    : task.priority === 'متوسطة'
                    ? 'bg-orange-50 dark:bg-orange-950 border-orange-200 dark:border-orange-800'
                    : 'bg-green-50 dark:bg-green-950 border-green-200 dark:border-green-800'
                }`}
              >
                <button
                  onClick={() => handleToggleTask(task.id)}
                  className="mt-1 p-1 hover:bg-white dark:hover:bg-slate-700 rounded transition flex-shrink-0"
                  title={task.status === 'completed' ? 'تحويل إلى معلقة' : 'تحديد كمكتملة'}
                >
                  <CheckCircle
                    size={18}
                    className={task.status === 'completed' ? 'text-green-500 fill-green-500' : 'text-gray-400'}
                  />
                </button>

                <div className="flex-1">
                  <p className={`font-medium ${task.status === 'completed' ? 'line-through text-slate-500' : 'text-slate-900 dark:text-white'}`}>
                    {task.title}
                  </p>
                  {task.description && (
                    <p className="text-xs text-slate-600 dark:text-slate-400 mt-1">{task.description}</p>
                  )}

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
                    const contractStart = contract?.تاريخ_البداية ? formatDateYMD(contract.تاريخ_البداية) : '';
                    const contractEnd = contract?.تاريخ_النهاية ? formatDateYMD(contract.تاريخ_النهاية) : '';
                    const contractRange = contractStart && contractEnd ? `${contractStart} → ${contractEnd}` : '';

                    const ownedProperties = personId
                      ? properties.filter((p) => String(p?.رقم_المالك || '').trim() === personId)
                      : [];
                    const ownedSummary = ownedProperties.length
                      ? ownedProperties
                          .slice()
                          .sort((a, b) => String(a?.الكود_الداخلي || '').localeCompare(String(b?.الكود_الداخلي || '')))
                          .slice(0, 3)
                          .map((p) => String(p?.الكود_الداخلي || p?.رقم_العقار || '').trim())
                          .filter(Boolean)
                      : [];

                    return (
                      <div className="text-xs text-slate-600 dark:text-slate-400 mt-1 flex flex-wrap gap-x-3 gap-y-1">
                        {personName ? <span>الشخص: {personName}</span> : null}
                        {phone ? <span dir="ltr">{phone}</span> : null}
                        {contractId ? <span dir="ltr">العقد: {contractId}</span> : null}
                        {propertyCode ? <span>العقار: {propertyCode}</span> : derivedPropertyId ? <span dir="ltr">العقار: {derivedPropertyId}</span> : null}
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

                  <div className="flex items-center gap-2 mt-2 flex-wrap">
                    <span className="text-xs bg-indigo-200 dark:bg-indigo-900 text-indigo-800 dark:text-indigo-200 px-2 py-1 rounded">
                      {task.category}
                    </span>
                    <span className={`text-xs px-2 py-1 rounded font-medium ${
                      task.priority === 'عالية'
                        ? 'bg-red-200 dark:bg-red-900 text-red-800 dark:text-red-200'
                        : task.priority === 'متوسطة'
                        ? 'bg-orange-200 dark:bg-orange-900 text-orange-800 dark:text-orange-200'
                        : 'bg-green-200 dark:bg-green-900 text-green-800 dark:text-green-200'
                    }`}>
                      {task.priority}
                    </span>
                    <span className="text-xs text-slate-600 dark:text-slate-400 flex items-center gap-1">
                      <Clock size={12} />
                      <span dir="ltr">
                        {task.dueDate}
                        {task.dueTime ? ` • ${formatTimeFromHM(task.dueTime, { locale: 'en-US', hour12: true })}` : ''}
                      </span>
                    </span>

                    {isOverdueNow && (
                      <span className="text-xs bg-red-200 dark:bg-red-900 text-red-800 dark:text-red-200 px-2 py-1 rounded font-bold">
                        متأخرة الآن
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex gap-2 flex-shrink-0">
                  <button
                    onClick={() => setEditingTask(task)}
                    className="p-2 hover:bg-gray-200 dark:hover:bg-slate-700 rounded transition"
                    title="تعديل المهمة"
                  >
                    <Edit2 size={16} className="text-indigo-500" />
                  </button>
                  <button
                    onClick={() => handleDeleteTask(task.id)}
                    className="p-2 hover:bg-gray-200 dark:hover:bg-slate-700 rounded transition"
                    title="حذف المهمة"
                  >
                    <Trash2 size={16} className="text-red-500" />
                  </button>
                </div>
              </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Contract Renewal Schedule */}
      <div className="app-card p-6">
        <h3 className="font-bold text-slate-700 dark:text-slate-300 mb-4 flex items-center gap-2">
          <FileText className="text-green-500" />
          جدول تجديد العقود
        </h3>
        {expiringContracts.length === 0 ? (
          <div className="text-center py-8 text-slate-500 dark:text-slate-400">لا توجد عقود للتجديد خلال 90 يوم</div>
        ) : (
          <div className="space-y-2">
            {expiringContracts.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() =>
                  openPanel('GENERIC_ALERT', undefined, {
                    alert: {
                      level: 'info',
                      title: 'تجديد عقد',
                      description: `العقار ${item.propertyCode} • المستأجر: ${item.tenantName}`,
                      timestamp: formatDateYMD(item.endDate),
                    },
                  })
                }
                className="w-full text-right flex items-center justify-between gap-3 p-4 bg-gray-50 dark:bg-slate-700 rounded-lg border border-gray-200 dark:border-slate-600 hover:bg-gray-100 dark:hover:bg-slate-600 transition"
              >
                <div>
                  <div className="font-bold text-slate-900 dark:text-white">{item.propertyCode}</div>
                  <div className="text-sm text-slate-600 dark:text-slate-300">{item.tenantName}</div>
                </div>
                <div className="text-left">
                  <div className="text-sm font-bold text-slate-700 dark:text-slate-200">{formatDateYMD(item.endDate)}</div>
                  <div className="text-xs text-slate-500 dark:text-slate-400">بعد {formatNumber(item.daysUntil)} يوم</div>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Add/Edit Task Modal */}
      {(showAddModal || editingTask) && (
        <div className="modal-overlay app-modal-overlay bg-black/50">
          <div className="modal-content app-modal-content max-w-md w-full max-h-[90vh] overflow-y-auto">
            {/* Header */}
            <div className="sticky top-0 bg-gradient-to-r from-indigo-500 to-indigo-600 text-white p-6 border-b border-indigo-400">
              <h2 className="text-xl font-bold">
                {editingTask ? 'تعديل المهمة' : 'مهمة جديدة'}
              </h2>
              <p className="text-indigo-100 text-sm mt-1">إضافة أو تعديل المهام بسهولة</p>
            </div>

            {/* Content */}
            <div className="p-6 space-y-4">
              {/* Title */}
              <div>
                <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">
                  عنوان المهمة *
                </label>
                <input
                  type="text"
                  value={editingTask ? editingTask.title : newTask.title}
                  onChange={(e) => {
                    if (editingTask) {
                      setEditingTask({ ...editingTask, title: e.target.value });
                    } else {
                      setNewTask({ ...newTask, title: e.target.value });
                    }
                  }}
                  placeholder="أدخل عنوان المهمة"
                  className="w-full px-4 py-2 border border-gray-200 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              {/* Description */}
              <div>
                <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">
                  الوصف
                </label>
                <textarea
                  value={editingTask ? editingTask.description || '' : newTask.description || ''}
                  onChange={(e) => {
                    if (editingTask) {
                      setEditingTask({ ...editingTask, description: e.target.value });
                    } else {
                      setNewTask({ ...newTask, description: e.target.value });
                    }
                  }}
                  placeholder="أدخل وصف المهمة"
                  className="w-full px-4 py-2 border border-gray-200 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 h-20 resize-none"
                />
              </div>

              {/* Category */}
              <div>
                <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">
                  الفئة
                </label>
                <select
                  value={editingTask ? editingTask.category : newTask.category}
                  onChange={(e) => {
                    if (editingTask) {
                      setEditingTask({ ...editingTask, category: e.target.value });
                    } else {
                      setNewTask({ ...newTask, category: e.target.value });
                    }
                  }}
                  className="w-full px-4 py-2 border border-gray-200 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="عام">عام</option>
                  <option value="عقود">عقود</option>
                  <option value="عقارات">عقارات</option>
                  <option value="دفعات">دفعات</option>
                  <option value="تقارير">تقارير</option>
                  <option value="اجتماعات">اجتماعات</option>
                  <option value="متابعة">متابعة</option>
                </select>
              </div>

              {/* Person (primary) */}
              <div>
                <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">
                  الشخص (أساس المتابعة)
                </label>
                <select
                  value={editingTask ? (editingTask.personId || '') : (String(newTask.personId || ''))}
                  onChange={(e) => {
                    const personId = String(e.target.value || '').trim();
                    const best = pickBestContractForPerson(personId);
                    const contractId = String(best?.رقم_العقد || '').trim();
                    const propertyId = String(best?.رقم_العقار || '').trim();

                    if (editingTask) {
                      setEditingTask({
                        ...editingTask,
                        personId: personId || undefined,
                        contractId: contractId || undefined,
                        propertyId: propertyId || undefined,
                      });
                    } else {
                      setNewTask({
                        ...newTask,
                        personId: personId || undefined,
                        contractId: contractId || undefined,
                        propertyId: propertyId || undefined,
                      });
                    }
                  }}
                  className="w-full px-4 py-2 border border-gray-200 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="">— اختر شخص —</option>
                  {people
                    .slice()
                    .sort((a, b) => String(a?.الاسم || '').localeCompare(String(b?.الاسم || '')))
                    .map((p) => {
                      const id = String(p?.رقم_الشخص || '').trim();
                      if (!id) return null;
                      const name = String(p?.الاسم || '').trim() || id;
                      const phone = String(p?.رقم_الهاتف || '').trim();
                      const label = phone ? `${name} • ${phone}` : name;
                      return (
                        <option key={id} value={id}>
                          {label}
                        </option>
                      );
                    })}
                </select>
              </div>

              {/* Contract */}
              <div>
                <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">
                  العقد (اختياري)
                </label>
                <select
                  value={editingTask ? (editingTask.contractId || '') : (String(newTask.contractId || ''))}
                  onChange={(e) => {
                    const contractId = String(e.target.value || '').trim();
                    const contract = contractId ? contractsById.get(contractId) : undefined;
                    const propertyId = String(contract?.رقم_العقار || '').trim();

                    if (editingTask) {
                      setEditingTask({
                        ...editingTask,
                        contractId: contractId || undefined,
                        propertyId: propertyId || undefined,
                      });
                    } else {
                      setNewTask({
                        ...newTask,
                        contractId: contractId || undefined,
                        propertyId: propertyId || undefined,
                      });
                    }
                  }}
                  className="w-full px-4 py-2 border border-gray-200 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="">— بدون —</option>
                  {(() => {
                    const currentPersonId = String(editingTask ? editingTask.personId : newTask.personId || '').trim();
                    const list = currentPersonId
                      ? contracts.filter((c) => String(c?.رقم_المستاجر) === currentPersonId || String(c?.رقم_الكفيل || '') === currentPersonId)
                      : contracts;

                    return list
                      .slice()
                      .sort((a, b) => String(a?.رقم_العقد || '').localeCompare(String(b?.رقم_العقد || '')))
                      .map((c) => {
                        const id = String(c?.رقم_العقد || '').trim();
                        if (!id) return null;
                        const property = propertiesById.get(String(c?.رقم_العقار || '').trim());
                        const propertyCode = String(property?.الكود_الداخلي || '').trim();
                        const label = propertyCode ? `${id} • ${propertyCode}` : id;
                        return (
                          <option key={id} value={id}>
                            {label}
                          </option>
                        );
                      });
                  })()}
                </select>
              </div>

              {/* Property */}
              <div>
                <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">
                  العقار
                </label>
                <select
                  value={editingTask ? (editingTask.propertyId || '') : (String(newTask.propertyId || ''))}
                  onChange={(e) => {
                    const propertyId = String(e.target.value || '').trim();
                    const best = pickBestContractForProperty(propertyId);
                    const contractId = String(best?.رقم_العقد || '').trim();

                    if (editingTask) {
                      setEditingTask({
                        ...editingTask,
                        propertyId: propertyId || undefined,
                        contractId: contractId || undefined,
                      });
                    } else {
                      setNewTask({
                        ...newTask,
                        propertyId: propertyId || undefined,
                        contractId: contractId || undefined,
                      });
                    }
                  }}
                  className="w-full px-4 py-2 border border-gray-200 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-60"
                >
                  <option value="">— بدون —</option>
                  {(() => {
                    const currentContractId = String(editingTask ? editingTask.contractId : newTask.contractId || '').trim();
                    if (currentContractId) {
                      const contract = contractsById.get(currentContractId);
                      const pid = String(contract?.رقم_العقار || '').trim();
                      const property = pid ? propertiesById.get(pid) : undefined;
                      const code = String(property?.الكود_الداخلي || '').trim();
                      const label = code ? `${code} • ${pid}` : pid;
                      return pid ? (
                        <option key={pid} value={pid}>
                          {label}
                        </option>
                      ) : null;
                    }

                    const currentPersonId = String(editingTask ? editingTask.personId : newTask.personId || '').trim();
                    const list = currentPersonId
                      ? properties.filter((p) => String(p?.رقم_المالك || '').trim() === currentPersonId)
                      : properties;

                    return list
                      .slice()
                      .sort((a, b) => String(a?.الكود_الداخلي || '').localeCompare(String(b?.الكود_الداخلي || '')))
                      .map((p) => {
                        const pid = String(p?.رقم_العقار || '').trim();
                        if (!pid) return null;
                        const code = String(p?.الكود_الداخلي || '').trim();
                        const label = code ? `${code} • ${pid}` : pid;
                        return (
                          <option key={pid} value={pid}>
                            {label}
                          </option>
                        );
                      });
                  })()}
                </select>
                {!!String(editingTask ? editingTask.contractId : newTask.contractId || '').trim() && (
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                    يتم تعبئة العقار تلقائياً من العقد عند اختيار العقد.
                  </p>
                )}
              </div>

              {/* Priority */}
              <div>
                <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">
                  الأولوية
                </label>
                <select
                  value={editingTask ? editingTask.priority : newTask.priority}
                  onChange={(e) => {
                    if (editingTask) {
                      setEditingTask({ ...editingTask, priority: e.target.value as Task['priority'] });
                    } else {
                      setNewTask({ ...newTask, priority: e.target.value as Task['priority'] });
                    }
                  }}
                  className="w-full px-4 py-2 border border-gray-200 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="منخفضة">منخفضة</option>
                  <option value="متوسطة">متوسطة</option>
                  <option value="عالية">عالية</option>
                </select>
              </div>

              {/* Due Date */}
              <div>
                <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">
                  تاريخ الاستحقاق
                </label>
                <input
                  type="date"
                  value={editingTask ? editingTask.dueDate : (newTask.dueDate || '')}
                  onChange={(e) => {
                    if (editingTask) {
                      setEditingTask({ ...editingTask, dueDate: e.target.value });
                    } else {
                      setNewTask({ ...newTask, dueDate: e.target.value });
                    }
                  }}
                  className="w-full px-4 py-2 border border-gray-200 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              {/* Due Time */}
              <div>
                <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">
                  وقت الاستحقاق (اختياري)
                </label>
                <input
                  type="time"
                  value={editingTask ? (editingTask.dueTime || '') : (String(newTask.dueTime || ''))}
                  onChange={(e) => {
                    if (editingTask) {
                      setEditingTask({ ...editingTask, dueTime: e.target.value });
                    } else {
                      setNewTask({ ...newTask, dueTime: e.target.value });
                    }
                  }}
                  className="w-full px-4 py-2 border border-gray-200 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
            </div>

            {/* Footer */}
            <div className="sticky bottom-0 bg-gray-50 dark:bg-slate-700 p-4 border-t border-gray-200 dark:border-slate-600 flex gap-3">
              <button
                onClick={() => {
                  if (editingTask) {
                    handleUpdateTask();
                  } else {
                    handleAddTask();
                  }
                }}
                className="flex-1 px-4 py-2 bg-indigo-500 hover:bg-indigo-600 text-white rounded-lg font-bold transition"
              >
                {editingTask ? 'تحديث' : 'إضافة'}
              </button>
              <button
                onClick={() => {
                  setShowAddModal(false);
                  setEditingTask(null);
                  setNewTask({ title: '', dueDate: formatDateYMD(new Date()), dueTime: '', priority: 'متوسطة', status: 'pending', category: 'عام', description: '', personId: '', contractId: '', propertyId: '', clientName: '', phone: '' });
                }}
                className="flex-1 px-4 py-2 bg-gray-200 dark:bg-slate-600 text-gray-700 dark:text-slate-200 rounded-lg font-bold hover:bg-gray-300 dark:hover:bg-slate-500 transition"
              >
                إلغاء
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
