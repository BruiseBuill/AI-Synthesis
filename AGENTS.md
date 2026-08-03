# AI Repository Instructions

Read `docs/ai/INDEX.md` before changing this repository. Load only the linked topic file needed for the task.

Hard constraints:
- Keep game rules in `src/game-core/`; it must not import React, Zustand, DOM, or browser persistence APIs.
- Treat current code as actual behavior and `Rule.txt` as intended full behavior. Do not claim an item from `Rule.txt` is implemented without tracing code.
- Treat `CardData.xlsm` as authoring data and `src/data/cardData.generated.json` as the bundled runtime snapshot. Keep their 63 definitions / 80 cards aligned.
- Card effects and priorities are mostly descriptive data today; do not silently encode new effects in UI components.
- Preserve seeded determinism. Any randomness must enter through `RandomSource`/`createSeededRandom`.
- Keep `docs/ai/INDEX.md` as navigation only. Never add debugging transcripts, command-by-command logs, or issue histories to it.

Validation:
- Codex does not run tests, builds, or any verification gate. All validation is performed by the user.
