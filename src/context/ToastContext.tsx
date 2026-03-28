import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  ReactNode,
  useEffect,
} from 'react';
import { createPortal } from 'react-dom';
import { X, CheckCircle, AlertTriangle, Info, AlertCircle } from 'lucide-react';
import { audioService } from '@/services/audioService';
import { notificationService } from '@/services/notificationService';
import { AppModal } from '@/components/ui/AppModal';

type ToastType = 'success' | 'error' | 'warning' | 'info' | 'delete';

interface Toast {
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
}

interface ToastContextType {
  toasts: Toast[];
  showToast: (
    message: string,
    type: ToastType,
    title?: string,
    options?: { sound?: boolean }
  ) => void;
  removeToast: (id: string) => void;
  success: (message: string, title?: string) => void;
  error: (message: string, title?: string) => void;
  warning: (message: string, title?: string) => void;
  info: (message: string, title?: string) => void;
  delete: (message: string, title?: string) => void;
  confirm: (options: DialogOptions) => Promise<boolean>;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export const ToastProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<Toast[]>([]);
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
    (message: string, type: ToastType = 'info', title?: string, options?: { sound?: boolean }) => {
      const id = Math.random().toString(36).substr(2, 9);
      const duration = type === 'error' ? 5000 : type === 'warning' ? 4500 : 3500;

      setToasts((prev) => [...prev, { id, type, message, title, duration }]);

      // Play sound (unless suppressed)
      if (options?.sound !== false) {
        type PlaySoundInput = Parameters<typeof audioService.playSound>[0];
        type SoundKey = Extract<PlaySoundInput, string>;

        const soundMap: Record<ToastType, SoundKey> = {
          success: 'success',
          error: 'error',
          warning: 'warning',
          info: 'info',
          delete: 'delete',
        };
        audioService.playSound(soundMap[type]);
      }

      // Auto remove
      setTimeout(() => {
        removeToast(id);
      }, duration);
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

  const success = useCallback(
    (message: string, title?: string) => {
      showToast(message, 'success', title || 'نجاح');
    },
    [showToast]
  );

  const error = useCallback(
    (message: string, title?: string) => {
      showToast(message, 'error', title || 'خطأ');
    },
    [showToast]
  );

  const warning = useCallback(
    (message: string, title?: string) => {
      showToast(message, 'warning', title || 'تحذير');
    },
    [showToast]
  );

  const info = useCallback(
    (message: string, title?: string) => {
      showToast(message, 'info', title || 'معلومة');
    },
    [showToast]
  );

  const deleteToast = useCallback(
    (message: string, title?: string) => {
      showToast(message, 'delete', title || 'تم الحذف');
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
const ToastContainer: React.FC<{ toasts: Toast[]; removeToast: (id: string) => void }> = ({
  toasts,
  removeToast,
}) => {
  return (
    <div className="fixed bottom-6 right-6 layer-toast flex flex-col gap-3 pointer-events-none">
      {toasts.map((toast) => (
        <Toast key={toast.id} toast={toast} onClose={() => removeToast(toast.id)} />
      ))}
    </div>
  );
};

// Individual Toast Component
const Toast: React.FC<{ toast: Toast; onClose: () => void }> = ({ toast, onClose }) => {
  const getStyles = (type: ToastType) => {
    const baseStyles =
      'pointer-events-auto w-full max-w-sm rounded-xl shadow-2xl border p-4 flex items-start gap-3 toast-enter';
    const styles: Record<ToastType, string> = {
      success: `${baseStyles} bg-gradient-to-r from-green-50 to-white dark:from-green-900/30 dark:to-slate-800 border-green-500`,
      error: `${baseStyles} bg-gradient-to-r from-red-50 to-white dark:from-red-900/30 dark:to-slate-800 border-red-500`,
      warning: `${baseStyles} bg-gradient-to-r from-orange-50 to-white dark:from-orange-900/30 dark:to-slate-800 border-orange-500`,
      info: `${baseStyles} bg-gradient-to-r from-indigo-50 to-white dark:from-indigo-900/30 dark:to-slate-800 border-indigo-500`,
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
          <button
            onClick={onConfirm}
            className={`flex-1 px-4 py-2.5 text-white rounded-lg font-medium transition-colors ${
              options.isDangerous
                ? 'bg-red-600 hover:bg-red-700'
                : 'bg-indigo-600 hover:bg-indigo-700'
            }`}
          >
            {options.confirmText || 'تأكيد'}
          </button>
        </div>
      }
    >
      <p className="text-slate-700 dark:text-slate-300 leading-relaxed">{options.message}</p>
    </AppModal>
  );
};
