import { useCallback } from 'react';
import { useToast } from '@/context/ToastContext';
import { useSmartModal } from '@/context/ModalContext';

type PromptOptions = {
  title: string;
  message?: string;
  inputType?: 'text' | 'password' | 'number' | 'date' | 'textarea' | 'select';
  options?: { label: string; value: string }[];
  defaultValue?: string;
  placeholder?: string;
  required?: boolean;
  validationRegex?: RegExp;
  validationError?: string;
};

type ConfirmOptions = {
  title?: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  isDangerous?: boolean;
};

export function useAppDialogs() {
  const toast = useToast();
  const { openPanel } = useSmartModal();

  const confirm = useCallback(
    (options: ConfirmOptions) => {
      return toast.confirm({
        title: options.title || 'تأكيد',
        message: options.message,
        confirmText: options.confirmText,
        cancelText: options.cancelText,
        isDangerous: options.isDangerous,
      });
    },
    [toast]
  );

  const prompt = useCallback(
    (options: PromptOptions): Promise<string | null> => {
      return new Promise((resolve) => {
        openPanel('SMART_PROMPT', 'app_prompt', {
          title: options.title,
          message: options.message,
          inputType: options.inputType,
          options: options.options,
          defaultValue: options.defaultValue,
          placeholder: options.placeholder,
          required: options.required,
          validationRegex: options.validationRegex,
          validationError: options.validationError,
          onConfirm: (value: string) => resolve(value),
          onClose: () => resolve(null),
        });
      });
    },
    [openPanel]
  );

  return {
    toast,
    confirm,
    prompt,
  };
}
