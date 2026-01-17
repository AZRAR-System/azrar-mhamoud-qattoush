
import React, { useMemo, useState, useEffect, useRef } from 'react';
import { X, Download, ZoomIn, ZoomOut, AlertCircle, Loader2, FileQuestion, FileText } from 'lucide-react';
import { DbService } from '@/services/mockDb';
import { sanitizeDocxHtml } from '@/utils/sanitizeHtml';

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null;

type PdfViewport = { width: number; height: number };
type PdfRenderTask = { promise: Promise<unknown> };

type PDFPageProxy = {
  getViewport: (options: { scale: number }) => PdfViewport;
  render: (options: { canvasContext: CanvasRenderingContext2D; viewport: PdfViewport }) => PdfRenderTask;
};

type PDFDocumentProxy = {
  numPages: number;
  getPage: (pageNumber: number) => Promise<PDFPageProxy>;
  destroy?: () => Promise<unknown> | unknown;
};

type PdfJsModule = {
  GlobalWorkerOptions: { workerSrc: string };
  getDocument: (options: { data: Uint8Array }) => { promise: Promise<PDFDocumentProxy> };
};

const looksLikeBase64 = (s: string): boolean => {
  const v = String(s || '').trim();
  if (!v) return false;
  // Heuristic: base64 chars only (allow newlines) and reasonably long.
  return v.length >= 16 && /^[A-Za-z0-9+/=\r\n]+$/.test(v);
};

const decodeBase64ToArrayBuffer = (b64: string): ArrayBuffer => {
  const clean = String(b64 || '').replace(/\s+/g, '');
  const binary = atob(clean);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes.buffer;
};

const guessMimeFromExt = (ext: string): string => {
  switch (ext) {
    case 'pdf':
      return 'application/pdf';
    case 'jpg':
    case 'jpeg':
      return 'image/jpeg';
    case 'png':
      return 'image/png';
    case 'gif':
      return 'image/gif';
    case 'webp':
      return 'image/webp';
    case 'bmp':
      return 'image/bmp';
    case 'docx':
      return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
    case 'txt':
    case 'log':
    case 'md':
    case 'csv':
    case 'json':
    case 'xml':
    case 'yml':
    case 'yaml':
    case 'ini':
      return 'text/plain;charset=utf-8';
    case 'mp3':
      return 'audio/mpeg';
    case 'wav':
      return 'audio/wav';
    case 'm4a':
      return 'audio/mp4';
    case 'aac':
      return 'audio/aac';
    case 'ogg':
      // Can be audio or video; application/ogg is a safe default.
      return 'application/ogg';
    case 'flac':
      return 'audio/flac';
    case 'mp4':
      return 'video/mp4';
    case 'mov':
      return 'video/quicktime';
    case 'webm':
      return 'video/webm';
    case 'mkv':
      return 'video/x-matroska';
    case 'avi':
      return 'video/x-msvideo';
    default:
      return 'application/octet-stream';
  }
};

const normalizeToDataUri = (raw: string, fallbackMime: string): string => {
  const s = String(raw || '').trim();
  if (!s) return s;
  if (s.startsWith('data:')) return s;
  // Some legacy/edge cases may store the raw base64 string only.
  if (looksLikeBase64(s)) {
    const mime = String(fallbackMime || 'application/octet-stream');
    return `data:${mime};base64,${s}`;
  }
  return s;
};

const dataUriToArrayBuffer = async (rawUri: string, fallbackMime: string): Promise<ArrayBuffer> => {
  const dataUri = normalizeToDataUri(rawUri, fallbackMime);

  // Prefer parsing ourselves: Chromium can reject very large data: URLs in fetch().
  if (dataUri.startsWith('data:')) {
    const comma = dataUri.indexOf(',');
    if (comma <= 0) throw new Error('تعذر قراءة بيانات الملف');
    const meta = dataUri.slice(0, comma);
    const payload = dataUri.slice(comma + 1);

    if (meta.includes(';base64')) {
      return decodeBase64ToArrayBuffer(payload);
    }

    // Non-base64 data URL (rare here). Try URI-decoding to UTF-8 bytes.
    try {
      const decoded = decodeURIComponent(payload);
      return new TextEncoder().encode(decoded).buffer;
    } catch {
      // Fall back to fetch below.
    }
  }

  const res = await fetch(dataUri);
  if (!res.ok) throw new Error('تعذر قراءة بيانات الملف');
  return await res.arrayBuffer();
};

type MammothConverter = {
  convertToHtml(input: { arrayBuffer: ArrayBuffer }): Promise<{ value?: unknown }>;
};

const isMammothConverter = (v: unknown): v is MammothConverter => {
  if (!isRecord(v)) return false;
  return typeof v.convertToHtml === 'function';
};

interface FileViewerProps {
  fileId: string;
  fileName: string;
  fileExtension: string;
  onClose: () => void;
}

export const FileViewer: React.FC<FileViewerProps> = ({ fileId, fileName, fileExtension, onClose }) => {
  const [contentUrl, setContentUrl] = useState<string | null>(null);
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);
  const [docxHtml, setDocxHtml] = useState<string | null>(null);
  const [textContent, setTextContent] = useState<string | null>(null);
  const [pdfBytes, setPdfBytes] = useState<ArrayBuffer | null>(null);
  const [pdfPage, setPdfPage] = useState(1);
  const [pdfPages, setPdfPages] = useState(0);
  const [pdfScale, setPdfScale] = useState(1);
  type PdfFitMode = 'width' | 'page' | 'manual';
  const [pdfFitMode, setPdfFitMode] = useState<PdfFitMode>('width');
  const [pdfError, setPdfError] = useState('');
  const pdfCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const pdfContainerRef = useRef<HTMLDivElement | null>(null);
  const pdfDocRef = useRef<PDFDocumentProxy | null>(null);
  const pdfjsRef = useRef<PdfJsModule | null>(null);
  const pdfWorkerReadyRef = useRef(false);
  const pdfRenderSeqRef = useRef(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [zoom, setZoom] = useState(1);
  const [contentScale, setContentScale] = useState(1);

  type PreviewKind = 'image' | 'pdf' | 'docx' | 'text' | 'audio' | 'video' | 'other';
  const [kind, setKind] = useState<PreviewKind>('other');

  const cleanExt = useMemo(() => {
    const extFromProp = String(fileExtension || '').toLowerCase().replace(/\./g, '').trim();
    if (extFromProp) return extFromProp;
    const parts = String(fileName || '').split('.');
    return parts.length > 1 ? String(parts[parts.length - 1] || '').toLowerCase().trim() : '';
  }, [fileExtension, fileName]);

  const isImage = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp'].includes(cleanExt);
  const isPdf = cleanExt === 'pdf';
  const isDocx = cleanExt === 'docx';

  const isText = ['txt', 'csv', 'log', 'md', 'json', 'xml', 'yml', 'yaml', 'ini'].includes(cleanExt);
  const isAudio = ['mp3', 'wav', 'ogg', 'm4a', 'aac', 'flac', 'webm'].includes(cleanExt);
  const isVideo = ['mp4', 'webm', 'ogg', 'mov', 'mkv', 'avi'].includes(cleanExt);

  useEffect(() => {
    let active = true;
    let blobUrl: string | null = null;
    let dlUrl: string | null = null;

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
        setTextContent(null);
        setPdfBytes(null);
        setPdfPage(1);
        setPdfPages(0);
        setPdfScale(1);
        setPdfFitMode('width');
        setPdfError('');
        setContentScale(1);
        setZoom(1);
        setKind('other');
        setContentUrl(null);
        setDownloadUrl(null);

        const mimeGuess = guessMimeFromExt(cleanExt);
        const buf = await dataUriToArrayBuffer(dataUri, mimeGuess);
        if (!active) return;

        const blob = new Blob([buf], { type: mimeGuess });
        dlUrl = URL.createObjectURL(blob);
        setDownloadUrl(dlUrl);

        if (isPdf) {
          setKind('pdf');
          setPdfBytes(buf);
          return;
        }

        if (isImage) {
          blobUrl = dlUrl;
          setKind('image');
          setContentUrl(blobUrl);
          return;
        }

        if (isAudio) {
          blobUrl = dlUrl;
          setKind('audio');
          setContentUrl(blobUrl);
          return;
        }

        if (isVideo) {
          blobUrl = dlUrl;
          setKind('video');
          setContentUrl(blobUrl);
          return;
        }

        if (isText) {
          try {
            const text = new TextDecoder('utf-8', { fatal: false }).decode(buf);
            setKind('text');
            setTextContent(text);
          } catch {
            setKind('other');
          }
          return;
        }

        if (isDocx) {
          // Lazy-load to keep bundle small
          const mammothMod: unknown = await import('mammoth/mammoth.browser');
          const mammothCandidate: unknown = isRecord(mammothMod) && 'default' in mammothMod ? mammothMod.default : mammothMod;
          if (!isMammothConverter(mammothCandidate)) throw new Error('تعذر تحميل محول DOCX');

          const result = await mammothCandidate.convertToHtml({ arrayBuffer: buf });
          if (!active) return;

          setKind('docx');
          setDocxHtml(sanitizeDocxHtml(String(result?.value || '')));
          return;
        }

        // Other types: keep fallback UI with download
        setKind('other');

      } catch (err: unknown) {
        console.error("FileViewer Error:", err);
        setError('تعذر عرض الملف. قد يكون تالفاً أو كبيراً جداً.');
      } finally {
        if (active) setLoading(false);
      }
    };

    fetchFile();

    return () => {
      active = false;
      if (blobUrl) URL.revokeObjectURL(blobUrl);
      if (dlUrl) URL.revokeObjectURL(dlUrl);
    };
  }, [cleanExt, fileId, fileName, isAudio, isDocx, isImage, isPdf, isText, isVideo]);

  const clamp = (n: number, min: number, max: number): number => Math.min(max, Math.max(min, n));

  // Load PDF document once per file (cache in ref) + set worker.
  useEffect(() => {
    if (kind !== 'pdf') return;
    if (!pdfBytes) return;

    let cancelled = false;

    const load = async () => {
      try {
        setPdfError('');

        if (!pdfjsRef.current) {
          pdfjsRef.current = (await import('pdfjs-dist/build/pdf')) as unknown as PdfJsModule;
        }
        const pdfjs = pdfjsRef.current;
        if (!pdfjs) throw new Error('تعذر تحميل محرك PDF');

        if (!pdfWorkerReadyRef.current) {
          const workerMod = (await import('pdfjs-dist/build/pdf.worker.min.mjs?url')) as unknown as { default: string };
          pdfjs.GlobalWorkerOptions.workerSrc = String(workerMod?.default || '');
          pdfWorkerReadyRef.current = true;
        }

        // Dispose previous document.
        try {
          await pdfDocRef.current?.destroy?.();
        } catch {
          // ignore
        }
        pdfDocRef.current = null;

        const task = pdfjs.getDocument({ data: new Uint8Array(pdfBytes) });
        const doc = await task.promise;
        if (cancelled) return;
        pdfDocRef.current = doc;

        const total = Number(doc?.numPages || 0);
        setPdfPages(total);
        setPdfPage((p) => clamp(p, 1, total || 1));
      } catch (e: unknown) {
        console.error('PDF load error:', e);
        if (!cancelled) setPdfError('تعذر تحميل ملف PDF داخل التطبيق. يمكنك تحميله وفتحه خارجيًا.');
      }
    };

    void load();
    return () => {
      cancelled = true;
    };
  }, [kind, pdfBytes]);

  // Auto-fit scale on resize/page change (unless user manually zoomed).
  useEffect(() => {
    if (kind !== 'pdf') return;
    if (!pdfDocRef.current) return;
    if (pdfFitMode === 'manual') return;

    let cancelled = false;
    const doc = pdfDocRef.current;

    const computeAndApply = async () => {
      try {
        const container = pdfContainerRef.current;
        if (!container) return;
        const page = await doc.getPage(clamp(pdfPage, 1, Number(doc?.numPages || 1)));
        if (cancelled) return;

        const viewport1 = page.getViewport({ scale: 1 });
        const padding = 32; // matches p-4 around canvas
        const cw = Math.max(200, container.clientWidth - padding);
        const ch = Math.max(200, container.clientHeight - padding);

        const byWidth = cw / viewport1.width;
        const byPage = Math.min(cw / viewport1.width, ch / viewport1.height);

        const next = clamp(pdfFitMode === 'page' ? byPage : byWidth, 0.6, 2);
        if (Number.isFinite(next) && Math.abs(next - pdfScale) > 0.02) {
          setPdfScale(Number(next.toFixed(3)));
        }
      } catch {
        // ignore
      }
    };

    void computeAndApply();

    const container = pdfContainerRef.current;
    if (!container || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(() => {
      void computeAndApply();
    });
    ro.observe(container);

    return () => {
      cancelled = true;
      try {
        ro.disconnect();
      } catch {
        // ignore
      }
    };
  }, [kind, pdfPage, pdfFitMode, pdfScale]);

  // Render PDF page to canvas (re-renders on page/scale).
  useEffect(() => {
    if (kind !== 'pdf') return;
    if (!pdfDocRef.current) return;

    let cancelled = false;
    const seq = ++pdfRenderSeqRef.current;
    const doc = pdfDocRef.current;

    const render = async () => {
      try {
        setPdfError('');
        const targetPage = clamp(pdfPage, 1, Number(doc?.numPages || 1));
        const page = await doc.getPage(targetPage);
        if (cancelled || seq !== pdfRenderSeqRef.current) return;

        const canvas = pdfCanvasRef.current;
        const ctx = canvas?.getContext('2d');
        if (!canvas || !ctx) throw new Error('تعذر تهيئة معاينة PDF');

        const viewport = page.getViewport({ scale: 1.35 * pdfScale });
        canvas.width = Math.ceil(viewport.width);
        canvas.height = Math.ceil(viewport.height);

        await page.render({ canvasContext: ctx, viewport }).promise;
      } catch (e: unknown) {
        console.error('PDF render error:', e);
        if (!cancelled) setPdfError('تعذر عرض ملف PDF داخل التطبيق. يمكنك تحميله وفتحه خارجيًا.');
      }
    };

    void render();
    return () => {
      cancelled = true;
    };
  }, [kind, pdfPage, pdfScale]);

  const handleDownload = async () => {
      try {
        const href = downloadUrl || contentUrl || (await DbService.downloadAttachment(fileId));
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

  return (
    <div className="modal-overlay app-modal-overlay z-[100] bg-black/95 animate-fade-in">
      
      {/* Header / Toolbar */}
      <div className="absolute top-0 left-0 right-0 p-4 flex justify-between items-center z-20 bg-gradient-to-b from-black/80 to-transparent">
        <h3 className="text-white font-bold text-lg px-2 flex-1 min-w-0 whitespace-normal break-words leading-snug" dir="auto">{fileName}</h3>
        
        <div className="flex items-center gap-3">
          {(kind === 'image' || kind === 'docx' || kind === 'text') && (
            <div className="flex bg-white/10 rounded-full backdrop-blur-md">
              <button
                onClick={() => {
                  if (kind === 'image') setZoom((z) => Math.max(0.5, z - 0.25));
                  else setContentScale((s) => Math.max(0.6, Number((s - 0.1).toFixed(2))));
                }}
                className="p-2 text-white hover:bg-white/20 rounded-full transition"
                title="تصغير"
              >
                <ZoomOut size={20} />
              </button>
              <button
                onClick={() => {
                  if (kind === 'image') setZoom((z) => Math.min(3, z + 0.25));
                  else setContentScale((s) => Math.min(2, Number((s + 0.1).toFixed(2))));
                }}
                className="p-2 text-white hover:bg-white/20 rounded-full transition"
                title="تكبير"
              >
                <ZoomIn size={20} />
              </button>
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

        {!loading && !error && contentUrl && kind === 'image' && (
          <img 
            src={contentUrl} 
            alt={fileName} 
            className="max-w-full max-h-full object-contain transition-transform duration-200"
            style={{ transform: `scale(${zoom})` }}
          />
        )}

        {!loading && !error && kind === 'pdf' && (
          <div className="w-full h-full flex flex-col bg-white rounded-lg shadow-2xl overflow-hidden">
            <div className="px-3 py-2 border-b border-slate-200 flex items-center justify-between gap-2">
              <div className="text-xs font-bold text-slate-700 truncate" dir="auto">{fileName}</div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  className="px-2 py-1 text-xs font-bold rounded border border-slate-200 text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                  disabled={pdfPage <= 1}
                  onClick={() => setPdfPage(p => Math.max(1, p - 1))}
                >
                  السابق
                </button>
                <div className="text-xs text-slate-600 tabular-nums whitespace-nowrap">
                  {pdfPages ? `${pdfPage} / ${pdfPages}` : '...'}
                </div>
                <button
                  type="button"
                  className="px-2 py-1 text-xs font-bold rounded border border-slate-200 text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                  disabled={pdfPages ? pdfPage >= pdfPages : true}
                  onClick={() => setPdfPage(p => (pdfPages ? Math.min(pdfPages, p + 1) : p + 1))}
                >
                  التالي
                </button>

                <button
                  type="button"
                  className="px-2 py-1 text-xs font-bold rounded border border-slate-200 text-slate-700 hover:bg-slate-50"
                  onClick={() => {
                    setPdfFitMode('manual');
                    setPdfScale((s) => Math.max(0.6, Number((s - 0.1).toFixed(2))));
                  }}
                  title="تصغير"
                >
                  −
                </button>
                <button
                  type="button"
                  className="px-2 py-1 text-xs font-bold rounded border border-slate-200 text-slate-700 hover:bg-slate-50"
                  onClick={() => {
                    setPdfFitMode('manual');
                    setPdfScale((s) => Math.min(2, Number((s + 0.1).toFixed(2))));
                  }}
                  title="تكبير"
                >
                  +
                </button>

                <button
                  type="button"
                  className={`px-2 py-1 text-xs font-bold rounded border transition ${pdfFitMode === 'width' ? 'bg-indigo-600 text-white border-indigo-600' : 'border-slate-200 text-slate-700 hover:bg-slate-50'}`}
                  onClick={() => setPdfFitMode('width')}
                  title="ملء العرض"
                >
                  ملء العرض
                </button>
                <button
                  type="button"
                  className={`px-2 py-1 text-xs font-bold rounded border transition ${pdfFitMode === 'page' ? 'bg-indigo-600 text-white border-indigo-600' : 'border-slate-200 text-slate-700 hover:bg-slate-50'}`}
                  onClick={() => setPdfFitMode('page')}
                  title="ملء الصفحة"
                >
                  ملء الصفحة
                </button>

                <div className="text-xs text-slate-500 tabular-nums whitespace-nowrap" title="نسبة التكبير">
                  {Math.round(pdfScale * 100)}%
                </div>
              </div>
            </div>

            {pdfError ? (
              <div className="flex-1 flex items-center justify-center p-6">
                <div className="text-center">
                  <p className="text-slate-900 font-bold mb-2">عذراً</p>
                  <p className="text-slate-600 text-sm">{pdfError}</p>
                </div>
              </div>
            ) : (
              <div ref={pdfContainerRef} className="flex-1 overflow-auto bg-slate-100">
                <div className="min-h-full w-full flex items-start justify-center p-4">
                  <canvas ref={pdfCanvasRef} className="bg-white shadow" />
                </div>
              </div>
            )}
          </div>
        )}

        {!loading && !error && docxHtml && kind === 'docx' && (
          <div className="w-full h-full bg-white text-slate-900 rounded-lg shadow-2xl overflow-auto p-4" dir="auto">
            <div
              className="w-full flex justify-center"
              style={({ zoom: contentScale } as unknown) as React.CSSProperties}
            >
              <div className="prose prose-slate max-w-4xl" dangerouslySetInnerHTML={{ __html: docxHtml }} />
            </div>
          </div>
        )}

        {!loading && !error && contentUrl && kind === 'audio' && (
          <div className="w-full max-w-3xl bg-white/5 border border-white/10 rounded-2xl p-6">
            <div className="text-white font-bold mb-4 flex items-center gap-2">
              <FileText size={18} />
              معاينة صوت
            </div>
            <audio controls className="w-full" src={contentUrl} />
          </div>
        )}

        {!loading && !error && contentUrl && kind === 'video' && (
          <div className="w-full h-full flex items-center justify-center">
            <video controls className="max-w-full max-h-full bg-black rounded-lg shadow-2xl" src={contentUrl} />
          </div>
        )}

        {!loading && !error && kind === 'text' && (
          <div className="w-full h-full max-w-5xl bg-white text-slate-900 rounded-lg shadow-2xl overflow-auto p-4" dir="auto">
            <pre
              className="text-sm text-slate-900 whitespace-pre-wrap break-words"
              dir="auto"
              style={({ zoom: contentScale } as unknown) as React.CSSProperties}
            >
              {textContent ?? ''}
            </pre>
          </div>
        )}

        {!loading && !error && kind === 'other' && (
          <div className="w-full max-w-2xl bg-white/5 border border-white/10 rounded-2xl p-8 text-center">
            <FileQuestion size={48} className="text-indigo-300 mx-auto mb-4" />
            <p className="text-white font-bold text-lg mb-2">لا تتوفر معاينة لهذا النوع</p>
            <p className="text-slate-200 text-sm mb-6">يمكنك تحميل الملف وفتحه بالبرنامج المناسب على جهازك.</p>
            <button
              onClick={handleDownload}
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-bold transition"
            >
              <Download size={18} />
              تحميل الملف
            </button>
          </div>
        )}

      </div>
    </div>
  );
};
