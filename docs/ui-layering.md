# UI layering and page shell (AZRAR)

This document is the **single reference** for z-index stacking and manual QA after layering changes.  
Source of truth for numeric tokens: [`src/styles/tailwind.css`](../src/styles/tailwind.css) `:root` and utility classes (`.modal-overlay`, `.layer-*`, `.blocking-app-overlay`, …).

## Stacking order (low → high)

1. Page / grid content (`--z-content`, optional `--z-page-main` for main scaffold)
2. App chrome: header (`--z-app-header`), mobile drawer backdrop (`--z-app-drawer-backdrop`), sidebar (`--z-app-sidebar`), floating controls e.g. scroll-to-top (`--z-app-fab`)
3. Dropdowns / popovers (`--z-dropdown`)
4. Slide-over panel overlay / content (`--z-panel-overlay` / `--z-panel-content`)
5. Modal overlay / content (`--z-modal-overlay` / `--z-modal-content`)
6. Confirm dialogs (`--z-confirm`)
7. Toasts (`--z-toast`)
8. App-wide blocking overlays: SQL sync block, session lock (`--z-blocking-app`)
9. Fullscreen loader (`--z-loader`)

## Audit snapshot (components migrated to tokens)

| Location | Previous | Token / class |
|----------|-----------|----------------|
| [`Layout.tsx`](../src/components/Layout.tsx) sidebar | `z-[100]` | `.layer-app-sidebar` |
| [`Layout.tsx`](../src/components/Layout.tsx) header | `z-[90]` | `.layer-app-header` |
| [`Layout.tsx`](../src/components/Layout.tsx) mobile backdrop | `z-[95]` | `.layer-app-drawer-backdrop` |
| [`Layout.tsx`](../src/components/Layout.tsx) scroll FAB | `z-[150]` | `.layer-app-fab` |
| [`Layout.tsx`](../src/components/Layout.tsx) main column | `z-10` | `.layer-page-main` |
| [`Modal.tsx`](../src/components/shared/Modal.tsx) | `z-50` | `.modal-overlay` |
| [`AttachmentManager.tsx`](../src/components/shared/AttachmentManager.tsx) | `z-50` | `.modal-overlay` |
| [`PageSelector.tsx`](../src/components/TabBar/PageSelector.tsx) | `z-[100]` | `.modal-overlay` |
| [`SmartFilterBar.tsx`](../src/components/shared/SmartFilterBar.tsx) menu | `z-50` | `.layer-dropdown` |
| [`SqlSyncBlockingOverlay.tsx`](../src/components/shared/SqlSyncBlockingOverlay.tsx) | `z-[20000]` | `.blocking-app-overlay` |
| [`SessionLockOverlay.tsx`](../src/components/SessionLockOverlay.tsx) | `z-[10050]` | `.blocking-app-overlay` |

**Intentionally unchanged (local stacking only):** `relative z-10` on cards, login hero, table thead sticky, etc. — these sit inside a parent stacking context and do not participate in global overlay order.

## Routes (no merges in this phase)

Paths: [`src/routes/paths.ts`](../src/routes/paths.ts).  
Navigation labels: [`src/routes/registry.ts`](../src/routes/registry.ts) `NAV_ITEMS` / `ROUTE_TITLES`.  
Route components: [`src/App.tsx`](../src/App.tsx).

## Page shell (`PageLayout`)

[`PageLayout`](../src/components/shared/PageLayout.tsx) wraps content with `DS.layout.pageWrap` (`space-y-8 page-transition`).  
Optional **`containWidth`** (default `false`): when `true`, adds `DS.layout.pageShell` (`max-w` + horizontal centering) for new or refactored pages without affecting wide dashboards.

## Manual QA matrix (run after layering PRs)

| Route | Sidebar + header | Modal / panel | Dropdown / filter | RTL | Keyboard (Esc / focus) |
|-------|------------------|---------------|-------------------|-----|-------------------------|
| `/` Dashboard | | | | | |
| `/contracts` | | | | | |
| `/settings` | | | | | |
| `/installments` | | | | | |
| `/sales` | | | | | |
| `/login` | N/A | | | | |

Check: open mobile menu → backdrop covers content; sidebar above backdrop; open `AppModal` from action → modal above shell; SQL sync or session lock → blocks entire UI above modals.

## Regression commands

```bash
npm test
npm run test:coverage
```

Coverage thresholds: [`jest.config.cjs`](../jest.config.cjs) `coverageThreshold`.
