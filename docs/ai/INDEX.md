# Synthesis-Solo AI Knowledge Base

This file is the entry point and routing map for repository knowledge. Keep detailed behavior, debugging outcomes, commands, status, and history in their owning topic files rather than here.

## Start Here

1. Read this index before changing the repository.
2. Select only the topic files required by the task from the routing table below.
3. For any debugging task, also read `docs/ai/DEBUGGING.md` before investigation and update it before handoff.
4. Before validation, classify the task as Level 1, 2, or 3 using `docs/ai/MAINTENANCE.md`.

## Task Routing

| Task | Required knowledge | Primary implementation and validation |
| --- | --- | --- |
| Score, color, Priority, material effects, reveal order | `docs/ai/CARD_EFFECTS.md` | `src/game-core/effects.ts`, `src/game-core/game.ts`, focused core tests; use `score-test-kit.ts` for material-score scenarios |
| General game state transition, store data flow, module ownership, capability status | `docs/ai/ARCHITECTURE.md` | Owning core/store module and focused tests |
| UI interaction, layout, Zustand-to-React behavior | `docs/ai/ARCHITECTURE.md`, then UI guidance in `docs/ai/MAINTENANCE.md` | `src/App.tsx`, components, styles, and focused Playwright tests |
| Workbook, generated catalog, import, or persistence | `docs/ai/REFERENCES.md`, then data guidance in `docs/ai/MAINTENANCE.md` | Owning `src/data/*` modules, alignment tests, and relevant browser flow |
| Bug investigation, reproduction, root cause, or diagnostic tooling | `docs/ai/DEBUGGING.md`, plus the affected topic above | Narrowest reproducer first; record the reusable outcome before handoff |
| Commands, task level, invariants, known risks, or handoff gate | `docs/ai/MAINTENANCE.md` | Run the gate required by the highest applicable level |

## Knowledge Map

- `docs/ai/ARCHITECTURE.md`: dependency direction, module ownership, state and data flow, determinism, and current capability boundary.
- `docs/ai/CARD_EFFECTS.md`: executable effect semantics, scheduling, score behavior, and effect implementation status.
- `docs/ai/REFERENCES.md`: product, rule, workbook, generated-data, executable, and tooling reference locations.
- `docs/ai/DEBUGGING.md`: mandatory debugging workflow and durable diagnostic findings.
- `docs/ai/MAINTENANCE.md`: invariants, change map, task levels, commands, validation gates, risks, and construction order.

## Source Authority

- Actual behavior: `src/**` plus passing tests.
- Intended complete rules: `Rule.txt` (UTF-8 Chinese).
- Card authoring data: `CardData.xlsm`; bundled runtime snapshot: `src/data/cardData.generated.json`.
- Card names, effects, Priority, quantity, printed score, and difficulty follow `CardData.xlsm` when a named example in `Rule.txt` conflicts with it.
- `Construction.txt` is an early target-stack note; parts are aspirational and are not implementation-status evidence.

When sources conflict, describe both `actual` and `intended`; never merge them implicitly.

## Index Maintenance

Update this file only when routing, knowledge ownership, or source authority changes. Do not add debugging transcripts, commands, validation results, capability inventories, or chronological issue entries here.
