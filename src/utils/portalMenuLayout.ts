import type { CSSProperties } from 'react';

export type PortalMenuLayoutOptions = {
  gap?: number;
  viewMargin?: number;
  /** سقف أقصى لارتفاع منطقة التمرير (بكسل) */
  hardCapPx?: number;
  /** يُطرح من المساحة المتاحة (حشوة وحدود اللوحة) */
  chromeReserve?: number;
  /** مساحة إضافية تحت قائمة التمرير (مثل صف «مسح الاختيار») */
  footerReserve?: number;
  /** حد أدنى لعرض القائمة (بكسل) */
  minWidthPx?: number;
  /** حد أقصى لعرض القائمة من عرض النافذة */
  widthViewportFrac?: number;
  /** حد أقصى لعرض القائمة بالبكسل */
  maxWidthPxCap?: number;
};

/**
 * تموضع ثابت للقوائم على document.body: محاذاة يمين مع المشغّل (RTL)،
 * قلب للأعلى عند ضيق المساحة، وارتفاع تمرير محسوب.
 */
export function computePortalMenuLayout(
  rect: DOMRect,
  options?: PortalMenuLayoutOptions
): { outerStyle: CSSProperties; listMaxHeightPx: number } {
  const gap = options?.gap ?? 8;
  const viewMargin = options?.viewMargin ?? 16;
  const chromeReserve = options?.chromeReserve ?? 20;
  const footerReserve = options?.footerReserve ?? 0;
  const minW = options?.minWidthPx ?? 168;
  const vwFrac = options?.widthViewportFrac ?? 0.92;
  const maxCap = options?.maxWidthPxCap ?? 22 * 16;
  const hardCap = options?.hardCapPx ?? 384;

  if (typeof window === 'undefined') {
    return {
      outerStyle: {
        position: 'fixed',
        zIndex: 'var(--z-portal-dropdown)',
        right: 0,
        top: 0,
        width: minW,
        boxSizing: 'border-box',
      },
      listMaxHeightPx: 280,
    };
  }

  const vh = window.innerHeight;
  const iw = window.innerWidth;
  const hardCapClamped = Math.min(vh * 0.62, hardCap);
  const spaceBelow = vh - rect.bottom - gap - viewMargin;
  const spaceAbove = rect.top - gap - viewMargin;
  const openUpward =
    spaceBelow < Math.min(200, hardCapClamped * 0.4) && spaceAbove > spaceBelow;
  const rawAvail = openUpward ? spaceAbove : spaceBelow;
  const listMax = Math.max(
    64,
    Math.min(Math.max(0, rawAvail - chromeReserve - footerReserve), hardCapClamped)
  );

  const widthPx = Math.min(Math.max(rect.width, minW), Math.min(iw * vwFrac, maxCap));

  const outerStyle: CSSProperties = {
    position: 'fixed',
    right: iw - rect.right,
    width: widthPx,
    maxWidth: 'min(22rem, calc(100vw - 1.5rem))',
    boxSizing: 'border-box',
    zIndex: 'var(--z-portal-dropdown)',
    ...(openUpward
      ? { bottom: vh - rect.top + gap, top: 'auto' }
      : { top: rect.bottom + gap, bottom: 'auto' }),
  };

  return { outerStyle, listMaxHeightPx: listMax };
}

/** تموضع لوحة ثابتة العرض (تقويم، فلاتر) مع قلب عمودي وحد أقصى للارتفاع */
export function computePortalPanelLayout(
  rect: DOMRect,
  panelWidth: number,
  panelMinHeight: number,
  options?: { gap?: number; viewMargin?: number }
): CSSProperties {
  const gap = options?.gap ?? 8;
  const viewMargin = options?.viewMargin ?? 12;
  if (typeof window === 'undefined') {
    return {
      position: 'fixed',
      zIndex: 'var(--z-portal-dropdown)',
      top: rect.bottom + gap,
      left: 8,
      width: panelWidth,
      maxHeight: 400,
      boxSizing: 'border-box',
      overflow: 'auto',
    };
  }
  const vh = window.innerHeight;
  const iw = window.innerWidth;
  const margin = viewMargin;
  let left = rect.right - panelWidth;
  left = Math.max(margin, Math.min(left, iw - panelWidth - margin));

  const spaceBelow = vh - rect.bottom - gap - margin;
  const spaceAbove = rect.top - gap - margin;
  const openUp = spaceBelow < panelMinHeight && spaceAbove > spaceBelow;
  const maxH = Math.max(200, Math.min(openUp ? spaceAbove : spaceBelow, vh * 0.85));

  if (openUp) {
    return {
      position: 'fixed',
      bottom: vh - rect.top + gap,
      top: 'auto',
      left,
      width: panelWidth,
      maxHeight: maxH,
      boxSizing: 'border-box',
      zIndex: 'var(--z-portal-dropdown)',
      overflow: 'auto',
    };
  }
  return {
    position: 'fixed',
    top: rect.bottom + gap,
    bottom: 'auto',
    left,
    width: panelWidth,
    maxHeight: maxH,
    boxSizing: 'border-box',
    zIndex: 'var(--z-portal-dropdown)',
    overflow: 'auto',
  };
}
