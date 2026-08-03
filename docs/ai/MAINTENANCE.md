# Maintenance

## Invariants

- Basic deck: 40 cards; colors `R/Y/B/W` each 10; score 1 = 16, score 2 = 24; initial hand = 6.
- Bundled treasure catalog: 63 definitions, 80 cards; `Special` = 8 rare cards; one stage card is appended after shuffle.
- Synthesis selects 4 initial materials plus any unlocked extra slots. `safe = materialCount - distinctColorCount`; `risk = distinctColorCount`.
- Phase bonus: 0/1/2. Acquisition succeeds when score >= difficulty, a material effect guarantees that reveal, or a revealed gemstone's typed all-material effective-color condition matches.
- White Jade, Sapphire, Yellow Gem, and Red Gem require every material to include `W/B/Y/R`, respectively, in its post-Priority-0 effective colors; printed color alone is insufficient evidence.
- First risk failure destroys latest gained card; second destroys all gained this synthesis and ends it.
- Rare terminal points by difficulty: >=16 => 3, >=18 => 4, >=20 => 5.
- Same normalized seed + catalog must reproduce initial deck orders.
- Startup seed generation receives browser entropy through `RandomSource`; once displayed, that seed remains the reproducibility boundary.
- Initial material limit is 4 plus one slot per statue among the first four selected materials; statues in extra slots do not increase it.
- Each basic material contributes one typed draw-basic effect. Draws use the basic discard only after the active synthesis materials are finalized; recycle order is seeded and counted.
- Material score bonuses apply once per matching material. `基础分值` selectors use the original printed `synthesisScore` of every material kind; only explicitly reveal-conditional effects such as Candlestick modify the score for a revealed treasure.

## Change Map

- Rule/state transition: edit `src/game-core/game.ts`; cover examples and invariants in `src/game-core/game.test.ts`.
- Effect contract/order: edit `src/game-core/effects.ts`; cover specs, instance stacking, tie-break order, and checkpoint behavior in `src/game-core/effects.test.ts`.
- Card/deck shape: edit `src/game-core/cards.ts` + schema if needed; preserve stable IDs or document migration impact.
- Card spreadsheet contract: edit `cardData.ts`, `cardDataImport.ts`, import/alignment tests, workbook, and generated JSON together. Preserve the workbook header spelling `AdditionalAquireMethod` unless the authoring file is migrated in the same change.
- Persistence: isolate browser storage in `data/*`; version IndexedDB/schema and define migration/fallback behavior.
- Store async behavior: edit `src/store/gameStore.ts`; importing/hydrating intentionally restarts the game with current seed.
- UI workflow: edit `src/App.tsx`/components; keep executable rules out of JSX, while card-agnostic explanatory copy belongs in `SettingsDialog`; add Playwright coverage.
- Visual-only: edit `src/styles.css`; verify desktop/mobile, stable card dimensions, and effect-overflow assertions.
- Catalog statistics: aggregate physical cards using definition `quantity`; cumulative percentages are rounded to integers and must end at 100%.

## Git And GitHub Boundary

- By default, Codex stops after implementing, validating, and reporting local changes. The user owns staging, committing, pushing, and publishing.
- Codex must not run `git add`, create commits or tags, push branches, create or update pull requests, or perform other GitHub operations unless the user explicitly requests that specific action in the current task.
- Read-only local Git commands such as `git status`, `git diff`, and `git log` are allowed when needed to understand scope or verify the handoff. Avoid GitHub API, app, and CLI calls unless the task explicitly requires remote GitHub information.
- For normal releases, the user reviews and pushes the intended files to `main`; the existing GitHub Pages workflow then builds and deploys the site automatically.

## Change Levels And Verification

Classify the task before validation. Mixed changes use the highest applicable level. During implementation, run the narrowest relevant test; run the full gate once after the final edit.

Every debugging task must follow `docs/ai/DEBUGGING.md`. Before handoff, add or refine a durable finding there and update any owning topic whose contract, status, invariant, command, or risk changed. This knowledge closeout is required at every level and is separate from the validation command gate.

### Level 1: Focused Debugging

- Scope: investigation, reproduction, or an incomplete local iteration that is not being handed off as finished behavior.
- Run: the narrowest relevant Vitest or Playwright test, such as `pnpm test:score` or `pnpm test:e2e:score`.
- Do not run a production build, the full unit suite, full E2E, or screenshot pass unless the focused result points to a cross-module problem.

### Level 2: Core Handoff

- Scope: completed changes confined to `src/game-core/`, core test helpers, or non-executable documentation, with no changed store/UI contract or browser behavior.
- During the loop: run the focused core test.
- Before handoff: run `pnpm verify:core`. Run the full `pnpm test` instead of only `test:core` when the change affects shared card/data contracts.
- Playwright is not required for core-only scoring, rule, RNG, or deck changes when the store/UI contract is unchanged.

### Level 3: User-Visible Or Cross-Layer Handoff

- Scope: changes to React, CSS, Zustand behavior, browser persistence/import, workbook/runtime data flow, a store/UI-facing core contract, or any user workflow/rendered result.
- During the loop: run the focused Vitest and/or focused Playwright test.
- Before handoff: run `pnpm verify:all`.
- Add or update Playwright coverage for the changed workflow. Capture manual screenshots only for visual/layout work or when automated assertions cannot prove the rendered result.

### Special Cases

- Core rule/RNG/deck: add focused Vitest coverage; add a fast-check invariant when the state space matters.
- Catalog/import/persistence: import unit tests + settings Playwright test; reconcile definition/card totals.
- UI/CSS/store workflow: `pnpm test:e2e` in both configured projects.
- Deployment: inspect `dist` and run `pnpm test:e2e:deployment` after `pnpm build`; the build must use `/AI-Synthesis/` asset URLs and include `dist/CardData.xlsm`.

## Fast Commands

- `pnpm test:score`: material-score scenarios only.
- `pnpm test:core`: all core Vitest files.
- `pnpm test:e2e:score`: score-related browser workflows only.
- `pnpm card-data:generate`: regenerate `src/data/cardData.generated.json` from `CardData.xlsm` with the shared importer; `dev`, `test`, and `build` invoke it automatically.
- `pnpm verify:core`: Level 2 core suite plus production build.
- `pnpm verify:all`: Level 3 full unit, build, and E2E gate.

## Known Gaps/Risks

- `effect` text remains display/authoring metadata, but the complete bundled catalog is compiled through the typed legacy registry. `SynthesisSummary.checkpoints` records a real queue, and score/color/acquisition/explosion/retention effects execute through it.
- The current `CardData.xlsm` contains VBA and no `EffectCode` column, so the importer retains a centralized legacy statue mapping. Migrate the authoring contract only with a VBA-preserving workflow.
- The generator writes `cardData.generated.json` before development, unit tests, and builds. A malformed workbook therefore fails before the application starts or ships; `cardDataWorkbook.test.ts` additionally catches authored field, definition-total, and card-total drift.
- GitHub Pages deployment is tied to the repository path `/AI-Synthesis/`; renaming the repository requires updating `vite.config.ts` and the deployment smoke test together.
- Additional acquisition methods are an exact four-text registry. A new authoring phrase must add a typed mapping and rule tests; unsupported text is rejected during import instead of becoming display-only behavior.
- Whole-game IndexedDB save/resume/replay described in `Construction.txt` is absent; only imported catalog persists.
- Stage UI state (`finished`, `stagePromptVisible`, `advanceStage`) is inactive legacy surface.
- Core diagnostic draw/reveal helpers remain testable, but the UI no longer exposes direct deck actions outside the synthesis flow.
- No Git metadata exists in this workspace, so history/release/branch assumptions are unavailable.

## Preferred Next Construction Order

1. Complete whole-game persistence/replay.
2. Remove or activate legacy stage state through one canonical path.
