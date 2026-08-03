# AI Repository Instructions

Read `docs/ai/INDEX.md` before changing this repository. Load only the linked topic file needed for the task.

Hard constraints:
- Classify every task as Level 1, 2, or 3 using `docs/ai/MAINTENANCE.md` before validation. Mixed changes use the highest applicable level.
- Keep game rules in `src/game-core/`; it must not import React, Zustand, DOM, or browser persistence APIs.
- Treat current code/tests as actual behavior and `Rule.txt` as intended full behavior. Do not claim an item from `Rule.txt` is implemented without tracing code/tests.
- Treat `CardData.xlsm` as authoring data and `src/data/cardData.generated.json` as the bundled runtime snapshot. Keep their 63 definitions / 80 cards aligned.
- Card effects and priorities are mostly descriptive data today; do not silently encode new effects in UI components.
- Preserve seeded determinism. Any randomness must enter through `RandomSource`/`createSeededRandom` and have tests.
- Add or update Vitest tests for rule changes. Add Playwright tests when a user workflow, rendered output, store/UI contract, or browser data flow changes.
- During debugging, run the narrowest relevant test. Before handoff, use the command gate for the classified level in `docs/ai/MAINTENANCE.md`; core-only rule changes with an unchanged store/UI contract do not require Playwright.
- For every debugging task, also read `docs/ai/DEBUGGING.md` before investigation. A debugging task is not complete until `DEBUGGING.md` has been updated with the reusable outcome; update the owning topic file too when module ownership, commands, data contracts, invariants, risks, or implementation status changed.
- Keep `docs/ai/INDEX.md` as navigation only. Never add debugging transcripts, command-by-command logs, or issue histories to it.
