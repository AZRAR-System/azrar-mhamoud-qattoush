import React from 'react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { AlertTriangle, CheckCircle } from 'lucide-react';
import { audioService } from '@/services/audioService';

interface ConfirmDialogProps {
  isOpen: boolean;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  type?: 'warning' | 'success' | 'info' | 'danger';
  onConfirm: () => void;
  onCancel: () => void;
  children?: React.ReactNode;
}

export const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
  isOpen,
  title,
  message,
  confirmText = 'موافق',
  cancelText = 'إلغاء الأمر',
  type = 'warning',
  onConfirm,
  onCancel,
  children,
}) => {
  if (!isOpen) return null;

  const handleConfirm = () => {
    audioService.playSound('success');
    onConfirm();
  };

  const handleCancel = () => {
    audioService.playSound('cancel');
    onCancel();
  };

  const getTypeStyles = () => {
    switch (type) {
      case 'danger':
        return {
          icon: <AlertTriangle size={40} className="text-red-600" />,
          headerBg: 'bg-red-50 dark:bg-red-900/20',
          borderColor: 'border-red-200 dark:border-red-800',
          confirmBtn: 'bg-red-600 hover:bg-red-700',
        };
      case 'success':
        return {
          icon: <CheckCircle size={40} className="text-green-600" />,
          headerBg: 'bg-green-50 dark:bg-green-900/20',
          borderColor: 'border-green-200 dark:border-green-800',
          confirmBtn: 'bg-green-600 hover:bg-green-700',
        };
      case 'info':
        return {
          icon: <CheckCircle size={40} className="text-indigo-600" />,
          headerBg: 'bg-indigo-50 dark:bg-indigo-900/20',
          borderColor: 'border-indigo-200 dark:border-indigo-800',
          confirmBtn: 'bg-indigo-600 hover:bg-indigo-700',
        };
      default: // warning
        return {
          icon: <AlertTriangle size={40} className="text-orange-600" />,
          headerBg: 'bg-orange-50 dark:bg-orange-900/20',
          borderColor: 'border-orange-200 dark:border-orange-800',
          confirmBtn: 'bg-orange-600 hover:bg-orange-700',
        };
    }
  };

  const styles = getTypeStyles();

  return (
    <div className="confirm-overlay fixed inset-0 bg-black/50 flex items-center justify-center p-4 animate-fade-in">
      <Card className={`modal-content app-modal-content w-full max-w-md border-2 ${styles.borderColor}`}>
        {/* Header */}
        <div className={`${styles.headerBg} p-6 border-b border-gray-200 dark:border-slate-700 flex items-start gap-4`}>
          {styles.icon}
          <div>
            <h2 className="text-lg font-bold text-slate-900 dark:text-white">{title}</h2>
            <p className="text-sm text-slate-600 dark:text-slate-300 mt-1 whitespace-pre-line">{message}</p>
          </div>
        </div>

        {/* Body */}
        {children && (
          <div className="p-6 border-b border-gray-200 dark:border-slate-700">
            {children}
          </div>
        )}

        {/* Footer with Buttons */}
        <div className="p-6 flex gap-3 justify-end">
          <Button
            variant="secondary"
            className="bg-gray-400 hover:bg-gray-500 text-white"
            onClick={handleCancel}
          >
            {cancelText}
          </Button>
          <Button
            variant="primary"
            className={`${styles.confirmBtn} text-white`}
            onClick={handleConfirm}
          >
            {confirmText}
          </Button>
        </div>
      </Card>
    </div>
  );
};
