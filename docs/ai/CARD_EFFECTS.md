# Card Effect Implementation Analysis

Snapshot: 2026-08-03. Status: the complete bundled catalog now compiles to typed specs and executes through the deterministic priority queue, including score, color, acquisition, explosion-prevention, and retention effects. Four revealed gemstones also carry typed effective-color acquisition policies outside material `effectSpecs`.

## Authority And Confirmed Semantics

- `CardData.xlsm` is authoritative for card names, effect text, Priority, quantity, printed score, and difficulty. When a named effect in `Rule.txt` conflicts with the workbook, update `Rule.txt` to match the workbook.
- The bundled `src/data/cardData.generated.json` must remain aligned with the workbook at 63 definitions and 80 physical cards.
- `AdditionalAquireMethod` is the workbook's current header spelling. Its four supported descriptions are executable data: White Jade/Sapphire/Yellow Gem/Red Gem require all materials to include W/B/Y/R after effective-color resolution.
- Phase synthesis bonuses are Phase 1 = 0, Phase 2 = 1, and Phase 3 = 2.
- Only the initial four materials can increase the material limit. An extra Statue does not increase the limit again, but all other effects on extra materials still participate and stack normally.
- All effects that change perceived material colors resolve before Priority 0. Priority 0 records the final effective colors. Later color-selecting effects such as Seal, Scepter, and Bell read those final effective colors, not printed colors.
- Score bonuses for basic cards, treasure cards, or colors modify each matching synthesis material exactly once; they do not also modify the treasure currently being revealed. Candlestick's safe-treasure bonus is the catalog's reveal-conditional score modifier.
- In Bell and Bronze Bell effect text, `基础分值` means a material card's original printed `synthesisScore`, regardless of whether the material is a basic card or a treasure card. It is unrelated to the `基础卡` card kind. Bell selects by that printed value and doubles only that base component, so earlier additive bonuses are preserved but not doubled.
- The workbook Hourglass effect is authoritative: add three optional risk reveals and convert all safe reveals to risk reveals. The stale Hourglass scoring text has been removed from `Rule.txt`.
- There is no Balance card in the current workbook or bundled catalog. The stale Balance chaining rule has been removed and must not be implemented unless authoring data adds that card.

## Current Executable Boundary

Actual behavior keeps `effect` as display-only authoring text and compiles `effectSpecs` into one `EffectInstance` per physical material without parsing that description. `buildSchedulerQueue` adds fixed Priority 0/50/100/150 checkpoints and sorts all entries deterministically. `runUntilBlocked` executes the queue until a risk decision, silver-flask preview, Clay retention decision, terminal game state, or finalization. Every bundled physical treasure has at least one typed spec; no-material-effect cards compile to `none`. Revealed gemstone acquisition reads `additionalAcquireColor` directly in `resolveTreasure` after Priority 0 has established effective colors.

`SynthesisSummary.checkpoints` now records the fixed queue checkpoints that have actually executed; it remains an observability view of the runtime queue, not a second execution mechanism.

## Score Test Kit

Use `src/game-core/score-test-kit.ts` to build a material-only synthesis and inspect each card's printed score, evaluated score, delta, phase bonus, global adjustment, multiplier, and total. It executes the real core scheduler and does not duplicate score rules.

```ts
const result = evaluateMaterialScore([
  getTreasureMaterial({ name: "印章", color: "B" }),
  getBasicMaterial({ color: "W", synthesisScore: 2, index: 0 }),
  getBasicMaterial({ color: "W", synthesisScore: 2, index: 1 }),
  getBasicMaterial({ color: "B", synthesisScore: 2 }),
]);

expect(result.materials.map((card) => card.evaluatedScore)).toEqual([3, 3, 3, 2]);
expect(result.totalScore).toBe(11);
```

Add quick score reproductions to `score-test-kit.test.ts` and run `pnpm test:score`. Use `asInertMaterial` or `getTreasureMaterial({ ..., inert: true })` when a comparison card's own effect must be disabled.

## Effect Inventory

The first ten rows describe all executable catalog surfaces across 63 treasure definitions and 80 treasure cards. Basic-card drawing is a separate inherent effect outside the workbook catalog.

| Semantic type | Definitions / cards | Cards | Required capability |
| --- | ---: | --- | --- |
| No material effect | 11 / 13 | Gold Block and eight rare treasures | Explicit `none` material spec; rare scoring/acquisition is evaluated when revealed or at game end |
| Material limit | 2 / 3 | Statue | Initial-four selection boundary and stackable extra slots |
| Effective color | 5 / 6 | Crystal, Jewel Box | Per-material effective color sets resolved before Priority 0 |
| Score modification | 18 / 20 | Candlestick, Ring, Goblet, Seal, Scepter, Golden Apple, Necklace, Bronze Bell, Bell | Score ledger, selectors, additive/multiplicative operations, reveal-conditional score |
| Safe reveal plan | 6 / 9 | Pottery Jar, Coral, Lantern | Base and bonus safe budgets plus color predicates |
| Risk reveal plan and interaction | 13 / 20 | Hourglass, Pocket Watch, Die, Vase, Cursed Box, Brooch, Silver Flask | Budget conversion/override, optional and forced reveals, preview decision |
| Acquisition override | 2 / 2 | Safe | Reveal index and pre-comparison acquisition policy |
| Revealed-card alternative acquisition | 4 / 4 | White Jade, Sapphire, Yellow Gem, Red Gem | Every material includes the target effective color after Priority 0 |
| Explosion modification | 1 / 1 | Incense Burner | Risk-failure event and loss-prevention policy |
| Material retention | 5 / 6 | Clay, Amber | Post-Priority-150 automatic retention and player selection |
| Inherent basic draw | 40 basic cards | Basic Material | Draw requests, discard recycling, deferred draws |

The workbook `category` values (`额外获得卡牌`, `额外加分`, and `其他效果`) are too broad for execution and remain display/authoring metadata only.

## Data Contract Status

Do not parse free-form Chinese effect text at runtime. The bundled JSON and Zod schema support an optional stable `effectCode`; the two statue rows carry `material-limit`. Existing `CardData.xlsm` has VBA and no machine-code column, so workbook imports use a centralized legacy registry for the exact `雕像` definition until the authoring workbook can be migrated without losing macros.

Additional acquisition uses paired fields: `additionalAcquireMethod` preserves the workbook text for display, while `additionalAcquireColor` is the executable `W|B|Y|R` condition. The importer maps only the four exact current descriptions from `AdditionalAquireMethod` and rejects unsupported phrases. The bundled alignment test compares these fields against the workbook; future acquisition forms need a new typed union rather than UI text parsing.

Recommended conceptual union:

```ts
type EffectSpec =
  | { type: "none" }
  | { type: "material-limit"; amount: number }
  | { type: "set-self-colors"; colors: MaterialColor[] }
  | { type: "set-all-colors"; color: MaterialColor }
  | { type: "modify-score"; selector: ScoreSelector; operation: ScoreOperation }
  | { type: "modify-reveal-plan"; operation: RevealPlanOperation }
  | { type: "guarantee-acquisition"; revealIndex: number }
  | { type: "prevent-explosion-loss"; explosionIndex: number }
  | { type: "retain-materials"; selector: RetentionSelector; count?: number };
```

Each physical material card creates its own `EffectInstance` containing source card ID, Priority, material position, and typed spec. Do not deduplicate instances by definition: identical effects stack once per material card.

## Proposed Core Interfaces

### Material Selection

Represent initial and extra materials separately:

```ts
interface MaterialSelection {
  initialIds: string[];
  extraIds: string[];
  extraLimit: number;
}
```

Selection queries should replace hard-coded UI checks: `canSelectMaterial`, `canRemoveMaterial`, and `canBeginSynthesis`. Material-limit effects inspect only `initialIds`; all other compiled effects inspect both lists.

### Synthesis Runtime

Separate mutable runtime decisions from the display summary:

```ts
interface SynthesisRuntime {
  step: SynthesisStep;
  materials: MaterialSelection;
  effects: EffectInstance[];
  effectiveColors: Record<string, MaterialColor[]>;
  score: ScoreLedger;
  revealPlan: RevealPlan;
  pendingDecision: PendingDecision | null;
}
```

`ScoreLedger` must preserve printed per-card scores, effective-color selectors, ordered modifier results, phase bonus, total multipliers, and conditional score used for the current reveal. This is required for Bronze Bell thresholds, Bell's highest-card selection, Necklace doubling, and Candlestick's safe-only bonus.

`RevealPlan` must not collapse to only `safeQuota` and `riskQuota`. It must retain base/bonus/resolved counts, safe/risk conversions, optional versus forced risk budgets, a hard override for Brooch, and Silver Flask preview state.

### Scheduler And Decisions

Implemented: `runUntilBlocked(state)` sorts effect instances deterministically by Priority, source material position, effect index, and source card ID; fixed checkpoints sort after effects at the same priority. Reveal-plan effects execute through Priority 0/50/100, with forced risk and silver-flask preview represented in the pending decision.

Use a typed decision API instead of a risk boolean:

```ts
type PendingDecision =
  | { type: "risk-reveal"; preview: GameCard | null; forced: boolean }
  | { type: "retain-materials"; candidateIds: string[]; count: number };

type SynthesisDecision =
  | { type: "continue-risk" }
  | { type: "stop-risk" }
  | { type: "accept-preview" }
  | { type: "reject-preview" }
  | { type: "select-retained-materials"; cardIds: string[] };
```

Implemented: core exposes `submitSynthesisDecision` for risk/preview/retention decisions, while the store retains its UI-oriented wrappers. React renders pending decision state and does not calculate quotas, colors, score, material limits, or acquisition conditions.

### Reveal And Acquisition Events

Current `resolveTreasure` evaluates acquisition in this order-equivalent union: material guarantee, revealed card's typed effective-color condition, or score at least difficulty. A successful alternative condition does not count as a risk failure and therefore cannot trigger an explosion. A failed condition falls through to the normal safe/risk failure path.

Implemented: stage prompts consume no reveal budget, and `runUntilBlocked` continues through a non-terminal stage prompt until the interrupted safe, risk, or extra reveal is fulfilled.

### Material Finalization And Basic Draws

Implemented: Priority 150 begins finalization without immediately discarding every material. Automatic Amber retention resolves first, Clay can pause for a player choice, retained cards return to hand, and remaining materials then move to their destinations.

Implemented for the inherent basic draw: basic and treasure discards are separate; basic effects create requests before current materials enter discard; insufficient requests are stored in `pendingBasicDraws`; Priority 150 finalization discards active materials, deterministically reshuffles with `RandomSource` and the persisted recycle counter, then fulfills the remainder.

## Recommended Construction Batches

1. Migrate legacy name-based material effects and the four acquisition phrases to stable authoring codes/parameters without losing workbook VBA.
2. Complete whole-game persistence/replay.
3. Remove or activate inactive legacy stage UI actions through the canonical automatic stage flow.

Each batch requires focused Vitest examples for every operation and stacking/priority interactions. Preserve or add fast-check determinism invariants. Add Playwright workflows for extra material selection, Silver Flask preview rejection, forced Cursed Box reveals, and Clay retention. Before each handoff run `pnpm test`, `pnpm build`, and `pnpm test:e2e` for UI/data-flow batches.
