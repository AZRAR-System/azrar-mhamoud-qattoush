/**
 * Purge attachment/activity/note refs for a domain entity (used by cascade + mockDb).
 */

import type { ActivityRecord, Attachment, NoteRecord } from '@/types';
import type { DesktopDbBridge } from '@/types/electron.types';
import { get, save } from './kv';
import { KEYS } from './keys';

type UnknownRecord = Record<string, unknown>;
const isUnknownRecord = (value: unknown): value is UnknownRecord =>
  !!value && typeof value === 'object' && !Array.isArray(value);

export const getDesktopBridge = (): DesktopDbBridge | undefined =>
  typeof window !== 'undefined'
    ? (window as Window & { desktopDb?: DesktopDbBridge }).desktopDb
    : undefined;

export const isDesktop = () =>
  typeof window !== 'undefined' && !!(window as Window & { desktopDb?: DesktopDbBridge }).desktopDb;

export const deleteAttachmentFilesBestEffort = (attachments: Attachment[]) => {
  const bridge = getDesktopBridge();
  if (!bridge?.deleteAttachmentFile) return;
  for (const a of attachments) {
    const p = isUnknownRecord(a) ? a['filePath'] : undefined;
    if (typeof p !== 'string' || !p) continue;
    try {
      void bridge.deleteAttachmentFile(p);
    } catch {
      /* ignore */
    }
  }
};

export function purgeRefs(referenceType: Attachment['referenceType'], referenceId: string): void {
  const atts = get<Attachment>(KEYS.ATTACHMENTS);
  const removedAtts = atts.filter(
    (a) => a.referenceType === referenceType && a.referenceId === referenceId
  );
  if (removedAtts.length) {
    deleteAttachmentFilesBestEffort(removedAtts);
    save(
      KEYS.ATTACHMENTS,
      atts.filter((a) => !(a.referenceType === referenceType && a.referenceId === referenceId))
    );
  }

  const acts = get<ActivityRecord>(KEYS.ACTIVITIES);
  const filteredActs = acts.filter(
    (a) => !(a.referenceType === referenceType && a.referenceId === referenceId)
  );
  if (filteredActs.length !== acts.length) save(KEYS.ACTIVITIES, filteredActs);

  const notes = get<NoteRecord>(KEYS.NOTES);
  const filteredNotes = notes.filter(
    (n) => !(n.referenceType === referenceType && n.referenceId === referenceId)
  );
  if (filteredNotes.length !== notes.length) save(KEYS.NOTES, filteredNotes);
}
