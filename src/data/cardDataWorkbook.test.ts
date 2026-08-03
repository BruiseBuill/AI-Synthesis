import { resolve } from "node:path";
import { readSheet } from "read-excel-file/node";
import { describe, expect, it } from "vitest";
import { defaultTreasureDefinitions, type TreasureDefinition } from "./cardData";
import { parseCardDataRows } from "./cardDataImport";

function withoutMachineOnlyFields(definitions: readonly TreasureDefinition[]) {
  return definitions.map(({ effectCode: _effectCode, ...definition }) => JSON.parse(JSON.stringify(definition)));
}

describe("bundled CardData workbook alignment", () => {
  it("matches the generated 63-definition, 80-card runtime snapshot", async () => {
    const workbookPath = resolve("CardData.xlsm");
    const rows = await readSheet(workbookPath, "Sheet4");
    const workbookDefinitions = parseCardDataRows(rows as unknown as Parameters<typeof parseCardDataRows>[0]);

    expect(withoutMachineOnlyFields(workbookDefinitions)).toEqual(withoutMachineOnlyFields(defaultTreasureDefinitions));
    expect(workbookDefinitions).toHaveLength(63);
    expect(workbookDefinitions.reduce((total, definition) => total + definition.quantity, 0)).toBe(80);
  });
});
