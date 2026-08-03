# Synthesis-Solo AI Knowledge Base

This file is the entry point and routing map for repository knowledge. Keep detailed behavior, debugging outcomes, commands, status, and history in their owning topic files rather than here.

## Start Here

1. Read this index before changing the repository.
2. Select only the topic files required by the task from the routing table below.

## Task Routing

| Task | Required knowledge | Primary implementation |
| --- | --- | --- |
| Score, color, Priority, material effects, reveal order | `docs/ai/CARD_EFFECTS.md` | `src/game-core/effects.ts`, `src/game-core/game.ts` |
| General game state transition, store data flow, module ownership, capability status | `docs/ai/ARCHITECTURE.md` | Owning core/store module |
| UI interaction, layout, Zustand-to-React behavior | `docs/ai/ARCHITECTURE.md`, then UI guidance in `docs/ai/MAINTENANCE.md` | `src/App.tsx`, components, styles |
| Workbook, generated catalog, import, or persistence | `docs/ai/REFERENCES.md`, then data guidance in `docs/ai/MAINTENANCE.md` | Owning `src/data/*` modules |
| Bug investigation, reproduction, root cause, or diagnostic tooling | `docs/ai/DEBUGGING.md`, plus the affected topic above | Narrowest reproducer first |
| Commands, invariants, known risks, or construction order | `docs/ai/MAINTENANCE.md` | Follow the change map and construction order |

## Knowledge Map

- `docs/ai/ARCHITECTURE.md`: dependency direction, module ownership, state and data flow, determinism, and current capability boundary.
- `docs/ai/CARD_EFFECTS.md`: executable effect semantics, scheduling, score behavior, and effect implementation status.
- `docs/ai/REFERENCES.md`: product, rule, workbook, generated-data, executable, and tooling reference locations.
- `docs/ai/DEBUGGING.md`: durable diagnostic findings for future reference.
- `docs/ai/MAINTENANCE.md`: invariants, change map, commands, known risks, and construction order.

## Source Authority

- Actual behavior: `src/**` plus passing tests.
- Intended complete rules: `Rule.txt` (UTF-8 Chinese).
- Card authoring data: `CardData.xlsm`; bundled runtime snapshot: `src/data/cardData.generated.json`.
- Card names, effects, Priority, quantity, printed score, and difficulty follow `CardData.xlsm` when a named example in `Rule.txt` conflicts with it.
- `Construction.txt` is an early target-stack note; parts are aspirational and are not implementation-status evidence.

When sources conflict, describe both `actual` and `intended`; never merge them implicitly.

## Index Maintenance

Update this file only when routing, knowledge ownership, or source authority changes. Do not add debugging transcripts, commands, validation results, capability inventories, or chronological issue entries here.
