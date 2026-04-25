import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  ReactNode,
  useEffect,
} from 'react';
import { createPortal } from 'react-dom';
import { X, CheckCircle, AlertTriangle, Info, AlertCircle, RefreshCw } from 'lucide-react';
import { audioService } from '@/services/audioService';
import { notificationService } from '@/services/notificationService';
import { AppModal } from '@/components/ui/AppModal';

type ToastType = 'success' | 'error' | 'warning' | 'info' | 'delete' | 'loading';

interface ToastItem {
  id: string;
  type: ToastType;
  message: string;
  title?: string;
  duration?: number;
}

interface DialogOptions {
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  onConfirm?: () => void | Promise<void>;
  onCancel?: () => void;
  isDangerous?: boolean;
  requireTextInput?: string;
}

interface ToastContextType {
  toasts: ToastItem[];
  showToast: (
    message: string,
    type: ToastType,
    title?: string,
    options?: { sound?: boolean; id?: string }
  ) => string;
  removeToast: (id: string) => void;
  success: (message: string, options?: string | { title?: string; id?: string }) => void;
  error: (message: string, options?: string | { title?: string; id?: string }) => void;
  warning: (message: string, options?: string | { title?: string; id?: string }) => void;
  info: (message: string, options?: string | { title?: string; id?: string }) => void;
  loading: (message: string, options?: string | { title?: string; id?: string }) => string;
  delete: (message: string, options?: string | { title?: string; id?: string }) => void;
  confirm: (options: DialogOptions) => Promise<boolean>;
}

export const ToastContext = createContext<ToastContextType | undefined>(undefined);

export const ToastProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const [dialog, setDialog] = useState<DialogOptions | null>(null);
  const [dialogResolve, setDialogResolve] = useState<((value: boolean) => void) | null>(null);
  const [portalReady, setPortalReady] = useState(false);

  useEffect(() => {
    setPortalReady(true);
  }, []);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const showToast = useCallback(
    (
      message: string,
      type: ToastType = 'info',
      title?: string,
      options?: { sound?: boolean; id?: string }
    ) => {
      const id = options?.id || Math.random().toString(36).substr(2, 9);
      const duration =
        type === 'loading'
          ? 60000 // Long duration for loading
          : type === 'error'
            ? 5000
            : type === 'warning'
              ? 4500
              : 3500;

      setToasts((prev) => {
        const filtered = options?.id ? prev.filter((t) => t.id !== options.id) : prev;
        return [...filtered, { id, type, message, title, duration }];
      });

      // Play sound (unless suppressed or loading)
      if (options?.sound !== false && type !== 'loading') {
        type PlaySoundInput = Parameters<typeof audioService.playSound>[0];
        type SoundKey = Extract<PlaySoundInput, string>;

        const soundMap: Record<ToastType, SoundKey> = {
          success: 'success',
          error: 'error',
          warning: 'warning',
          info: 'info',
          delete: 'delete',
          loading: 'info', // Map loading to info sound if played
        };
        audioService.playSound(soundMap[type]);
      }

      // Auto remove (except loading)
      if (type !== 'loading') {
        setTimeout(() => {
          removeToast(id);
        }, duration);
      }

      return id;
    },
    [removeToast]
  );

  // Connect notification service to toast context on mount
  useEffect(() => {
    notificationService.setHandler({
      onNotify: (
        message: string,
        type: 'success' | 'error' | 'warning' | 'info' | 'delete',
        title?: string
      ) => {
        // This will be called by notificationService to show toast
        // notificationService already handles audio; avoid double beeps.
        showToast(message, type, title, { sound: false });
      },
    });
  }, [showToast]);

  const getOpts = (opt?: string | { title?: string; id?: string }) => {
    if (typeof opt === 'string') return { title: opt };
    return opt;
  };

  const success = useCallback(
    (message: string, options?: string | { title?: string; id?: string }) => {
      const o = getOpts(options);
      showToast(message, 'success', o?.title || 'نجاح', { id: o?.id });
    },
    [showToast]
  );

  const error = useCallback(
    (message: string, options?: string | { title?: string; id?: string }) => {
      const o = getOpts(options);
      showToast(message, 'error', o?.title || 'خطأ', { id: o?.id });
    },
    [showToast]
  );

  const warning = useCallback(
    (message: string, options?: string | { title?: string; id?: string }) => {
      const o = getOpts(options);
      showToast(message, 'warning', o?.title || 'تحذير', { id: o?.id });
    },
    [showToast]
  );

  const info = useCallback(
    (message: string, options?: string | { title?: string; id?: string }) => {
      const o = getOpts(options);
      showToast(message, 'info', o?.title || 'معلومة', { id: o?.id });
    },
    [showToast]
  );

  const loading = useCallback(
    (message: string, options?: string | { title?: string; id?: string }) => {
      const o = getOpts(options);
      return showToast(message, 'loading', o?.title || 'جاري المعالجة...', { id: o?.id });
    },
    [showToast]
  );

  const deleteToast = useCallback(
    (message: string, options?: string | { title?: string; id?: string }) => {
      const o = getOpts(options);
      showToast(message, 'delete', o?.title || 'تم الحذف', { id: o?.id });
    },
    [showToast]
  );

  const confirm = useCallback((options: DialogOptions): Promise<boolean> => {
    return new Promise((resolve) => {
      setDialog(options);
      setDialogResolve(() => resolve);
    });
  }, []);

  const handleConfirm = useCallback(async () => {
    if (dialog?.onConfirm) {
      try {
        await dialog.onConfirm();
        audioService.playSound('success');
      } catch (error) {
        console.error('Confirm action error:', error);
      }
    }
    setDialog(null);
    dialogResolve?.(true);
  }, [dialog, dialogResolve]);

  const handleCancel = useCallback(() => {
    if (dialog?.onCancel) {
      dialog.onCancel();
    }
    audioService.playSound('cancel');
    setDialog(null);
    dialogResolve?.(false);
  }, [dialog, dialogResolve]);

  return (
    <ToastContext.Provider
      value={{
        toasts,
        showToast,
        removeToast,
        success,
        error,
        warning,
        info,
        loading,
        delete: deleteToast,
        confirm,
      }}
    >
      {children}
      {portalReady &&
        typeof document !== 'undefined' &&
        createPortal(
          <>
            <ToastContainer toasts={toasts} removeToast={removeToast} />
            {dialog && (
              <ConfirmDialog options={dialog} onConfirm={handleConfirm} onCancel={handleCancel} />
            )}
          </>,
          document.body
        )}
    </ToastContext.Provider>
  );
};

export const useToast = () => {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
};

// Toast Container Component
const ToastContainer: React.FC<{ toasts: ToastItem[]; removeToast: (id: string) => void }> = ({
  toasts,
  removeToast,
}) => {
  return (
    <div className="fixed bottom-6 right-6 layer-toast flex flex-col gap-3 pointer-events-none">
      {toasts.map((toast) => (
        <ToastView key={toast.id} toast={toast} onClose={() => removeToast(toast.id)} />
      ))}
    </div>
  );
};

// Individual Toast Component
const ToastView: React.FC<{ toast: ToastItem; onClose: () => void }> = ({ toast, onClose }) => {
  const getStyles = (type: ToastType) => {
    const baseStyles =
      'pointer-events-auto w-full max-w-sm rounded-xl shadow-2xl border p-4 flex items-start gap-3 toast-enter';
    const styles: Record<ToastType, string> = {
      success: `${baseStyles} bg-gradient-to-r from-green-50 to-white dark:from-green-900/30 dark:to-slate-800 border-green-500`,
      error: `${baseStyles} bg-gradient-to-r from-red-50 to-white dark:from-red-900/30 dark:to-slate-800 border-red-500`,
      warning: `${baseStyles} bg-gradient-to-r from-orange-50 to-white dark:from-orange-900/30 dark:to-slate-800 border-orange-500`,
      info: `${baseStyles} bg-gradient-to-r from-indigo-50 to-white dark:from-indigo-900/30 dark:to-slate-800 border-indigo-500`,
      loading: `${baseStyles} bg-gradient-to-r from-blue-50 to-white dark:from-blue-900/30 dark:to-slate-800 border-blue-400`,
      delete: `${baseStyles} bg-gradient-to-r from-red-50 to-white dark:from-red-900/30 dark:to-slate-800 border-red-500`,
    };
    return styles[type];
  };

  const getIconColor = (type: ToastType) => {
    const colors: Record<ToastType, string> = {
      success: 'bg-green-100 text-green-600 dark:bg-green-900/50 dark:text-green-400',
      error: 'bg-red-100 text-red-600 dark:bg-red-900/50 dark:text-red-400',
      warning: 'bg-orange-100 text-orange-600 dark:bg-orange-900/50 dark:text-orange-400',
      info: 'bg-indigo-100 text-indigo-600 dark:bg-indigo-900/50 dark:text-indigo-400',
      loading: 'bg-blue-100 text-blue-600 dark:bg-blue-900/50 dark:text-blue-400 animate-spin-slow',
      delete: 'bg-red-100 text-red-600 dark:bg-red-900/50 dark:text-red-400',
    };
    return colors[type];
  };

  return (
    <div className={getStyles(toast.type)}>
      <div className={`p-2 rounded-full flex-shrink-0 ${getIconColor(toast.type)}`}>
        {toast.type === 'success' && <CheckCircle size={20} strokeWidth={2.5} />}
        {toast.type === 'error' && <AlertCircle size={20} strokeWidth={2.5} />}
        {toast.type === 'warning' && <AlertTriangle size={20} strokeWidth={2.5} />}
        {toast.type === 'info' && <Info size={20} strokeWidth={2.5} />}
        {toast.type === 'loading' && <RefreshCw size={20} strokeWidth={2.5} className="animate-spin" />}
        {toast.type === 'delete' && <AlertCircle size={20} strokeWidth={2.5} />}
      </div>

      <div className="flex-1 pt-0.5">
        <h4 className="font-bold text-sm mb-1 text-slate-900 dark:text-white">{toast.title}</h4>
        <p className="text-sm opacity-85 leading-snug text-slate-700 dark:text-slate-300">
          {toast.message}
        </p>
      </div>

      <button
        onClick={onClose}
        className="p-1 hover:bg-black/5 dark:hover:bg-white/10 rounded-full transition-colors flex-shrink-0 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
      >
        <X size={18} />
      </button>
    </div>
  );
};

// Confirm Dialog Component
const ConfirmDialog: React.FC<{
  options: DialogOptions;
  onConfirm: () => void;
  onCancel: () => void;
}> = ({ options, onConfirm, onCancel }) => {
  return (
    <AppModal
      open
      onClose={onCancel}
      size="md"
      closeOnBackdrop={false}
      showCloseButton={false}
      headerClassName={
        options.isDangerous
          ? 'bg-gradient-to-r from-red-50 to-white dark:from-red-900/20 dark:to-slate-800'
          : 'bg-gradient-to-r from-indigo-50 to-white dark:from-indigo-900/20 dark:to-slate-800'
      }
      title={options.title}
      footer={
        <div className="flex gap-3">
          <button
            onClick={onCancel}
            className="flex-1 px-4 py-2.5 bg-slate-100 dark:bg-slate-700 text-slate-900 dark:text-white rounded-lg font-medium hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors"
          >
            {options.cancelText || 'إلغاء'}
          </button>
          <ConfirmButton options={options} onConfirm={onConfirm} />
        </div>
      }
    >
      <div className="space-y-4">
        <p className="text-slate-700 dark:text-slate-300 leading-relaxed">{options.message}</p>
        {options.requireTextInput && (
          <div className="mt-4">
            <p className="text-xs font-bold text-slate-500 mb-2">
              اكتب "{options.requireTextInput}" للمتابعة
            </p>
            <input
              type="text"
              id="confirm-text-input"
              className="w-full px-4 py-2 border rounded-lg dark:bg-slate-800 dark:border-slate-700"
              autoFocus
              onKeyDown={(e) => {
                const target = e.target as HTMLInputElement;
                if (e.key === 'Enter' && target.value === options.requireTextInput) {
                  onConfirm();
                }
              }}
            />
          </div>
        )}
      </div>
    </AppModal>
  );
};

const ConfirmButton: React.FC<{ options: DialogOptions; onConfirm: () => void }> = ({
  options,
  onConfirm,
}) => {
  const [val, setVal] = useState('');

  useEffect(() => {
    if (!options.requireTextInput) return;
    const input = document.getElementById('confirm-text-input') as HTMLInputElement;
    if (input) {
      const handler = (e: Event) => setVal((e.target as HTMLInputElement).value);
      input.addEventListener('input', handler);
      return () => input.removeEventListener('input', handler);
    }
  }, [options.requireTextInput]);

  const disabled = options.requireTextInput ? val !== options.requireTextInput : false;

  return (
    <button
      onClick={onConfirm}
      disabled={disabled}
      className={`flex-1 px-4 py-2.5 text-white rounded-lg font-medium transition-colors ${
        options.isDangerous ? 'bg-red-600 hover:bg-red-700' : 'bg-indigo-600 hover:bg-indigo-700'
      } disabled:opacity-50 disabled:cursor-not-allowed`}
    >
      {options.confirmText || 'تأكيد'}
    </button>
  );
};
