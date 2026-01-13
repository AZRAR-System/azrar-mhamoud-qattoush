
import React, { useState, useEffect } from 'react';
import { X, Download, ZoomIn, ZoomOut, AlertCircle, Loader2 } from 'lucide-react';
import { DbService } from '@/services/mockDb';
import { sanitizeDocxHtml } from '@/utils/sanitizeHtml';

interface FileViewerProps {
  fileId: string;
  fileName: string;
  fileExtension: string;
  onClose: () => void;
}

export const FileViewer: React.FC<FileViewerProps> = ({ fileId, fileName, fileExtension, onClose }) => {
  const [contentUrl, setContentUrl] = useState<string | null>(null);
  const [docxHtml, setDocxHtml] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [zoom, setZoom] = useState(1);

  // Determine file type
  const cleanExt = (fileExtension || '').toLowerCase().replace(/\./g, '');
  const isImage = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp'].includes(cleanExt);
  const isPdf = cleanExt === 'pdf';
  const isDocx = cleanExt === 'docx';
  const isDoc = cleanExt === 'doc';

  const dataUriToBlobUrl = async (dataUri: string): Promise<string> => {
    // Works for both `data:*;base64,...` and `data:*;charset=utf-8,...`
    const res = await fetch(dataUri);
    if (!res.ok) throw new Error('تعذر قراءة بيانات الملف');
    const blob = await res.blob();
    return URL.createObjectURL(blob);
  };

  useEffect(() => {
    let active = true;
    let blobUrl: string | null = null;

    const fetchFile = async () => {
      try {
        setLoading(true);
        setError('');

        // 1) Get Data URI from storage/desktop
        const dataUri = await DbService.downloadAttachment(fileId);
        
        if (!active) return;

        if (!dataUri) {
          setError('لم يتم العثور على محتوى الملف.');
          setLoading(false);
          return;
        }

        // 2) Process based on type
        setDocxHtml(null);

        if (isPdf || isImage) {
          // In Electron, Blob URLs are more reliable than big data URIs.
          blobUrl = await dataUriToBlobUrl(dataUri);
          if (!active) return;
          setContentUrl(blobUrl);
          return;
        }

        if (isDocx) {
          const buf = await fetch(dataUri).then(r => r.arrayBuffer());
          if (!active) return;

          // Lazy-load to keep bundle small
          const mammothMod: any = await import('mammoth/mammoth.browser');
          const mammoth = mammothMod?.default ?? mammothMod;
          const result = await mammoth.convertToHtml({ arrayBuffer: buf });
          if (!active) return;

          setDocxHtml(sanitizeDocxHtml(String(result?.value || '')));
          setContentUrl(null);
          return;
        }

      } catch (err: any) {
        console.error("FileViewer Error:", err);
        setError('تعذر عرض الملف. قد يكون تالفاً أو كبيراً جداً.');
      } finally {
        if (active) setLoading(false);
      }
    };

    if (isImage || isPdf || isDocx) {
      fetchFile();
    } else {
        // Auto-download for unsupported types
        const downloadAndClose = async () => {
            try {
                const data = await DbService.downloadAttachment(fileId);
                if(data) {
                    const link = document.createElement("a");
                    link.href = data;
                    link.download = fileName;
                    document.body.appendChild(link);
                    link.click();
                    document.body.removeChild(link);
                }
            } catch (e) {
                console.error("Download failed", e);
            }
            onClose();
        }
        downloadAndClose();
    }

    return () => {
      active = false;
      if (blobUrl) URL.revokeObjectURL(blobUrl);
    };
  }, [fileId, isPdf, isImage, isDocx, fileName, onClose]);

  const handleDownload = async () => {
      try {
        const href = contentUrl || (await DbService.downloadAttachment(fileId));
        if (!href) return;
        const link = document.createElement("a");
        link.href = href;
        link.download = fileName;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      } catch {
        // ignore
      }
  };

  if (!isImage && !isPdf && !isDocx) return null; // Should have closed already

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/95 backdrop-blur-sm p-4 animate-fade-in">
      
      {/* Header / Toolbar */}
      <div className="absolute top-0 left-0 right-0 p-4 flex justify-between items-center z-20 bg-gradient-to-b from-black/80 to-transparent">
        <h3 className="text-white font-bold text-lg px-2 flex-1 min-w-0 whitespace-normal break-words leading-snug" dir="auto">{fileName}</h3>
        
        <div className="flex items-center gap-3">
          {isImage && (
            <div className="flex bg-white/10 rounded-full backdrop-blur-md">
              <button onClick={() => setZoom(z => Math.max(0.5, z - 0.25))} className="p-2 text-white hover:bg-white/20 rounded-full transition"><ZoomOut size={20} /></button>
              <button onClick={() => setZoom(z => Math.min(3, z + 0.25))} className="p-2 text-white hover:bg-white/20 rounded-full transition"><ZoomIn size={20} /></button>
            </div>
          )}
          
          <button onClick={handleDownload} className="p-2 bg-white/10 text-white hover:bg-white/20 rounded-full backdrop-blur-md transition" title="تحميل">
            <Download size={20} />
          </button>
          
          <button onClick={onClose} className="p-2 bg-red-600 hover:bg-red-700 text-white rounded-full transition shadow-lg" title="إغلاق">
            <X size={20} />
          </button>
        </div>
      </div>

      {/* Main View Area */}
      <div className="w-full h-full pt-16 pb-4 flex items-center justify-center overflow-hidden">
        
        {loading && (
          <div className="text-white flex flex-col items-center gap-3">
            <Loader2 size={48} className="animate-spin text-indigo-500" />
            <p>جاري تحميل الملف...</p>
          </div>
        )}

        {!loading && error && (
          <div className="bg-red-500/10 border border-red-500/50 p-8 rounded-2xl text-center">
            <AlertCircle size={48} className="text-red-500 mx-auto mb-4" />
            <p className="text-white font-bold text-lg mb-2">عذراً</p>
            <p className="text-red-200">{error}</p>
          </div>
        )}

        {!loading && !error && contentUrl && isImage && (
          <img 
            src={contentUrl} 
            alt={fileName} 
            className="max-w-full max-h-full object-contain transition-transform duration-200"
            style={{ transform: `scale(${zoom})` }}
          />
        )}

        {!loading && !error && contentUrl && isPdf && (
          <embed
            src={contentUrl}
            type="application/pdf"
            className="w-full h-full bg-white rounded-lg shadow-2xl"
          />
        )}

        {!loading && !error && docxHtml && isDocx && (
          <div className="w-full h-full bg-white rounded-lg shadow-2xl overflow-auto p-4" dir="auto">
            <div dangerouslySetInnerHTML={{ __html: docxHtml }} />
          </div>
        )}

      </div>
    </div>
  );
};
