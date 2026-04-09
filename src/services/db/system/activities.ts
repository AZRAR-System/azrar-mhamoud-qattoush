import { ActivityRecord } from '@/types';
import { get, save } from '../kv';
import { KEYS } from '../keys';

export const getActivities = (refId: string, type: string) =>
  get<ActivityRecord>(KEYS.ACTIVITIES).filter(
    (a) => a.referenceId === refId && a.referenceType === type
  );

export const addActivity = (record: Omit<ActivityRecord, 'id' | 'createdAt'>) => {
  const all = get<ActivityRecord>(KEYS.ACTIVITIES);
  save(KEYS.ACTIVITIES, [
    ...all,
    {
      ...record,
      id: `ACT-${Date.now()}`,
      createdAt: new Date().toISOString(),
    } as ActivityRecord,
  ]);
};
