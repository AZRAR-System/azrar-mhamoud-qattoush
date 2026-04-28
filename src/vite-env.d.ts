/// <reference types="vite/client" />

declare const __APP_VERSION__: string;

/** Main scroll container ref for ScrollToTopButton (set from Layout). */
interface Window {
  __mainScrollEl?: HTMLElement | null;
}

/** Drawer body scroll root (SmartModalEngine). */
interface HTMLElement {
  __scrollEl?: HTMLElement;
}
