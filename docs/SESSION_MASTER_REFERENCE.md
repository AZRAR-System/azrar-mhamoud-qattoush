# AZRAR Desktop — Master Working Reference (Session Consolidation)

**Last updated:** 2026-02-10  
**Purpose:** Single, non-redundant reference of final decisions, approved improvements, and operational practices.  
**Note:** This document consolidates what is actionable and stable. It intentionally avoids repeating long existing docs.

---

## 1) Non‑Negotiable Architecture & Security Constraints

- **Renderer (UI):** React + TypeScript + Vite under `src/`.
- **Desktop container:** Electron sources under `electron/` (repo uses ESM); preload is built to **CJS** (`electron/preload.cjs`).
- **Security:** `contextIsolation: true`, `nodeIntegration: false`, CSP enforced in Electron.
- **Hard rule:** Do **not** import Node/Electron APIs from `src/`. Use the preload bridge (`window.desktop*`) instead.

---

## 2) Data, Storage, and IPC (Operational Contract)

### 2.1 Authoritative storage model
- **Source of truth:** SQLite KV tables + tombstones in `electron/db.ts` (`kv`, `kv_deleted`).
- **Renderer cache:** reads via `localStorage` keys prefixed with `db_`.

### 2.2 How to read/write app data
- Use `src/services/storage.ts` and `src/services/dbCache.ts`.
- Pattern: update `localStorage` synchronously (for UI) then persist via IPC.

### 2.3 When adding IPC methods (must follow)
1) Implement handler in `electron/ipc.ts`
2) Expose via `electron/preload.ts`
3) Update types in `src/types/electron.types.ts`
4) Rebuild electron bundles: `npm run electron:build`
5) Update renderer call sites in `src/`

---

## 3) Dev Workflows (Known‑Good)

### 3.1 Commands
- **UI only (renderer):** `npm run dev` (Vite)
- **Desktop dev (recommended):** `npm run desktop:dev`
- **Rebuild Electron bundles only:** `npm run electron:build`
- **Typecheck:** `npm run typecheck`
- **Pre‑PR verification:** `npm run verify` (tsc + routes check + Vite build + electron bundles)

### 3.2 Critical environment gotchas
- **Vite must stay on port 3000** for desktop dev.
- If users sync DB with OneDrive: set `AZRAR_DESKTOP_JOURNAL_MODE=DELETE` (see `electron/db.ts`).
- Local update testing: `AZRAR_ALLOW_UNSIGNED_UPDATES=1` (dev/testing only).
- Electron bundle obfuscation is **disabled by default** unless `AZRAR_OBFUSCATE_ELECTRON` is set.

### 3.3 Native modules (SQLite) — common recovery
- Desktop depends on `better-sqlite3` which is a native module and can break after Node/Electron upgrades or reinstall.
- The repo provides a supported fixer:
  - `npm run native:ensure:electron`
- If you need a manual rebuild (advanced), prefer Electron’s ABI-aware rebuild tooling rather than plain `npm rebuild`.

### 3.4 Running with the License Server (dev)
- Start desktop + license server (dev): `npm run desktop:dev:withLicense`
- Run built desktop + license server: `npm run desktop:run:withLicense`
- License admin dev (optionally with license server):
  - `npm run license-admin:dev`
  - `npm run license-admin:dev:withLicense`

---

## 4) Approved UX/UI Improvements (Merged)

### 4.1 Panel surface “background pulse” (hover/focus only)
**Goal:** subtle “important surface” feedback without constant animation.

Implementation:
- CSS utilities + keyframes added in `src/styles/tailwind.css`.
- Applied to modal/panel surfaces in `src/components/shared/SmartModalEngine.tsx`.
- Behavior constraints:
  - Only activates on `:hover` and `:focus-within`.
  - Respects `prefers-reduced-motion`.
  - Implemented via `::before` overlay with `pointer-events: none`.

---

## 5) English Numerals (Inputs + Displays + Currency + Dates)

### 5.1 Input normalization
- Shared inputs already normalize Arabic/Persian digits to Latin via `normalizeDigitsToLatin` (`src/utils/numberInput.ts`).
- Core components involved:
  - `src/components/ui/Input.tsx`
  - `src/components/ui/MoneyInput.tsx`

### 5.2 Display enforcement (global)
**Decision:** enforce Latin digits at runtime for any formatting path that uses `toLocale*` or `Intl.*Format`.

Implementation:
- Global installer in `src/utils/englishNumerals.ts`.
- Called early in `src/main.tsx`.
- Coverage:
  - `Number.prototype.toLocaleString`
  - `Date.prototype.toLocaleString/toLocaleDateString/toLocaleTimeString`
  - `Intl.NumberFormat` + `Intl.DateTimeFormat` (including `formatToParts`; range formatters are feature-detected)

---

## 6) Country / Flag Selection + Currency Classification/Selection

### 6.1 What was added
- Curated country + currency lists (flag, dial code, currency): `src/constants/geo.ts`.
- Settings reader helpers:
  - `src/services/geoSettings.ts` reads from `db_settings`.
  - `getDefaultWhatsAppCountryCodeSync()` returns `countryDialCode` (fallback `962`).

### 6.2 Persisted settings
`SystemSettings` extended to include:
- `countryIso2?: string`
- `countryDialCode?: string`

Defaults set in `src/services/mockDb.ts`:
- `countryIso2: 'JO'`
- `countryDialCode: '962'`

### 6.3 UI entrypoint
- Settings UI: `src/pages/Settings.tsx` → section "البلد والعملة".
  - Country picker shows flag + name + dial code.
  - Currency picker shows code + Arabic name + suffix.

### 6.4 WhatsApp behavior now follows selected country
All places that used a hardcoded `defaultCountryCode: '962'` were updated to use:
- `getDefaultWhatsAppCountryCodeSync()`

This affects:
- notification templates helpers
- people/contacts/bulk WhatsApp sends
- panels that open WhatsApp

### 6.5 Currency suffix resolution
- `src/services/moneySettings.ts` now prefers `db_settings.currency` (SystemSettings) when present.

---

## 7) Security Posture (What’s adopted + what’s pending)

### 7.1 Adopted
- CSP tightening and Electron hardening practices documented and applied.

### 7.2 Known outstanding risk
- `xlsx` prototype pollution advisory remains **High** with no safe upstream version.
- **Approved direction:** migrate export paths toward `exceljs` and avoid `xlsx` where possible.

---

## 8) Database (What matters operationally)

- DB path resolution and audit assumptions are documented in `FINAL_DB_AUDIT_REPORT.md`.
- Integrity checks used: `PRAGMA integrity_check`, `PRAGMA quick_check`.
- Domain tables are derived from KV for query/report performance.

---

## 9) Future Work (Only if/when needed)

- Replace remaining `xlsx` usage with `exceljs`.
- Address Jest ESM/CJS friction noted in final implementation notes.
- Consider adding foreign keys (FK) to domain tables if enforcing relational integrity becomes a requirement.

---

## 10) What this document supersedes

This reference is intended to replace scattered “session” knowledge in chat history. Existing docs remain the authoritative long-form sources where applicable:
- `FINAL_IMPLEMENTATION_SUMMARY.md`
- `IMPLEMENTATION_SUMMARY.md`
- `SECURITY_AUDIT.md`
- `FINAL_DB_AUDIT_REPORT.md`
- `.github/copilot-instructions.md`

---

## 11) Deleting the “11 previous sessions”

**Important limitation:** the “sessions (1 → 11)” you referred to are Copilot/VS Code Chat history items, not files inside this Git repository. Therefore they cannot be deleted via code changes or git operations.

**Manual cleanup (you do this in VS Code UI):**
- Open Copilot Chat panel.
- Open the chat history list.
- Delete sessions 1 → 11 after confirming this file is your new reference.


