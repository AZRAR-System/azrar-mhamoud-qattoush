
import React, { useMemo, useState, useEffect, useCallback } from 'react';
import { DbService } from '@/services/mockDb';
import { storage } from '@/services/storage';
import { dashboardHighlightsSmart, domainGetSmart, domainSearchSmart, peoplePickerSearchPagedSmart } from '@/services/domainQueries';
import { Calendar, Clock, DollarSign, FileText, User, Plus, CheckCircle2, StickyNote, CornerDownRight } from 'lucide-react';
import { useAppDialogs } from '@/hooks/useAppDialogs';
import { formatTimeFromHM } from '@/utils/format';
import { formatContractNumberShort } from '@/utils/contractNumber';
import { useSmartModal } from '@/context/ModalContext';
import { PersonPicker } from '@/components/shared/PersonPicker';
import { ContractPicker } from '@/components/shared/ContractPicker';
import { PropertyPicker } from '@/components/shared/PropertyPicker';
import type { FollowUpTask, SystemReminder } from '@/types';
import type { PeoplePickerItem } from '@/types/domain.types';

type CalendarEventType = 'Installment' | 'Contract' | 'Reminder' | 'FollowUp';

type CalendarEventBase = {
    type: CalendarEventType;
    time: string;
    title: string;
    details?: string;
    status: string;
};

type FollowUpEvent = CalendarEventBase & { type: 'FollowUp'; _raw: FollowUpTask };
type ReminderEvent = CalendarEventBase & { type: 'Reminder'; _raw: SystemReminder };
type SimpleEvent = CalendarEventBase & { type: 'Installment' | 'Contract'; _raw?: unknown };
type CalendarEvent = FollowUpEvent | ReminderEvent | SimpleEvent;

const timeToMinutes = (hm: unknown): number | null => {
    const raw = String(hm || '').trim();
    if (!raw) return null;
    const m = raw.match(/^([01]\d|2[0-3]):([0-5]\d)$/);
    if (!m) return null;
    return Number(m[1]) * 60 + Number(m[2]);
};

const normalizePhone = (value: unknown): string => String(value ?? '').replace(/\s+/g, '').trim();

const isPriority = (value: string): value is 'Low' | 'Medium' | 'High' => value === 'Low' || value === 'Medium' || value === 'High';

interface CalendarEventsPanelProps {
  id: string; // The date string (YYYY-MM-DD)
  onClose: () => void;
}

export const CalendarEventsPanel: React.FC<CalendarEventsPanelProps> = ({ id }) => {
    const dialogs = useAppDialogs();
    const { openPanel } = useSmartModal();
    const [events, setEvents] = useState<CalendarEvent[]>([]);
    const [newTaskTitle, setNewTaskTitle] = useState('');
    const [newTaskClientName, setNewTaskClientName] = useState('');
    const [newTaskPhone, setNewTaskPhone] = useState('');
    const [newTaskDetails, setNewTaskDetails] = useState('');
    const [newTaskPriority, setNewTaskPriority] = useState<'Low' | 'Medium' | 'High'>('Medium');
        const [newTaskTime, setNewTaskTime] = useState('');

    const [linkPersonId, setLinkPersonId] = useState<string>('');
    const [linkContractId, setLinkContractId] = useState<string>('');
    const [linkPropertyId, setLinkPropertyId] = useState<string>('');
  const date = id;
            const isDesktop = typeof window !== 'undefined' && storage.isDesktop() && !!window.desktopDb;
            const isDesktopFast = isDesktop && !!window.desktopDb?.domainDashboardHighlights;
            const canDomainGet = isDesktop && !!window.desktopDb?.domainGet;
            const canPeoplePicker = isDesktop && !!window.desktopDb?.domainPeoplePickerSearch;
            const canDomainSearch = isDesktop && !!window.desktopDb?.domainSearch;

    const isToday = useMemo(() => {
        const now = new Date();
        const ymd = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
        return date === ymd;
    }, [date]);

        const reload = useCallback(async () => {
        const loadedEvents: CalendarEvent[] = [];

        // 1. Installments
            if (isDesktopFast) {
                    const hl = await dashboardHighlightsSmart({ todayYMD: date });
                    const due = Array.isArray(hl?.dueInstallmentsToday) ? hl.dueInstallmentsToday : [];
                    due.forEach((r) => {
                        loadedEvents.push({
                            type: 'Installment',
                            time: '09:00',
                            title: `دفعة مستحقة: ${Number(r?.remaining || 0)} د.أ`,
                            details: `عقد #${formatContractNumberShort(String(r?.contractId || ''))} • ${String(r?.tenantName || '').trim()}`,
                            status: 'Due',
                            _raw: r,
                        });
                    });

                    // 2. Contracts Expiring (filter to exact date)
                    const exp = Array.isArray(hl?.expiringContracts) ? hl.expiringContracts : [];
                    exp.filter((r) => String(r?.endDate || '').slice(0, 10) === date).forEach((r) => {
                        loadedEvents.push({
                            type: 'Contract',
                            time: '12:00',
                            title: `انتهاء عقد #${formatContractNumberShort(String(r?.contractId || ''))}`,
                            details: `يرجى مراجعة التجديد • ${String(r?.propertyCode || '').trim()}`,
                            status: 'Expiring',
                            _raw: r,
                        });
                    });
                } else if (!isDesktop) {
                    const installments = DbService.getInstallments().filter(i => i.تاريخ_استحقاق === date);
                    installments.forEach(i => loadedEvents.push({ type: 'Installment', time: '09:00', title: `دفعة مستحقة: ${i.القيمة} د.أ`, details: `عقد #${i.رقم_العقد}`, status: i.حالة_الكمبيالة }));

                    // 2. Contracts Expiring
                    const contracts = DbService.getContracts().filter(c => c.تاريخ_النهاية === date);
                    contracts.forEach(c => loadedEvents.push({ type: 'Contract', time: '12:00', title: `انتهاء عقد #${formatContractNumberShort(c.رقم_العقد)}`,
                        details: 'يرجى مراجعة التجديد', status: 'Expiring' }));
                }

        // 3. Reminders (includes Task reminders)
        const reminders = DbService.getReminders().filter(r => r.date === date);
    reminders.forEach(r => loadedEvents.push({ type: 'Reminder', time: r.time || '10:00', title: r.title, details: r.type, status: r.isDone ? 'Done' : 'Pending', _raw: r }));

        // 4. Follow Ups / Tasks
        const followUps = DbService.getAllFollowUps().filter(f => f.dueDate === date);
        // Desktop focus: never load full properties arrays in renderer.
        const properties = isDesktop ? [] : DbService.getProperties().slice();
        const propertyById = new Map<string, (typeof properties)[number]>(properties.map((p) => [String(p.رقم_العقار), p]));
        followUps.forEach(f => {
            const name = String(f.clientName || '').trim();
            const phone = String(f.phone || '').trim();
            const note = String(f.note || '').trim();

            const linkedContractId = String(f.contractId || '').trim();
            const contractLine = linkedContractId ? `عقد #${formatContractNumberShort(linkedContractId)}` : '';

            const linkedPropertyId = String(f.propertyId || '').trim();
            const linkedProperty = linkedPropertyId ? propertyById.get(linkedPropertyId) : undefined;
            const propertyCode = String(linkedProperty?.الكود_الداخلي || '').trim();
            const propertyLine = linkedPropertyId ? `عقار: ${propertyCode || linkedPropertyId}` : '';

            const parts = [name, phone].filter(Boolean);
            const line1 = parts.join(' — ');
            const details = [contractLine, propertyLine, line1, note].filter(Boolean).join(' • ');

            loadedEvents.push({
                type: 'FollowUp',
                time: String(f.dueTime || '') || '14:00',
                title: f.task,
                details,
                status: f.status,
                _raw: f,
            });
        });

        // Sort by time (professional: timeline view)
        const sorted = [...loadedEvents].sort((a, b) => {
            const am = timeToMinutes(a?.time);
            const bm = timeToMinutes(b?.time);
            const av = am === null ? Number.POSITIVE_INFINITY : am;
            const bv = bm === null ? Number.POSITIVE_INFINITY : bm;
            if (av !== bv) return av - bv;
            return String(a?.type || '').localeCompare(String(b?.type || ''));
        });

        setEvents(sorted);
    }, [date, isDesktop, isDesktopFast]);

  useEffect(() => {
      void reload();
  }, [reload]);

  const getIcon = (type: CalendarEventType) => {
      switch(type) {
          case 'Installment': return <DollarSign className="text-green-500" />;
          case 'Contract': return <FileText className="text-indigo-500" />;
          case 'Reminder': return <Clock className="text-orange-500" />;
          default: return <User className="text-purple-500" />;
      }
  };

    const addTaskForDay = async () => {
        const title = newTaskTitle.trim();
        if (!title) {
            dialogs.toast.warning('يرجى إدخال عنوان المهمة');
            return;
        }

        const clientName = newTaskClientName.trim();
        const phone = newTaskPhone.trim();
        const details = newTaskDetails.trim();

        const personId = String(linkPersonId || '').trim() || undefined;
        const contractId = String(linkContractId || '').trim() || undefined;
        const propertyId = String(linkPropertyId || '').trim() || undefined;

        DbService.addFollowUp({
            task: title,
            clientName: clientName || undefined,
            phone: phone || undefined,
            type: 'Task',
            dueDate: date,
            dueTime: newTaskTime || undefined,
            priority: newTaskPriority,
            note: details || undefined,
            personId,
            contractId,
            propertyId,
        });

        // If a phone is provided and it's not in People, log it into client interactions (سجل الاتصالات)
        if (phone) {
            const normalized = normalizePhone(phone);

            // Desktop focus: avoid in-memory scans. Only log when we can safely verify the phone is missing.
            let canVerify = true;
            let exists = false;

            if (isDesktop) {
                canVerify = canPeoplePicker || canDomainSearch;
                if (canVerify) {
                    try {
                        if (canPeoplePicker) {
                            const res = await peoplePickerSearchPagedSmart({ query: normalized, offset: 0, limit: 10 });
                            const items = Array.isArray(res.items) ? res.items : [];
                            exists = items.some((row: PeoplePickerItem) => {
                                const p = row.person;
                                const p1 = normalizePhone(p?.رقم_الهاتف);
                                const p2 = normalizePhone(p?.رقم_هاتف_اضافي);
                                return p1 === normalized || p2 === normalized;
                            });
                        } else {
                            const matches = await domainSearchSmart('people', normalized, 10);
                            exists = matches.some((p) => {
                                const p1 = normalizePhone(p?.رقم_الهاتف);
                                const p2 = normalizePhone(p?.رقم_هاتف_اضافي);
                                return p1 === normalized || p2 === normalized;
                            });
                        }
                    } catch {
                        exists = false;
                    }
                }
            } else {
                const people = DbService.getPeople();
                exists = people.some(p => normalizePhone(p.رقم_الهاتف) === normalized || normalizePhone(p.رقم_هاتف_اضافي) === normalized);
            }

            if (canVerify && !exists) {
                const nowIso = new Date().toISOString();
                DbService.addClientInteraction({
                    clientId: `PH-${normalized}`,
                    clientName: clientName || normalized,
                    type: 'Call',
                    details: `رقم غير موجود في الأشخاص. المهمة: ${title}${details ? `\nتفاصيل: ${details}` : ''}`,
                    date: nowIso,
                    status: 'Logged',
                });
                dialogs.toast.info('تم إضافة الرقم إلى سجل الاتصالات');
            }
        }

        setNewTaskTitle('');
        setNewTaskClientName('');
        setNewTaskPhone('');
        setNewTaskDetails('');
        setNewTaskPriority('Medium');
        setNewTaskTime('');
        setLinkPersonId('');
        setLinkContractId('');
        setLinkPropertyId('');
        dialogs.toast.success('تمت إضافة المهمة');
        void reload();
    };

    const completeFollowUp = (followUpId: string) => {
        DbService.completeFollowUp(followUpId);
        dialogs.toast.success('تم إنهاء المهمة');
        void reload();
    };

    const addNoteToFollowUp = async (followUpId: string, currentNote?: string) => {
        const value = await dialogs.prompt({
            title: 'ملاحظة للمهمة',
            inputType: 'textarea',
            defaultValue: currentNote || '',
            placeholder: 'اكتب ملاحظة تساعدك في المتابعة...',
        });
        if (value === null) return;
        DbService.updateFollowUp(followUpId, { note: value });
        dialogs.toast.success('تم حفظ الملاحظة');
        void reload();
    };

    const postponeFollowUp = async (followUpId: string, currentDueDate: string) => {
        const value = await dialogs.prompt({
            title: 'تأجيل المهمة',
            message: 'اختر التاريخ الجديد للمهمة',
            inputType: 'date',
            defaultValue: currentDueDate,
            required: true,
        });
        if (!value) return;
        DbService.updateFollowUp(followUpId, { dueDate: value });
        dialogs.toast.success('تم تأجيل المهمة');
        void reload();
    };

    const toggleReminderDone = (reminderId: string) => {
        DbService.toggleReminder(reminderId);
        void reload();
    };

  return (
    <div className="h-full bg-white dark:bg-slate-900 p-6">
        <h2 className="text-xl font-bold text-slate-800 dark:text-white mb-6 flex items-center gap-2">
                        <Calendar className="text-indigo-600"/> {isToday ? 'مهام اليوم' : `أحداث يوم ${date}`}
        </h2>

                {/* Add Task for this day */}
                <div className="mb-6 p-4 rounded-2xl border border-gray-200 dark:border-slate-700 bg-gray-50/50 dark:bg-slate-800/40">
                    <div className="flex items-center gap-2 mb-3 text-sm font-bold text-slate-700 dark:text-slate-200">
                        <Plus className="text-indigo-600" size={18} /> إضافة مهمة لهذا اليوم
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-2 mb-2">
                        <PersonPicker
                            placeholder="اختر شخص (اختياري)"
                            value={linkPersonId || undefined}
                            onChange={(pid, personObj) => {
                                setLinkPersonId(pid);
                                if (personObj) {
                                    setNewTaskClientName(String(personObj.الاسم || ''));
                                    setNewTaskPhone(String(personObj.رقم_الهاتف || ''));
                                }
                            }}
                        />

                        <ContractPicker
                            placeholder="اختر عقد (اختياري)"
                            value={linkContractId || undefined}
                            onChange={(cid, cObj) => {
                                setLinkContractId(cid);

                                const propId = String(cObj?.رقم_العقار || '').trim();
                                if (propId) setLinkPropertyId(propId);

                                const tenantId = String(cObj?.رقم_المستاجر || '').trim();
                                if (tenantId) {
                                    setLinkPersonId(tenantId);
                                    if (isDesktopFast || canDomainGet) {
                                        void (async () => {
                                            const p = await domainGetSmart('people', tenantId);
                                            if (!p) return;
                                            setNewTaskClientName(String(p?.الاسم || ''));
                                            setNewTaskPhone(String(p?.رقم_الهاتف || ''));
                                        })();
                                    } else if (!isDesktop) {
                                        try {
                                            const p = DbService.getPeople().find((x) => String(x?.رقم_الشخص) === tenantId);
                                            if (p) {
                                                setNewTaskClientName(String(p?.الاسم || ''));
                                                setNewTaskPhone(String(p?.رقم_الهاتف || ''));
                                            }
                                        } catch {
                                            // ignore
                                        }
                                    }
                                }
                            }}
                            onOpenContract={(cid) => openPanel('CONTRACT_DETAILS', String(cid))}
                        />

                        <PropertyPicker
                            placeholder="اختر عقار (اختياري)"
                            value={linkPropertyId || undefined}
                            onChange={(pid) => {
                                setLinkPropertyId(pid);
                            }}
                        />
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-9 gap-2">
                        <input
                            className="md:col-span-3 bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-700 rounded-xl px-3 py-2 text-sm outline-none"
                            placeholder="عنوان المهمة..."
                            value={newTaskTitle}
                            onChange={e => setNewTaskTitle(e.target.value)}
                        />
                        <input
                            className="md:col-span-2 bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-700 rounded-xl px-3 py-2 text-sm outline-none"
                            placeholder="اسم العميل (اختياري)"
                            value={newTaskClientName}
                            onChange={e => setNewTaskClientName(e.target.value)}
                        />
                        <input
                            className="md:col-span-2 bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-700 rounded-xl px-3 py-2 text-sm outline-none"
                            placeholder="رقم الهاتف (اختياري)"
                            value={newTaskPhone}
                            onChange={e => setNewTaskPhone(e.target.value)}
                            inputMode="tel"
                        />
                        <input
                            type="time"
                            className="md:col-span-1 bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-700 rounded-xl px-3 py-2 text-sm outline-none"
                            value={newTaskTime}
                            onChange={e => setNewTaskTime(e.target.value)}
                            title="وقت المهمة (اختياري)"
                        />
                        <select
                            className="md:col-span-1 bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-700 rounded-xl px-3 py-2 text-sm outline-none"
                            value={newTaskPriority}
                            onChange={(e) => {
                                const v = e.target.value;
                                if (isPriority(v)) setNewTaskPriority(v);
                            }}
                            title="الأولوية"
                        >
                            <option value="Low">منخفضة</option>
                            <option value="Medium">متوسطة</option>
                            <option value="High">عالية</option>
                        </select>
                    </div>

                    <div className="mt-2">
                        <textarea
                            className="w-full bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-700 rounded-xl px-3 py-2 text-sm outline-none min-h-[88px]"
                            placeholder="ملاحظة / تفاصيل (اختياري)"
                            value={newTaskDetails}
                            onChange={e => setNewTaskDetails(e.target.value)}
                        />
                    </div>
                    <div className="mt-3 flex justify-end">
                        <button
                            onClick={addTaskForDay}
                            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-bold transition"
                        >
                            <Plus size={16} /> إضافة
                        </button>
                    </div>
                </div>

        <div className="space-y-4">
            {events.length === 0 ? (
                <div className="text-center text-slate-400 py-10 border-2 border-dashed border-slate-100 rounded-xl">
                    لا توجد أحداث مسجلة لهذا اليوم
                </div>
            ) : (
                events.map((evt, idx) => {
                    const now = new Date();
                    const nowMinutes = now.getHours() * 60 + now.getMinutes();
                    const evtMinutes = timeToMinutes(evt?.time);
                    const isPending = String(evt?.status) !== 'Done' && String(evt?.status) !== 'Paid' && String(evt?.status) !== 'completed';
                    const isOverdueNow = isToday && isPending && evtMinutes !== null && nowMinutes >= evtMinutes;

                    return (
                    <div
                        key={idx}
                        className={
                            `flex gap-4 p-4 rounded-xl border transition ` +
                            (isOverdueNow
                                ? 'bg-red-50 dark:bg-red-950 border-red-200 dark:border-red-800'
                                : 'bg-slate-50 dark:bg-slate-800 border-slate-100 dark:border-slate-700')
                        }
                    >
                        <div className="mt-1">{getIcon(evt.type)}</div>
                                                <div className="flex-1 min-w-0">
                                                        <div className="flex items-start justify-between gap-3">
                                                            <h4 className="font-bold text-slate-700 dark:text-white break-words">{evt.title}</h4>
                                                            <div className="text-[10px] text-slate-500 dark:text-slate-400 flex items-center gap-1 flex-shrink-0" dir="ltr">
                                                                <Clock size={12} />
                                                                {formatTimeFromHM(evt.time, { locale: 'en-US', hour12: true })}
                                                            </div>
                                                        </div>
                                                        {evt.details && <p className="text-xs text-slate-500 break-words">{evt.details}</p>}
                                                        <span className="text-[10px] bg-white dark:bg-slate-900 px-2 py-0.5 rounded border mt-2 inline-block">
                                                                {evt.type} • {evt.status}
                                                        </span>

                                                        {isOverdueNow && (
                                                            <div className="mt-2">
                                                                <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-200">
                                                                    متأخرة الآن
                                                                </span>
                                                            </div>
                                                        )}

                                                        {evt.type === 'FollowUp' && (
                                                            <div className="mt-3 flex flex-wrap gap-2">
                                                                {String(evt._raw?.personId || '').trim() && (
                                                                    <button
                                                                        onClick={() => openPanel('PERSON_DETAILS', String(evt._raw.personId))}
                                                                        className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-200 hover:bg-slate-300 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-800 dark:text-slate-100 text-xs font-bold"
                                                                    >
                                                                        فتح الشخص
                                                                    </button>
                                                                )}

                                                                {String(evt._raw?.contractId || '').trim() && (
                                                                    <button
                                                                        onClick={() => openPanel('CONTRACT_DETAILS', String(evt._raw.contractId))}
                                                                        className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-200 hover:bg-slate-300 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-800 dark:text-slate-100 text-xs font-bold"
                                                                    >
                                                                        فتح العقد
                                                                    </button>
                                                                )}

                                                                {String(evt._raw?.propertyId || '').trim() && (
                                                                    <button
                                                                        onClick={() => openPanel('PROPERTY_DETAILS', String(evt._raw.propertyId))}
                                                                        className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-200 hover:bg-slate-300 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-800 dark:text-slate-100 text-xs font-bold"
                                                                    >
                                                                        فتح العقار
                                                                    </button>
                                                                )}

                                                                {String(evt._raw.status) !== 'Done' && (
                                                                    <button
                                                                        onClick={() => completeFollowUp(evt._raw.id)}
                                                                        className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-green-600 hover:bg-green-700 text-white text-xs font-bold"
                                                                    >
                                                                        <CheckCircle2 size={14} /> إنهاء
                                                                    </button>
                                                                )}
                                                                <button
                                                                    onClick={() => addNoteToFollowUp(evt._raw.id, evt._raw.note)}
                                                                    className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-200 hover:bg-slate-300 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-800 dark:text-slate-100 text-xs font-bold"
                                                                >
                                                                    <StickyNote size={14} /> ملاحظة
                                                                </button>
                                                                <button
                                                                    onClick={() => postponeFollowUp(evt._raw.id, evt._raw.dueDate)}
                                                                    className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold"
                                                                >
                                                                    <CornerDownRight size={14} /> تأجيل
                                                                </button>
                                                            </div>
                                                        )}

                                                        {evt.type === 'Reminder' && (
                                                            <div className="mt-3">
                                                                <button
                                                                    onClick={() => toggleReminderDone(evt._raw.id)}
                                                                    className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-200 hover:bg-slate-300 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-800 dark:text-slate-100 text-xs font-bold"
                                                                >
                                                                    <CheckCircle2 size={14} /> {evt._raw.isDone ? 'إرجاع' : 'تم'}
                                                                </button>
                                                            </div>
                                                        )}
                                                </div>
                    </div>
                );
                })
            )}
        </div>
    </div>
  );
};
