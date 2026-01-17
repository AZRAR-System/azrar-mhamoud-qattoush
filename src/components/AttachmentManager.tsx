import React, { useCallback, useEffect, useState } from 'react';
import { DbService } from '@/services/mockDb';
import { Attachment, ReferenceType } from '@/types';
import { FileText, Trash2, Upload, HardDrive, Image as ImageIcon, Eye } from 'lucide-react';
import { useToast } from '@/context/ToastContext';
import { FileViewer } from '@/components/shared/FileViewer';

interface AttachmentManagerProps {
  referenceType: ReferenceType;
  referenceId: string;
}

export const AttachmentManager: React.FC<AttachmentManagerProps> = ({ referenceType, referenceId }) => {
  const [files, setFiles] = useState<Attachment[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [viewingFile, setViewingFile] = useState<Attachment | null>(null);
  const toast = useToast();

  type UploadResult = Awaited<ReturnType<typeof DbService.uploadAttachment>>;

  const loadFiles = useCallback(() => {
    setFiles(DbService.getAttachments(referenceType, referenceId));
  }, [referenceId, referenceType]);

  useEffect(() => {
    loadFiles();
  }, [loadFiles]);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setIsUploading(true);
      const selectedFiles = Array.from(e.target.files) as File[];
      
      let successCount = 0;
      let failCount = 0;

      for (const file of selectedFiles) {
        try {
          const res: UploadResult = await DbService.uploadAttachment(referenceType, referenceId, file);
          if (res.success) {
            successCount++;
          } else {
            failCount++;
          }
        } catch {
          failCount++;
        }
      }
      
      setIsUploading(false);
      
      if (successCount > 0) {
        toast.success(`تم رفع ${successCount} ملف/ملفات بنجاح`);
        loadFiles();
      }
      
      if (failCount > 0) {
        toast.error(`فشل رفع ${failCount} ملف/ملفات (تحقق من الصيغة أو الحجم)`);
      }
      e.target.value = '';
    }
  };

  const handleDelete = async (id: string) => {
    const ok = await toast.confirm({
      title: 'حذف ملف',
      message: 'هل أنت متأكد من حذف هذا الملف نهائياً؟',
      confirmText: 'حذف',
      cancelText: 'إلغاء',
      isDangerous: true,
    });
    if (!ok) return;

    const res = await DbService.deleteAttachment(id);
    if (res.success) {
      toast.success(res.message);
      loadFiles();
    } else {
      toast.error(res.message);
    }
  };

  const getIcon = (ext: string) => {
    if (['jpg', 'jpeg', 'png', 'gif'].includes(ext)) return <ImageIcon size={20} className="text-purple-500" />;
    if (['pdf'].includes(ext)) return <FileText size={20} className="text-red-500" />;
    return <FileText size={20} className="text-indigo-500" />;
  };

  const formatSize = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  return (
    <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 overflow-hidden">
      {/* Header */}
      <div className="p-4 border-b border-gray-100 dark:border-slate-700 bg-gray-50 dark:bg-slate-900/50 flex justify-between items-center">
        <h4 className="font-bold text-slate-800 dark:text-white flex items-center gap-2">
          <HardDrive size={18} className="text-indigo-600" />
          المرفقات والملفات
          <span className="bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300 text-xs px-2 py-0.5 rounded-full">{files.length}</span>
        </h4>
        
        <label className={`
          flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-bold cursor-pointer hover:bg-indigo-700 transition shadow-sm
          ${isUploading ? 'opacity-50 cursor-not-allowed' : ''}
        `}>
          {isUploading ? <Upload size={16} className="animate-spin"/> : <Upload size={16} />}
          <span>رفع ملفات</span>
          <input 
            type="file" 
            className="hidden" 
            onChange={handleUpload} 
            disabled={isUploading}
            multiple
          />
        </label>
      </div>

      {/* List */}
      <div className="p-2">
        {files.length === 0 ? (
          <div className="p-8 text-center text-slate-400 dark:text-slate-500 text-sm border-2 border-dashed border-gray-100 dark:border-slate-700 rounded-xl m-2">
            لا توجد مرفقات حالياً. قم برفع المستندات الهامة هنا.
          </div>
        ) : (
          <div className="space-y-1 max-h-[300px] overflow-y-auto custom-scrollbar">
            {files.map(file => (
              <div key={file.id} className="group flex items-center justify-between p-3 rounded-lg hover:bg-indigo-50 dark:hover:bg-slate-700/50 transition border border-transparent hover:border-indigo-100 dark:hover:border-slate-600">
                <div 
                  className="flex items-center gap-3 overflow-hidden cursor-pointer flex-1"
                  onClick={() => setViewingFile(file)}
                >
                  <div className="app-card p-2 rounded-lg dark:bg-slate-800 border-gray-100 dark:border-slate-600">
                    {getIcon(file.fileExtension)}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-slate-800 dark:text-slate-200 whitespace-normal break-words group-hover:text-indigo-600 transition" title={file.fileName}>{file.fileName}</p>
                    <p className="text-xs text-slate-400 flex items-center gap-2">
                      <span className="font-mono">{formatSize(file.fileSize)}</span>
                      <span>•</span>
                      <span dir="ltr">{new Date(file.uploadDate).toLocaleDateString()}</span>
                    </p>
                  </div>
                </div>

                <div className="flex gap-2">
                  <button 
                    onClick={() => setViewingFile(file)}
                    className="p-1.5 text-slate-500 hover:text-indigo-600 hover:bg-white dark:hover:bg-slate-600 rounded-lg transition" 
                    title="معاينة"
                  >
                    <Eye size={16} />
                  </button>
                  <button 
                    onClick={() => handleDelete(file.id)}
                    className="p-1.5 text-slate-500 hover:text-red-600 hover:bg-white dark:hover:bg-slate-600 rounded-lg transition" 
                    title="حذف"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {viewingFile && (
        <FileViewer 
          fileId={viewingFile.id}
          fileName={viewingFile.fileName}
          fileExtension={viewingFile.fileExtension}
          onClose={() => setViewingFile(null)}
        />
      )}
    </div>
  );
};