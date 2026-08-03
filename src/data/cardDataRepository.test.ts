import { describe, expect, it } from "vitest";
import { defaultTreasureDefinitions } from "./cardData";
import { isSnapshotCurrent, type CardDataSnapshot } from "./cardDataRepository";

function snapshot(source: CardDataSnapshot["source"]): CardDataSnapshot {
  return { definitions: defaultTreasureDefinitions, source };
}

describe("card data snapshot freshness", () => {
  it("keeps a bundled reload only while its built-in base version is current", () => {
    const bundled = snapshot({
      type: "bundled",
      fileName: "CardData.xlsm",
      importedAt: "2026-08-03T00:00:00.000Z",
      builtInVersion: "catalog-a",
    });

    expect(isSnapshotCurrent(bundled, "catalog-a")).toBe(true);
    expect(isSnapshotCurrent(bundled, "catalog-b")).toBe(false);
  });

  it("invalidates legacy bundled reloads but preserves explicitly imported workbooks", () => {
    const legacyBundled = snapshot({
      type: "imported",
      fileName: "CardData.xlsm",
      importedAt: "2026-08-03T00:00:00.000Z",
    });
    const customImport = snapshot({
      type: "imported",
      fileName: "my-cards.xlsm",
      importedAt: "2026-08-03T00:00:00.000Z",
    });

    expect(isSnapshotCurrent(legacyBundled, "catalog-b")).toBe(false);
    expect(isSnapshotCurrent(customImport, "catalog-b")).toBe(true);
  });
});
