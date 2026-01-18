import React, { useEffect, useId, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { lockBodyScroll, unlockBodyScroll } from '@/utils/scrollLock';

const appModalStack: string[] = [];

const pushAppModal = (id: string) => {
  appModalStack.push(id);
};

const removeAppModal = (id: string) => {
  const index = appModalStack.lastIndexOf(id);
  if (index >= 0) appModalStack.splice(index, 1);
};

const isTopAppModal = (id: string) => appModalStack[appModalStack.length - 1] === id;

type ModalSize = 'sm' | 'md' | 'lg' | 'xl' | '2xl' | '3xl' | '4xl' | '5xl' | '6xl';

type AppModalProps = {
  open: boolean;
  title: React.ReactNode;
  children: React.ReactNode;
  footer?: React.ReactNode;
  onClose: () => void;

  size?: ModalSize;
  closeOnBackdrop?: boolean;
  closeOnEsc?: boolean;
  lockScroll?: boolean;
  trapFocus?: boolean;
  initialFocusSelector?: string;
  className?: string;
  contentClassName?: string;
  headerClassName?: string;
  titleClassName?: string;
  bodyClassName?: string;
  hideHeader?: boolean;
  showCloseButton?: boolean;
  labelledById?: string;
};

const SIZE_CLASS: Record<ModalSize, string> = {
  sm: 'max-w-sm',
  md: 'max-w-md',
  lg: 'max-w-lg',
  xl: 'max-w-xl',
  '2xl': 'max-w-2xl',
  '3xl': 'max-w-3xl',
  '4xl': 'max-w-4xl',
  '5xl': 'max-w-5xl',
  '6xl': 'max-w-6xl',
};

export const AppModal: React.FC<AppModalProps> = ({
  open,
  title,
  children,
  footer,
  onClose,
  size = 'lg',
  closeOnBackdrop = true,
  closeOnEsc = true,
  lockScroll = true,
  trapFocus = true,
  initialFocusSelector,
  className,
  contentClassName,
  headerClassName,
  titleClassName,
  bodyClassName,
  hideHeader = false,
  showCloseButton = true,
  labelledById,
}) => {
  const reactId = useId();
  const modalInstanceId = useMemo(() => `app-modal-${reactId}`, [reactId]);
  const titleId = useMemo(() => labelledById ?? `app-modal-title-${reactId}`, [labelledById, reactId]);
  const contentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    pushAppModal(modalInstanceId);
    return () => {
      removeAppModal(modalInstanceId);
    };
  }, [open, modalInstanceId]);

  useEffect(() => {
    if (!open) return;
    if (typeof window === 'undefined' || typeof document === 'undefined') return;

    if (lockScroll) lockBodyScroll();

    const previouslyFocused = document.activeElement as HTMLElement | null;

    const getFocusable = (): HTMLElement[] => {
      const root = contentRef.current;
      if (!root) return [];
      const nodes = root.querySelectorAll<HTMLElement>(
        [
          'a[href]',
          'button:not([disabled])',
          'input:not([disabled])',
          'select:not([disabled])',
          'textarea:not([disabled])',
          '[tabindex]:not([tabindex="-1"])',
        ].join(','),
      );
      return Array.from(nodes).filter((el) => {
        if (!el) return false;
        if (el.getAttribute('aria-hidden') === 'true') return false;
        // Skip elements that are not actually visible.
        const rects = el.getClientRects();
        return rects.length > 0;
      });
    };

    const focusInitial = () => {
      if (!trapFocus) return;
      if (!isTopAppModal(modalInstanceId)) return;

      if (initialFocusSelector) {
        const root = contentRef.current;
        const target = root?.querySelector<HTMLElement>(initialFocusSelector) ?? null;
        if (target) {
          target.focus();
          return;
        }
      }

      const focusables = getFocusable();
      if (focusables.length > 0) {
        focusables[0].focus();
        return;
      }
      // Fallback: focus modal container so Tab stays within.
      contentRef.current?.focus();
    };

    // Defer focus until after mount/paint.
    const raf = window.requestAnimationFrame(focusInitial);

    const onKeyDown = (e: KeyboardEvent) => {
      if (!isTopAppModal(modalInstanceId)) return;
      if (!closeOnEsc) return;
      if (e.key === 'Escape') {
        onClose();
        return;
      }

      if (!trapFocus) return;
      if (e.key !== 'Tab') return;

      const focusables = getFocusable();
      if (focusables.length === 0) {
        e.preventDefault();
        contentRef.current?.focus();
        return;
      }

      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      const active = document.activeElement as HTMLElement | null;

      if (e.shiftKey) {
        if (!active || active === first || !contentRef.current?.contains(active)) {
          e.preventDefault();
          last.focus();
        }
        return;
      }

      if (!active || active === last || !contentRef.current?.contains(active)) {
        e.preventDefault();
        first.focus();
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.cancelAnimationFrame(raf);
      if (lockScroll) unlockBodyScroll();
      if (trapFocus) previouslyFocused?.focus?.();
    };
  }, [open, closeOnEsc, lockScroll, onClose, trapFocus, initialFocusSelector, modalInstanceId]);

  if (!open) return null;
  if (typeof document === 'undefined') return null;

  return createPortal(
    <div
      className={`modal-overlay app-modal-overlay animate-fade-in items-end sm:items-center p-0 sm:p-4 ${className ?? ''}`}
      onClick={closeOnBackdrop ? onClose : undefined}
    >
      <div
        ref={contentRef}
        className={`modal-content app-modal-content w-full ${SIZE_CLASS[size]} max-h-[calc(100vh-1rem)] sm:max-h-[calc(100vh-2rem)] overflow-hidden flex flex-col animate-scale-up rounded-t-3xl sm:rounded-2xl ${contentClassName ?? ''}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
      >
        {hideHeader ? (
          <h2 id={titleId} className="sr-only">
            {title}
          </h2>
        ) : (
          <div
            className={`no-print flex items-start gap-3 p-4 border-b border-slate-200/70 dark:border-slate-700 bg-slate-50/80 dark:bg-slate-950/40 ${headerClassName ?? ''}`}
          >
            {showCloseButton ? (
              <button
                type="button"
                onClick={onClose}
                className="p-2 hover:bg-slate-200/70 dark:hover:bg-slate-800 rounded-full transition text-slate-600 dark:text-slate-200"
                aria-label="إغلاق"
                title="إغلاق"
              >
                <X size={18} />
              </button>
            ) : null}

            <h3
              id={titleId}
              className={`text-base sm:text-lg font-bold text-slate-800 dark:text-white flex items-center gap-2 ${titleClassName ?? ''}`}
            >
              {title}
            </h3>
          </div>
        )}

        <div className={`flex-1 min-h-0 overflow-y-auto custom-scrollbar p-4 sm:p-6 ${bodyClassName ?? ''}`}>{children}</div>

        {footer ? (
          <div className="no-print p-4 border-t border-slate-200/70 dark:border-slate-700 bg-slate-50/60 dark:bg-slate-950/30">{footer}</div>
        ) : null}
      </div>
    </div>,
    document.body,
  );
};
