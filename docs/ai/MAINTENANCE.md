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

- Rule/state transition: edit `src/game-core/game.ts`.
- Effect contract/order: edit `src/game-core/effects.ts`.
- Card/deck shape: edit `src/game-core/cards.ts` + schema if needed; preserve stable IDs or document migration impact.
- Card spreadsheet contract: edit `cardData.ts`, `cardDataImport.ts`, workbook, and generated JSON together. Preserve the workbook header spelling `AdditionalAquireMethod` unless the authoring file is migrated in the same change.
- Persistence: isolate browser storage in `data/*`; version IndexedDB/schema and define migration/fallback behavior.
- Store async behavior: edit `src/store/gameStore.ts`; importing/hydrating intentionally restarts the game with current seed.
- UI workflow: edit `src/App.tsx`/components; keep executable rules out of JSX, while card-agnostic explanatory copy belongs in `SettingsDialog`.
- Visual-only: edit `src/styles.css`; verify desktop/mobile and stable card dimensions manually.
- Catalog statistics: aggregate physical cards using definition `quantity`; cumulative percentages are rounded to integers and must end at 100%.

## Git And GitHub Boundary

- By default, Codex stops after implementing and reporting local changes. The user owns staging, committing, pushing, and publishing.
- Codex must not run `git add`, create commits or tags, push branches, create or update pull requests, or perform other GitHub operations unless the user explicitly requests that specific action in the current task.
- Read-only local Git commands such as `git status`, `git diff`, and `git log` are allowed when needed to understand scope or verify the handoff. Avoid GitHub API, app, and CLI calls unless the task explicitly requires remote GitHub information.
- For normal releases, the user reviews and pushes the intended files to `main`; the existing GitHub Pages workflow then builds and deploys the site automatically.

## Validation

Codex does not run tests, builds, or any verification gate. All validation is performed by the user.

## Fast Commands

- pnpm test:score: material-score scenarios only.
- pnpm test:core: all core Vitest files.
- pnpm test:e2e:score: score-related browser workflows only.
- pnpm card-data:generate: regenerate src/data/cardData.generated.json from CardData.xlsm with the shared importer; dev, test, and build invoke it automatically.
- pnpm test: all Vitest files.
- pnpm test:e2e: all Playwright browser workflows.
- pnpm test:e2e:deployment: deployed-build smoke coverage.
- pnpm build: TypeScript check plus production build.

## Known Gaps/Risks

- `effect` text remains display/authoring metadata, but the complete bundled catalog is compiled through the typed legacy registry. `SynthesisSummary.checkpoints` records a real queue, and score/color/acquisition/explosion/retention effects execute through it.
- The current `CardData.xlsm` contains VBA and no `EffectCode` column, so the importer retains a centralized legacy statue mapping. Migrate the authoring contract only with a VBA-preserving workflow.
- The generator writes `cardData.generated.json` before development, unit tests, and builds. Browser startup still reads the deployed `CardData.xlsm` directly before React mounts; the JSON is the synchronous core/test fallback. A malformed workbook therefore fails before the application starts or ships.
- GitHub Pages deployment is tied to the repository path `/AI-Synthesis/`; renaming the repository requires updating `vite.config.ts` and the deployment smoke test together.
- Additional acquisition methods are an exact four-text registry. A new authoring phrase must add a typed mapping; unsupported text is rejected during import instead of becoming display-only behavior.
- Whole-game IndexedDB save/resume/replay described in `Construction.txt` is absent; only imported catalog persists.
- Stage UI state (`finished`, `stagePromptVisible`, `advanceStage`) is inactive legacy surface.
- Core diagnostic draw/reveal helpers remain testable, but the UI no longer exposes direct deck actions outside the synthesis flow.
- No Git metadata exists in this workspace, so history/release/branch assumptions are unavailable.

## Preferred Next Construction Order

1. Complete whole-game persistence/replay.
2. Remove or activate legacy stage state through one canonical path.
