import { uploadAttachment } from '@/services/db/system/attachments';
import { purgeRefs } from '@/services/db/refs';
import * as kv from '@/services/db/kv';
import { KEYS } from '@/services/db/keys';
import { buildCache } from '@/services/dbCache';

describe('Attachments integration flow', () => {
  beforeEach(() => {
    localStorage.clear();
    buildCache();
    delete (window as Window & { desktopDb?: unknown }).desktopDb;
  });

  afterEach(() => {
    delete (window as Window & { desktopDb?: unknown }).desktopDb;
  });

  test('uploads attachment then purges all related references', async () => {
    const saveAttachmentFile = jest.fn(async () => ({
      success: true,
      relativePath: 'Properties/PR-101/2026-04-27__contract.pdf',
    }));
    const deleteAttachmentFile = jest.fn(async () => ({ success: true }));

    (window as any).desktopDb = {
      saveAttachmentFile,
      deleteAttachmentFile,
      set: jest.fn(async () => true),
      get: jest.fn(async (key: string) => localStorage.getItem(key)),
      delete: jest.fn(async () => true),
      keys: jest.fn(async () => Object.keys(localStorage)),
    } as any;

    kv.save(KEYS.ACTIVITIES, [
      { id: 'ACT-1', referenceType: 'Property', referenceId: 'PR-101' } as any,
      { id: 'ACT-2', referenceType: 'Property', referenceId: 'PR-999' } as any,
    ]);
    kv.save(KEYS.NOTES, [
      { id: 'NOTE-1', referenceType: 'Property', referenceId: 'PR-101' } as any,
      { id: 'NOTE-2', referenceType: 'Property', referenceId: 'PR-999' } as any,
    ]);

    const file = new File(['integration-file-content'], 'contract.pdf', {
      type: 'application/pdf',
    });
    const uploadRes = await uploadAttachment('Property', 'PR-101', file);

    expect(uploadRes.success).toBe(true);
    expect(saveAttachmentFile).toHaveBeenCalledTimes(1);
    expect(kv.get<any>(KEYS.ATTACHMENTS)).toHaveLength(1);

    purgeRefs('Property', 'PR-101');

    const attachmentsAfter = kv.get<any>(KEYS.ATTACHMENTS);
    const activitiesAfter = kv.get<any>(KEYS.ACTIVITIES);
    const notesAfter = kv.get<any>(KEYS.NOTES);

    expect(attachmentsAfter).toHaveLength(0);
    expect(activitiesAfter).toEqual([{ id: 'ACT-2', referenceType: 'Property', referenceId: 'PR-999' }]);
    expect(notesAfter).toEqual([{ id: 'NOTE-2', referenceType: 'Property', referenceId: 'PR-999' }]);
    expect(deleteAttachmentFile).toHaveBeenCalledWith('Properties/PR-101/2026-04-27__contract.pdf');
  });
});
