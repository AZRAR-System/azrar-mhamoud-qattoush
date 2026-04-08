/**
 * نظام المرفقات والملفات
 * حفظ وإدارة المرفقات لجميع كيانات النظام
 */

import { get, save } from './kv';
import { KEYS } from './keys';

export type AttachmentType = 'هوية' | 'عقد_موقع' | 'صورة_عقار' | 'ضمان' | 'اخرى';

export interface Attachment {
  id: string;
  entityType: 'person' | 'contract' | 'property' | 'installment' | 'maintenance';
  entityId: string;
  type: AttachmentType;
  fileName: string;
  fileSize: number;
  fileData: string; // base64
  mimeType: string;
  uploadedAt: string;
  uploadedBy: string;
}

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB

/**
 * جلب جميع المرفقات لكيان معين
 */
export function getAttachments(entityType: Attachment['entityType'], entityId: string): Attachment[] {
  const all = get<Attachment>(KEYS.ATTACHMENTS) || [];
  return all.filter(a => a.entityType === entityType && a.entityId === entityId);
}

/**
 * إضافة مرفق جديد
 */
export function addAttachment(
  entityType: Attachment['entityType'],
  entityId: string,
  type: AttachmentType,
  file: File,
  uploadedBy: string
): Promise<Attachment> {
  return new Promise((resolve, reject) => {
    if (file.size > MAX_FILE_SIZE) {
      return reject(new Error(`حجم الملف كبير جداً. الحد الأقصى هو 5 ميجابايت`));
    }

    const reader = new FileReader();
    
    reader.onload = () => {
      try {
        const base64 = reader.result as string;
        const id = `ATT_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

        const attachment: Attachment = {
          id,
          entityType,
          entityId,
          type,
          fileName: file.name,
          fileSize: file.size,
          fileData: base64,
          mimeType: file.type,
          uploadedAt: new Date().toISOString(),
          uploadedBy
        };

        const all = get<Attachment>(KEYS.ATTACHMENTS) || [];
        all.push(attachment);
        save(KEYS.ATTACHMENTS, all);

        // Operation logging handled at higher level
        
        resolve(attachment);
      } catch (error) {
        reject(error);
      }
    };

    reader.onerror = () => reject(new Error('فشل قراءة الملف'));
    reader.readAsDataURL(file);
  });
}

/**
 * حذف مرفق
 */
export function deleteAttachment(id: string, _deletedBy: string): boolean {
  const all = get<Attachment>(KEYS.ATTACHMENTS) || [];
  const idx = all.findIndex(a => a.id === id);
  
  if (idx === -1) return false;
  
  const _attachment = all[idx];
  all.splice(idx, 1);
  save(KEYS.ATTACHMENTS, all);

  // Operation logging handled at higher level
  
  return true;
}

/**
 * جلب إحصائيات المرفقات
 */
export function getAttachmentsStats() {
  const all = get<Attachment>(KEYS.ATTACHMENTS) || [];
  const totalSize = all.reduce((sum, a) => sum + a.fileSize, 0);

  return {
    totalCount: all.length,
    totalSize,
    byType: all.reduce((acc, a) => {
      acc[a.type] = (acc[a.type] || 0) + 1;
      return acc;
    }, {} as Record<AttachmentType, number>)
  };
}