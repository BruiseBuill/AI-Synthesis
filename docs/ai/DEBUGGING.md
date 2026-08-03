# Debugging Knowledge

This document stores durable diagnostic knowledge for future reference.

## Durable Findings

### 2026-08-03 - Rare difficulty statistics ignored authored workbook values

- Status: resolved
- Scope: `CardData.xlsm` import, bundled startup, and settings difficulty statistics
- Symptom: the workbook contained no difficulty-20 card, but settings still displayed a `20` bucket.
- Root cause: `cardDataImport.ts` replaced the workbook's final difficulty for eight known rare names with a fixed `16/18/20` registry; the workbook alignment test reused that importer and therefore could not reveal the override. Bundled data could also be hidden by a persisted reload snapshot until its generated catalog version changed.
- Decisive evidence: direct worksheet inspection showed rare difficulties `16,16,16,16,17,17,17,18`, while the generated runtime snapshot and chart showed `16,16,16,16,18,18,18,20`.
- Resolution: the importer now copies final difficulty directly from every authored row; React waits for a fresh bundled workbook parse before mounting unless an explicit custom import is active; bundled reloads are no longer persisted, and development watches workbook saves. Effect description text is no longer consulted when compiling the Necklace effect.
- Related knowledge: `docs/ai/ARCHITECTURE.md`, `docs/ai/CARD_EFFECTS.md`, `docs/ai/REFERENCES.md`, and `docs/ai/MAINTENANCE.md` describe the updated data contract and startup flow.

### 2026-08-03 - Workbook updates were masked by a stale runtime snapshot

- Status: resolved
- Scope: `CardData.xlsm` authoring, generated runtime catalog, and IndexedDB catalog hydration
- Symptom: after syncing an updated `CardData.xlsm`, normal page reloads continued to show the old card descriptions; the workbook/JSON alignment test exposed the concrete stale name `王冠` instead of the authored `项链`.
- Root cause: the application imported `src/data/cardData.generated.json` synchronously, but no generator updated it from the workbook. In addition, “重载 CardData.xlsm” stored the bundled workbook as an undifferentiated imported IndexedDB snapshot, which could override later built-in deployments indefinitely.
- Decisive evidence: `pnpm vitest run src/data/cardDataWorkbook.test.ts` failed on the authored/runtime name mismatch, while tracing `hydrateCardData` showed every valid saved snapshot replaced `defaultTreasureDefinitions` without a catalog-version check.
- Resolution: `scripts/generate-card-data.mjs` now runs before `dev`, `test`, and `build`; bundled reload snapshots record the built-in catalog version, and hydration clears stale or legacy bundled snapshots while preserving explicitly named custom imports.
- Related knowledge: `docs/ai/ARCHITECTURE.md`, `docs/ai/REFERENCES.md`, and `docs/ai/MAINTENANCE.md` describe the generated-data and persistence contracts.

### 2026-08-03 - WindowsApps ripgrep cannot execute

- Status: diagnosed
- Scope: repository search tooling in PowerShell under the Codex Microsoft Store environment
- Symptom: PowerShell discovers a bundled `rg.exe` under `C:\Program Files\WindowsApps`, but execution fails with `Access is denied`.
- Root cause: the encrypted Microsoft Store package executable is discoverable but not directly executable from the shell.
- Decisive evidence: `Get-Command rg -All` resolves the `WindowsApps\OpenAI.Codex_*` copy while invoking it returns access denied.
- Resolution: install an independent user-scoped build with `winget install --id BurntSushi.ripgrep.MSVC -e --scope user --accept-package-agreements --accept-source-agreements`, restart PowerShell and Codex, and ensure the WinGet links path resolves first. Do not change ACLs inside `WindowsApps`.
- Related knowledge: `docs/ai/MAINTENANCE.md` owns commands and tool expectations; this environment-specific diagnosis lives here.

If command precedence still selects the Store package, add this PowerShell profile function:

```powershell
$ripgrep = Join-Path $env:LOCALAPPDATA "Microsoft\WinGet\Links\rg.exe"
function global:rg { & $ripgrep @args }
```

### 2026-08-03 - Vite preview must retain the deployment base

- Status: resolved
- Scope: GitHub Pages production preview and deployment smoke coverage
- Symptom: the built HTML used `/AI-Synthesis/assets/*`, but the previewed application stayed blank because asset requests returned the HTML fallback instead of JavaScript.
- Root cause: Vite reports both `dev` and `preview` as `command: "serve"`; a configuration based only on `command === "build"` reset preview to the root base path.
- Decisive evidence: `dist/index.html` referenced the expected repository-prefixed assets while requests to those assets through `vite preview` returned `text/html`.
- Resolution: use Vite's `isPreview` configuration flag so builds and production previews share `/AI-Synthesis/`, while the development server remains at `/`.
- Related knowledge: `docs/ai/ARCHITECTURE.md`, `docs/ai/MAINTENANCE.md`, and `docs/ai/REFERENCES.md` own the deployment contract and commands.

### 2026-08-03 - GitHub Actions must select a pnpm version

- Status: resolved
- Scope: GitHub Pages CI dependency setup
- Symptom: the Pages workflow stopped at `pnpm/action-setup` before Node setup, installation, or build ran.
- Root cause: the repository did not declare `packageManager`, and the action step did not provide its required `version` input.
- Decisive evidence: the public Actions job marked only `Set up pnpm` as failed and skipped every subsequent step.
- Resolution: pin pnpm 10 in `.github/workflows/deploy-pages.yml`; it supports the committed lockfile version 9 format.
- Related knowledge: `docs/ai/REFERENCES.md` owns the deployment workflow location.
