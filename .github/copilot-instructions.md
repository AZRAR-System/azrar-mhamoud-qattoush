```markdown
# Copilot coding instructions (AZRAR Desktop)

**Purpose:** Short, actionable guidance for AI coding agents to be immediately productive in this repo.

## Quick architecture summary
- Renderer: **React + TypeScript + Vite** in `src/` (Tailwind). Dev server runs on **http://localhost:3000** (must stay on port 3000 for desktop dev).
- Desktop: **Electron** sources in `electron/` (repo uses ESM). Preload is built to **CJS** (`electron/preload.cjs`) while main/ipc/db bundles are **ESM**.
- Security: `contextIsolation: true`, `nodeIntegration: false`, CSP enforced in `electron/main.ts`. **Do not import Node/Electron APIs from `src/`** — use the preload bridge.

## Data & IPC conventions (key to edits)
- Authoritative storage: SQLite-based KV tables + tombstones in `electron/db.ts` (`kv`, `kv_deleted`). Renderer reads cache via `localStorage` keys prefixed with `db_`.
- Use `src/services/storage.ts` (and `src/services/dbCache.ts`) to read/write app data — this updates `localStorage` for sync readers then persists via IPC.
- IPC surface is defined in `electron/preload.ts` and implemented in `electron/ipc.ts`. Types live in `src/types/electron.types.ts` — **update types when you add new IPC methods**.
- Common IPC examples: `window.desktopDb.get/set`, `domain*` queries, SQL sync APIs (`sql*`), attachment APIs (`saveAttachmentFile/readAttachmentFile`), and `window.desktopUpdater.*`.

## Developer workflows (practical commands)
- UI only: `npm run dev`
- Desktop development (recommended): `npm run desktop:dev` → rebuild electron bundles (esbuild), start Vite (:3000), and launch Electron
- Rebuild Electron bundles only: `npm run electron:build`
- Verify (PR pre-check): `npm run verify` (runs `tsc`, `scripts/routes-check.mjs`, Vite build, electron bundles)
- Tests: `npm test` (Jest). Desktop-specific tests: `npm run desktop:dev:tests`
- Formatting & linting: `npm run format`, `npm run lint`

## Project-specific patterns & gotchas
- Keep Vite on **port 3000**; desktop dev depends on this port.
- Routes are validated by `scripts/routes-check.mjs` — modifications to `src/routes/*` should pass this check.
- When adding an IPC method follow these steps: 1) implement handler in `electron/ipc.ts`, 2) expose via `electron/preload.ts`, 3) add/update signature in `src/types/electron.types.ts`, 4) rebuild (`npm run electron:build`) and 5) update renderer call sites in `src/`.
- DB journaling: set `AZRAR_DESKTOP_JOURNAL_MODE=DELETE` if users sync DB via OneDrive (see `electron/db.ts`).
- To test update flows locally you may set `AZRAR_ALLOW_UNSIGNED_UPDATES=1` (dev/testing only).

## Files and places to inspect for changes
- Renderer & UI: `src/`, `src/main.tsx`, `src/services/*`, `src/routes/*`
- Electron & IPC: `electron/main.ts`, `electron/preload.ts`, `electron/ipc.ts`, `electron/sqlSync.ts`, `electron/db.ts`
- Types: `src/types/electron.types.ts` (update when IPC changes)
- Scripts & CI: `scripts/routes-check.mjs`, `scripts/desktop-dist.ps1`, `package.json` scripts
- Docs: `README.md`, `docs/DEVELOPMENT.md`, `docs/ARCHITECTURE.md`, `docs/TROUBLESHOOTING.md`

## PR checklist for Copilot-driven changes
- Run `npm run verify` locally ✅
- Update `src/types/electron.types.ts` for IPC surface changes ✅
- Add unit tests for logic reachable without Electron (Jest) and run `npm test` ✅
- Run `npm run format` and `npm run lint` ✅

If anything here is unclear or you want additional examples (e.g., a sample IPC addition or a storage migration), tell me which section to expand next.
```
