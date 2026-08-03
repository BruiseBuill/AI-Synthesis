# Reference Index

## Product/Rules/Data

- `Rule.txt`: intended complete rules; sections: basics, decks/initial hand, synthesis, safe/risk treasure, explosions, stage progression, card data.
- `CardData.xlsm`: authoring workbook. One sheet `Sheet4`; used range/table `A1:Q64`; header + 63 definitions; 80 cards total.
- `docs/ai/CARD_EFFECTS.md`: confirmed effect semantics, complete effect inventory, current executable gaps, and proposed implementation interfaces/batches.
- `Construction.txt`: original recommended stack/features. Do not treat IndexedDB game saves, replay, or animation entries as implemented.
- `src/data/cardData.generated.json`: bundled runtime catalog snapshot; 63 definitions/80 cards, explicit `effectCode` on statue definitions, and display/typed additional-acquisition fields on four gemstones.

Workbook importer requires headers `代号`, `颜色`, `数量`, `卡面分值`, `效果`, `最终难度`; optional consumed headers: `Priority`, `类别`, `EffectCode`, and the workbook-authored spelling `AdditionalAquireMethod`. Colors: `W|B|Y|R|Special`. The four supported additional-acquisition texts map exactly to `W/B/Y/R`; unknown text is rejected. Known rare names override workbook difficulty in `cardDataImport.ts`.

Current bundled difficulty counts by physical card are: 4:8, 5:19, 6:6, 7:9, 8:5, 9:8, 10:3, 11:3, 12:4, 13:2, 14:3, 15:2, 16:4, 18:3, 20:1.

Current bundled distribution: W 10 definitions/17 cards; B 10/17; Y 17/19; R 18/19; Special 8/8.

## Executable References

- Application entry: `index.html`, `src/main.tsx`, `src/App.tsx`.
- Rules/state/decks/RNG: `src/game-core/`.
- Effect specs/instances/priority queue: `src/game-core/effects.ts`.
- Catalog validation/import/persistence: `src/data/`.
- Store/application actions: `src/store/gameStore.ts`.
- UI pieces/styles: `src/components/`, `src/styles.css`; `SettingsDialog.tsx` owns catalog controls and the concise basic-rule view.
- Unit/property behavior evidence: `src/game-core/game.test.ts`, `src/game-core/effects.test.ts`, `src/game-core/random.test.ts`, `src/data/cardData.test.ts`, `src/data/cardDataImport.test.ts`, `src/data/cardDataWorkbook.test.ts`.
- Browser behavior evidence: `e2e/game.spec.ts`, including total-score display, settings rulebook navigation, and absence of direct deck-action buttons.

## Tooling References

- Scripts/dependency ranges: `package.json`; exact resolution: `pnpm-lock.yaml`.
- TS strictness: `tsconfig.app.json`; build aggregation: `tsconfig.json`/`tsconfig.node.json`.
- Vite and production workbook packaging: `vite.config.ts`; Vitest: `vitest.config.ts`; development Playwright: `playwright.config.ts`; deployed-build smoke coverage: `playwright.deployment.config.ts` and `deployment-e2e/pages.spec.ts`.
- GitHub Pages deployment: `.github/workflows/deploy-pages.yml`; pushes to `main` build and publish `dist`.
- Generated/ephemeral: `dist/`, `test-results/`, `playwright-report/`, `node_modules/`, `*.tsbuildinfo`; never use as source of truth.

## Update Triggers

- Update `INDEX.md` for stack/capability/status changes.
- Update `ARCHITECTURE.md` for module/data/state-flow changes.
- Update `MAINTENANCE.md` for invariants, gaps, commands, or construction order changes.
- Update this file for moved/new reference material or workbook contract changes.
