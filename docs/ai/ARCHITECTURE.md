# Architecture

## Dependency Direction

```text
index.html -> src/main.tsx -> App/components
                             -> Zustand store
                                -> game-core (pure transitions)
                                -> data import/repository
game-core -> card data types/default catalog + seeded RNG
CardData.xlsm -> browser parser -> Zod -> Zustand -> IndexedDB
generated JSON -> Zod -> default catalog -> deck builder
```

Allowed direction is UI -> store -> core/data. Core must remain framework/browser independent.

## Module Ownership

- `src/game-core/cards.ts`: card types; basic/treasure/stage deck construction; stable card IDs; display and typed additional-acquisition fields.
- `src/game-core/random.ts`: seeded RNG and Fisher-Yates shuffle.
- `src/game-core/game.ts`: immutable `GameState` transitions and synthesis/stage/explosion logic, including score, guarantees, and revealed-card alternative acquisition checks.
- `src/game-core/effects.ts`: pure effect specification/instance compilation and stable priority queue construction.
- `src/store/gameStore.ts`: Zustand actions; composes core transitions; async catalog hydration/import/reset.
- `src/data/cardData.ts`: Zod schemas/types; validates bundled JSON at module load.
- `src/data/cardDataImport.ts`: workbook sheet discovery, row mapping, validation, rare difficulty overrides, and exact additional-acquisition text-to-color mapping.
- `src/data/cardDataRepository.ts`: IndexedDB adapter for imported catalog only.
- `src/App.tsx`: single-screen composition and store selection; displays the core-evaluated synthesis total and must not calculate rules.
- `src/components/*`: presentational cards, display-only deck counters, and the settings dialog with catalog management plus a concise card-agnostic rulebook.
- `src/styles.css`: all styling/responsive behavior; breakpoints 860px/560px.

## Core State

`GameState` owns seed; basic/treasure decks; hand; current revealed cards; split basic/treasure discards; owned treasures; selected IDs and material limit; phase 1..3; status; synthesis summary/runtime; effective colors; score ledger/modifiers; acquisition guarantees; retention requests/decisions; explosion protection; terminal score; pending basic draws and recycle counter.

`SynthesisSummary` is per-synthesis: material snapshot, color set, typed reveal plan and quotas, resolved counters, failure count, priority checkpoint markers, score, gained/failed/destroyed cards, last event.

`SynthesisSummary.score` is the evaluated running total, including applicable reveal-time modifiers. `resolveTreasure` writes the current evaluated score back before returning so acquisition checks and the visible `总分` share one core-owned value.

Current phase synthesis bonuses are 0/1/2 for phases 1/2/3. The full bundled catalog executes through the typed runtime; only whole-game persistence and animation remain outside the current capability boundary. Confirmed interfaces are documented in `docs/ai/CARD_EFFECTS.md`.

Active status path:

```text
createGame -> idle
idle + 4..materialLimit selected -> beginSynthesis
  -> runUntilBlocked (typed effects + fixed checkpoints)
  -> risk decision (if risk quota remains) -> resolveNextRisk repeatedly
  -> Priority 150+ retention decision/finalization and deferred basic draws -> idle
stage card during draw -> phase+1 and deterministic reshuffle
third stage encounter -> game-over
```

`finished`, `stagePromptVisible`, and `advanceStage` exist but are not reached by the active flow; stage advancement is automatic in `resolveStageCard`.

## Current Capability Boundary

Implemented: randomized displayed startup seeds with deterministic seeded dealing; 40-card basic deck; 80-card treasure deck plus stage prompt; typed effect specs for the full bundled catalog and deterministic Priority 0/50/100/150+ scheduling; statue initial-material limits with non-recursive extra slots; effective-color effects; score selectors, modifiers, multipliers, and conditional reveal scoring; safe/risk reveal-plan effects; acquisition guarantees and four gemstone effective-color acquisition conditions; explosion-loss prevention; Clay player retention and Amber automatic retention; inherent basic-card draw effects with split discard recycling and deferred completion; color-derived safe/risk quotas; score versus difficulty; staged treasure reshuffle; risk stop/continue; forced risk reveals and silver-flask preview; two-explosion handling; rare terminal score; workbook import/validation and workbook-to-snapshot alignment testing; imported catalog persistence; quantity-weighted difficulty statistics; responsive UI with in-use material feedback, evaluated total-score display, additional-acquisition text, and a concise card-agnostic settings rulebook.

Not implemented: whole-game save/resume/replay and animations. Prototype deck controls are display-only; drawing and revealing occur through the synthesis flow.

## Determinism

- Empty/blank seed normalizes to `royal-forge`.
- Browser startup adapts Web Crypto entropy to `RandomSource`, then `createRandomSeed` creates the displayed/editable initial seed. The core remains browser-independent.
- Initial basic and treasure decks share one seeded RNG stream.
- Stage reshuffle uses a fresh seed `${seed}:phase:${nextPhase}`.
- Basic discard recycling uses `${seed}:basic-recycle:${counter}` and persists the counter in `GameState`.
- Do not call `Math.random` in game logic.

## Catalog Flow

Bundled startup: `CardData.xlsm` -> `pnpm card-data:generate` -> generated JSON import -> `TreasureCatalogSchema.parse` -> `defaultTreasureDefinitions` -> `createGame`. The generator runs automatically before development, unit tests, and production builds, and uses the same row parser as browser imports.

Runtime import: `.xlsm/.xlsx` ArrayBuffer -> scan sheets -> locate required headers in first 10 rows -> map rows -> Zod -> IndexedDB database `synthesis-solo`, store `card-data`, key `active-catalog` -> recreate game with current seed. App startup hydrates this snapshot asynchronously. User-selected workbooks persist as explicit overrides. A reload of the bundled `CardData.xlsm` records the built-in catalog version it replaced; startup deletes that snapshot after a deployment changes the built-in version. Legacy snapshots named exactly `CardData.xlsm` are also discarded once so they cannot permanently mask updated authoring data.

Production packaging: Vite builds with the GitHub Pages base path `/AI-Synthesis/` and emits the root authoring workbook as `dist/CardData.xlsm`. `reloadBundledCardData` resolves the workbook through `import.meta.env.BASE_URL`, so the same browser flow works on GitHub Pages.

The optional workbook column `AdditionalAquireMethod` (authoring spelling) maps the four supported Chinese descriptions to `additionalAcquireMethod` for display and `additionalAcquireColor` for execution. `resolveTreasure` evaluates that typed color against every material's post-Priority-0 effective colors; no React component parses or executes the text.

`src/data/cardDataWorkbook.test.ts` reads `CardData.xlsm` directly and compares all authored runtime fields with the generated JSON, excluding the machine-only statue `effectCode`. It also reconciles 63 definitions and 80 physical cards. The shared parser supplies the centralized legacy statue effect code when the workbook has no `EffectCode` column.

Settings difficulty statistics group definitions by printed difficulty, weight each definition by `quantity`, and display rounded cumulative percentages over the active catalog.

Only imported catalog metadata/data persist. Current game state does not persist.
