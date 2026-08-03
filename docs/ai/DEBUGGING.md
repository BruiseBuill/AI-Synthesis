# Debugging Knowledge

This document defines the required debugging workflow and stores durable diagnostic knowledge. It is not a command-by-command session transcript.

## Required Workflow

### Before Investigation

1. Read `docs/ai/INDEX.md`, this file, and the topic file routed for the affected behavior.
2. Identify the authoritative expected behavior: current code/tests for actual behavior, `Rule.txt` for intended complete rules, and `CardData.xlsm` for authored card data.
3. Classify the task using `docs/ai/MAINTENANCE.md` before validation.
4. Establish the narrowest reproducible symptom or failing assertion before broad changes.

### During Investigation

- Run the narrowest relevant Vitest or Playwright test first.
- Separate observed evidence from hypotheses.
- Preserve the seed whenever randomness affects the reproduction.
- Trace executable behavior through the owning module; descriptive card text is not proof that an effect executes.
- Record only findings that help future work: root causes, decisive checks, misleading symptoms, environmental constraints, and regression protection.

### Required Knowledge Closeout

Every completed debugging task must add or refine at least one reusable finding in this document before handoff. A debugging task is not complete when only code or tests were changed.

Also update the owning topic file when the result changes module ownership, behavior contracts, invariants, commands, known risks, data contracts, or implementation status. Update `docs/ai/INDEX.md` only when navigation, knowledge ownership, or source authority changes.

Do not paste shell transcripts, exploratory command sequences, repeated failures, or chronological narration. Compress the investigation into the structured evidence future maintainers need.

## Finding Template

```markdown
## YYYY-MM-DD - Short diagnostic title

- Status: resolved | diagnosed | unresolved
- Scope: affected module or workflow
- Symptom: smallest externally observable failure
- Root cause: causal explanation supported by evidence
- Decisive evidence: focused test, assertion, trace, or inspection that proved the cause
- Resolution: implemented fix or next bounded action
- Regression protection: test or invariant that prevents recurrence
- Related knowledge: owning `docs/ai/*` files updated by the result
```

For an unresolved investigation, replace the root cause with the confirmed boundary of uncertainty and record only disproven hypotheses that would otherwise be expensive to repeat.

## Durable Findings

### 2026-08-03 - WindowsApps ripgrep cannot execute

- Status: diagnosed
- Scope: repository search tooling in PowerShell under the Codex Microsoft Store environment
- Symptom: PowerShell discovers a bundled `rg.exe` under `C:\Program Files\WindowsApps`, but execution fails with `Access is denied`.
- Root cause: the encrypted Microsoft Store package executable is discoverable but not directly executable from the shell.
- Decisive evidence: `Get-Command rg -All` resolves the `WindowsApps\OpenAI.Codex_*` copy while invoking it returns access denied.
- Resolution: install an independent user-scoped build with `winget install --id BurntSushi.ripgrep.MSVC -e --scope user --accept-package-agreements --accept-source-agreements`, restart PowerShell and Codex, and ensure the WinGet links path resolves first. Do not change ACLs inside `WindowsApps`.
- Regression protection: verify `rg --version`, `where.exe rg`, and `Get-Command rg -All`; the executable or PowerShell function backed by `Microsoft\WinGet\Links\rg.exe` must resolve before the Store package copy.
- Related knowledge: `docs/ai/MAINTENANCE.md` owns validation commands and tool expectations; this environment-specific diagnosis lives here.

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
- Regression protection: `pnpm test:e2e:deployment` loads the built app from `/AI-Synthesis/`, verifies rendered cards and prefixed assets, and fetches the packaged workbook.
- Related knowledge: `docs/ai/ARCHITECTURE.md`, `docs/ai/MAINTENANCE.md`, and `docs/ai/REFERENCES.md` own the deployment contract and commands.

### 2026-08-03 - GitHub Actions must select a pnpm version

- Status: resolved
- Scope: GitHub Pages CI dependency setup
- Symptom: the Pages workflow stopped at `pnpm/action-setup` before Node setup, installation, or build ran.
- Root cause: the repository did not declare `packageManager`, and the action step did not provide its required `version` input.
- Decisive evidence: the public Actions job marked only `Set up pnpm` as failed and skipped every subsequent step.
- Resolution: pin pnpm 10 in `.github/workflows/deploy-pages.yml`; it supports the committed lockfile version 9 format.
- Regression protection: the deployment workflow now owns an explicit pnpm version instead of depending on a developer machine's global installation.
- Related knowledge: `docs/ai/REFERENCES.md` owns the deployment workflow location.
