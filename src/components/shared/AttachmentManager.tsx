/**
 * مكون إدارة المرفقات المشترك
 * عرض ورفع وحذف المرفقات لجميع الكيانات
 */

import React, { useState, useEffect } from 'react';
import { Trash2, Download, Upload, FileText, Image, File, Shield, User } from 'lucide-react';
import { Attachment, AttachmentType, getAttachments, addAttachment, deleteAttachment } from '@/services/db/attachments';
import { useAuth } from '@/context/AuthContext';
import { toast } from 'sonner';
import { formatDateYMD, formatFileSize } from '@/utils/format';

interface AttachmentManagerProps {
  entityType: Attachment['entityType'];
  entityId: string;
}

const typeIcons: Record<AttachmentType, React.ReactNode> = {
  'هوية': <User className="w-4 h-4" />,
  'عقد_موقع': <FileText className="w-4 h-4" />,
  'صورة_عقار': <Image className="w-4 h-4" />,
  'ضمان': <Shield className="w-4 h-4" />,
  'اخرى': <File className="w-4 h-4" />,
};

const typeColors: Record<AttachmentType, string> = {
  'هوية': 'bg-blue-100 text-blue-700',
  'عقد_موقع': 'bg-green-100 text-green-700',
  'صورة_عقار': 'bg-purple-100 text-purple-700',
  'ضمان': 'bg-amber-100 text-amber-700',
  'اخرى': 'bg-gray-100 text-gray-700',
};

export function AttachmentManager({ entityType, entityId }: AttachmentManagerProps) {
  const { user } = useAuth();
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [uploading, setUploading] = useState(false);
  const [selectedType, setSelectedType] = useState<AttachmentType>('اخرى');
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  const loadAttachments = () => {
    const data = getAttachments(entityType, entityId);
    setAttachments(data);
  };

  useEffect(() => {
    loadAttachments();
  }, [entityType, entityId, loadAttachments]);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    setUploading(true);
    try {
      await addAttachment(entityType, entityId, selectedType, file, user.id);
      toast.success('تم رفع الملف بنجاح');
      loadAttachments();
    } catch (error) {
      if (error instanceof Error) {
        toast.error(error.message || 'فشل رفع الملف');
      } else {
        toast.error('فشل رفع الملف');
      }
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  };

  const handleDelete = (id: string) => {
    if (!window.confirm('هل أنت متأكد من حذف هذا الملف؟')) return;
    if (!user) return;

    if (deleteAttachment(id, user.id)) {
      toast.success('تم حذف الملف بنجاح');
      loadAttachments();
    }
  };

  const handleDownload = (attachment: Attachment) => {
    const link = document.createElement('a');
    link.href = attachment.fileData;
    link.download = attachment.fileName;
    link.click();
  };

  const handlePreview = (attachment: Attachment) => {
    if (attachment.mimeType.startsWith('image/')) {
      setPreviewUrl(attachment.fileData);
    } else {
      handleDownload(attachment);
    }
  };

  return (
    <div className="space-y-4">
      {/* رفع ملف جديد */}
      <div className="flex flex-col sm:flex-row gap-3 items-end border border-dashed border-gray-300 rounded-lg p-4 bg-gray-50">
        <div className="flex-1 w-full">
          <label className="block text-sm font-medium text-gray-700 mb-1">نوع المرفق</label>
          <select
            value={selectedType}
            onChange={(e) => setSelectedType(e.target.value as AttachmentType)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
          >
            <option value="هوية">هوية شخصية</option>
            <option value="عقد_موقع">عقد موقع</option>
            <option value="صورة_عقار">صورة عقار</option>
            <option value="ضمان">ضمان</option>
            <option value="اخرى">أخرى</option>
          </select>
        </div>
        
        <label className={`
          inline-flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium cursor-pointer
          ${uploading ? 'bg-gray-400 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700 text-white'}
        `}>
          <Upload className="w-4 h-4" />
          {uploading ? 'جار الرفع...' : 'رفع ملف'}
          <input
            type="file"
            className="hidden"
            onChange={handleFileUpload}
            disabled={uploading}
          />
        </label>
      </div>

      {/* قائمة المرفقات */}
      {attachments.length === 0 ? (
        <div className="text-center py-8 text-gray-500">
          <File className="w-12 h-12 mx-auto mb-2 opacity-30" />
          <p className="text-sm">لا يوجد مرفقات حتى الآن</p>
        </div>
      ) : (
        <div className="grid gap-2">
          {attachments.map((att) => (
            <div
              key={att.id}
              className="flex items-center gap-3 p-3 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
            >
              <div className={`p-2 rounded-md ${typeColors[att.type]}`}>
                {typeIcons[att.type]}
              </div>
              
              <div className="flex-1 min-w-0">
                <p className="font-medium text-sm truncate">{att.fileName}</p>
                <p className="text-xs text-gray-500">
                  {formatFileSize(att.fileSize)} • {formatDateYMD(att.uploadedAt)}
                </p>
              </div>

              <div className="flex items-center gap-1">
                <button
                  onClick={() => handlePreview(att)}
                  className="p-2 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded-md transition-colors"
                  title="معاينة / تنزيل"
                >
                  <Download className="w-4 h-4" />
                </button>
                
                <button
                  onClick={() => handleDelete(att.id)}
                  className="p-2 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors"
                  title="حذف"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* معاينة الصور */}
      {previewUrl && (
        <div
          className="fixed inset-0 z-50 bg-black/75 flex items-center justify-center p-4"
          onClick={() => setPreviewUrl(null)}
        >
          <img src={previewUrl} alt="معاينة" className="max-w-full max-h-full rounded-lg object-contain" />
        </div>
      )}
    </div>
  );
}