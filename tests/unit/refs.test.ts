import { getDesktopBridge, isDesktop, deleteAttachmentFilesBestEffort, purgeRefs } from '@/services/db/refs';
import * as kv from '@/services/db/kv';
import { KEYS } from '@/services/db/keys';
import { buildCache } from '@/services/dbCache';

beforeEach(() => {
  localStorage.clear();
  buildCache();
  delete (window as any).desktopDb;
});

afterEach(() => {
  delete (window as any).desktopDb;
});

describe('getDesktopBridge', () => {
  test('returns undefined when no desktopDb', () => {
    expect(getDesktopBridge()).toBeUndefined();
  });

  test('returns bridge when desktopDb exists', () => {
    const bridge = { deleteAttachmentFile: jest.fn() };
    (window as any).desktopDb = bridge;
    expect(getDesktopBridge()).toBe(bridge);
  });
});

describe('isDesktop', () => {
  test('returns false without desktopDb', () => {
    expect(isDesktop()).toBe(false);
  });

  test('returns true with desktopDb', () => {
    (window as any).desktopDb = {};
    expect(isDesktop()).toBe(true);
  });
});

describe('deleteAttachmentFilesBestEffort', () => {
  test('does nothing when no bridge', () => {
    expect(() => deleteAttachmentFilesBestEffort([
      { id: 'A1', filePath: 'path/file.pdf' } as any,
    ])).not.toThrow();
  });

  test('does nothing when bridge has no deleteAttachmentFile', () => {
    (window as any).desktopDb = {};
    expect(() => deleteAttachmentFilesBestEffort([
      { id: 'A1', filePath: 'path/file.pdf' } as any,
    ])).not.toThrow();
  });

  test('calls deleteAttachmentFile for attachments with filePath', () => {
    const deleteFn = jest.fn().mockResolvedValue(true);
    (window as any).desktopDb = { deleteAttachmentFile: deleteFn };
    deleteAttachmentFilesBestEffort([
      { id: 'A1', filePath: 'path/file.pdf' } as any,
    ]);
    expect(deleteFn).toHaveBeenCalledWith('path/file.pdf');
  });

  test('skips attachments without filePath', () => {
    const deleteFn = jest.fn();
    (window as any).desktopDb = { deleteAttachmentFile: deleteFn };
    deleteAttachmentFilesBestEffort([{ id: 'A1' } as any]);
    expect(deleteFn).not.toHaveBeenCalled();
  });

  test('skips attachments with non-string filePath', () => {
    const deleteFn = jest.fn();
    (window as any).desktopDb = { deleteAttachmentFile: deleteFn };
    deleteAttachmentFilesBestEffort([{ id: 'A1', filePath: 123 } as any]);
    expect(deleteFn).not.toHaveBeenCalled();
  });

  test('ignores errors from deleteAttachmentFile', () => {
    (window as any).desktopDb = { deleteAttachmentFile: jest.fn().mockImplementation(() => { throw new Error('fail'); }) };
    expect(() => deleteAttachmentFilesBestEffort([
      { id: 'A1', filePath: 'path.pdf' } as any,
    ])).not.toThrow();
  });
});

describe('purgeRefs', () => {
  test('removes matching attachments', () => {
    kv.save(KEYS.ATTACHMENTS, [
      { id: 'A1', referenceType: 'Person', referenceId: 'P1' },
      { id: 'A2', referenceType: 'Person', referenceId: 'P2' },
    ]);
    buildCache();
    purgeRefs('Person', 'P1');
    const remaining = kv.get<any>(KEYS.ATTACHMENTS);
    expect(remaining).toHaveLength(1);
    expect(remaining[0].id).toBe('A2');
  });

  test('noop when no matching attachments', () => {
    kv.save(KEYS.ATTACHMENTS, [{ id: 'A1', referenceType: 'Property', referenceId: 'PR1' }]);
    buildCache();
    purgeRefs('Person', 'P-MISSING');
    expect(kv.get<any>(KEYS.ATTACHMENTS)).toHaveLength(1);
  });

  test('removes matching activities', () => {
    kv.save(KEYS.ACTIVITIES, [
      { id: 'ACT1', referenceType: 'Person', referenceId: 'P1' },
      { id: 'ACT2', referenceType: 'Person', referenceId: 'P2' },
    ]);
    buildCache();
    purgeRefs('Person', 'P1');
    expect(kv.get<any>(KEYS.ACTIVITIES)).toHaveLength(1);
  });

  test('noop activities when no match', () => {
    kv.save(KEYS.ACTIVITIES, [{ id: 'ACT1', referenceType: 'Property', referenceId: 'PR1' }]);
    buildCache();
    purgeRefs('Person', 'P-MISSING');
    expect(kv.get<any>(KEYS.ACTIVITIES)).toHaveLength(1);
  });

  test('removes matching notes', () => {
    kv.save(KEYS.NOTES, [
      { id: 'N1', referenceType: 'Person', referenceId: 'P1' },
      { id: 'N2', referenceType: 'Contract', referenceId: 'C1' },
    ]);
    buildCache();
    purgeRefs('Person', 'P1');
    expect(kv.get<any>(KEYS.NOTES)).toHaveLength(1);
  });

  test('noop notes when no match', () => {
    kv.save(KEYS.NOTES, [{ id: 'N1', referenceType: 'Property', referenceId: 'PR1' }]);
    buildCache();
    purgeRefs('Person', 'P-MISSING');
    expect(kv.get<any>(KEYS.NOTES)).toHaveLength(1);
  });
});
