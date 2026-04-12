import { get, save } from '../kv';
import { KEYS } from '../keys';
import { FollowUpTask, ClientInteraction } from '@/types';

export type FollowUpDeps = {
  addReminder: (reminder: { title: string; date: string; type: string; time?: string }) => string;
  updateReminder: (id: string, patch: Partial<{ title: string; date: string; time?: string; type: string }>) => void;
  setReminderDone: (id: string, isDone: boolean) => void;
};

export const getFollowUps = () =>
  get<FollowUpTask>(KEYS.FOLLOW_UPS)
    .filter((f) => f.status === 'Pending')
    .sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime());

export const getAllFollowUps = () =>
  get<FollowUpTask>(KEYS.FOLLOW_UPS).sort(
    (a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime()
  );

export const addClientInteraction = (data: Omit<ClientInteraction, 'id'>) => {
  const all = get<ClientInteraction>(KEYS.CLIENT_INTERACTIONS);
  save(KEYS.CLIENT_INTERACTIONS, [...all, { ...data, id: `INT-${Date.now()}` }]);
};

export const getClientInteractions = () => get<ClientInteraction>(KEYS.CLIENT_INTERACTIONS);

export function createFollowUpHandlers(deps: FollowUpDeps) {
  const { addReminder, updateReminder, setReminderDone } = deps;

  const addFollowUp = (task: Omit<FollowUpTask, 'id' | 'status'>) => {
    const all = get<FollowUpTask>(KEYS.FOLLOW_UPS);
    const id = `FUP-${Date.now()}`;
    const nowIso = new Date().toISOString();

    let reminderId: string | undefined = task.reminderId;
    if (!reminderId && task.type === 'Task' && task.dueDate && task.task) {
      const dueTime = task.dueTime;
      reminderId = addReminder({
        title: task.task,
        date: task.dueDate,
        time: typeof dueTime === 'string' ? dueTime : undefined,
        type: 'Task',
      });
    }

    save(KEYS.FOLLOW_UPS, [
      ...all,
      {
        ...task,
        id,
        status: 'Pending',
        reminderId,
        createdAt: task.createdAt || nowIso,
        updatedAt: nowIso,
      },
    ]);
    window.dispatchEvent(new Event('azrar:tasks-changed'));
    return id;
  };

  const updateFollowUp = (id: string, patch: Partial<Omit<FollowUpTask, 'id'>>) => {
    const all = get<FollowUpTask>(KEYS.FOLLOW_UPS);
    const idx = all.findIndex((f) => f.id === id);
    if (idx > -1) {
      const next = { ...all[idx], ...patch, updatedAt: new Date().toISOString() } as FollowUpTask;
      all[idx] = next;
      save(KEYS.FOLLOW_UPS, all);

      if (next.reminderId) {
        if (typeof patch.task === 'string') updateReminder(next.reminderId, { title: next.task });
        if (typeof patch.dueDate === 'string') updateReminder(next.reminderId, { date: next.dueDate });
        const dueTime = patch.dueTime;
        if (typeof dueTime === 'string') updateReminder(next.reminderId, { time: dueTime });
        if (patch.status === 'Pending' || patch.status === 'Done')
          setReminderDone(next.reminderId, next.status === 'Done');
      }
      window.dispatchEvent(new Event('azrar:tasks-changed'));
    }
  };

  const deleteFollowUp = (id: string) => {
    const all = get<FollowUpTask>(KEYS.FOLLOW_UPS);
    const target = all.find((f) => f.id === id);
    save(KEYS.FOLLOW_UPS, all.filter((f) => f.id !== id));
    if (target?.reminderId) setReminderDone(target.reminderId, true);
    window.dispatchEvent(new Event('azrar:tasks-changed'));
  };

  const completeFollowUp = (id: string) => {
    const all = get<FollowUpTask>(KEYS.FOLLOW_UPS);
    const idx = all.findIndex((f) => f.id === id);
    if (idx > -1) {
      all[idx].status = 'Done';
      all[idx].updatedAt = new Date().toISOString();
      save(KEYS.FOLLOW_UPS, all);
      if (all[idx].reminderId) setReminderDone(all[idx].reminderId, true);
      window.dispatchEvent(new Event('azrar:tasks-changed'));
    }
  };

  return { addFollowUp, updateFollowUp, deleteFollowUp, completeFollowUp };
}
