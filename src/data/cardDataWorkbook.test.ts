import { resolve } from "node:path";
import { readSheet } from "read-excel-file/node";
import { describe, expect, it } from "vitest";
import { defaultTreasureDefinitions, type TreasureDefinition } from "./cardData";
import { parseCardDataRows } from "./cardDataImport";

function withoutMachineOnlyFields(definitions: readonly TreasureDefinition[]) {
  return definitions.map(({ effectCode: _effectCode, ...definition }) => JSON.parse(JSON.stringify(definition)));
}

function authoredMutableFields(rows: unknown[][]) {
  const requiredHeaders = ["代号", "颜色", "数量", "卡面分值", "效果", "最终难度"];
  const headerRowIndex = rows.slice(0, 10).findIndex((row) => requiredHeaders.every((header) => row.includes(header)));
  const headers = rows[headerRowIndex];
  const column = (header: string) => headers.indexOf(header);

  return rows.slice(headerRowIndex + 1).flatMap((row) => {
    if (!row[column("代号")] && !row[column("颜色")]) return [];
    return [{
      name: String(row[column("代号")]).trim(),
      color: String(row[column("颜色")]).trim(),
      effect: String(row[column("效果")]).trim(),
      quantity: Number(row[column("数量")]),
      synthesisScore: Number(row[column("卡面分值")]),
      difficulty: Number(row[column("最终难度")]),
    }];
  });
}

describe("bundled CardData workbook alignment", () => {
  it("matches the generated 63-definition, 80-card runtime snapshot", async () => {
    const workbookPath = resolve("CardData.xlsm");
    const rows = await readSheet(workbookPath, "Sheet4");
    const workbookDefinitions = parseCardDataRows(rows as unknown as Parameters<typeof parseCardDataRows>[0]);

    expect(withoutMachineOnlyFields(workbookDefinitions)).toEqual(withoutMachineOnlyFields(defaultTreasureDefinitions));
    expect(defaultTreasureDefinitions.map((definition) => ({
      name: definition.name,
      color: definition.color,
      effect: definition.effect,
      quantity: definition.quantity,
      synthesisScore: definition.synthesisScore,
      difficulty: definition.difficulty,
    }))).toEqual(authoredMutableFields(rows as unknown[][]));
    expect(workbookDefinitions).toHaveLength(63);
    expect(workbookDefinitions.reduce((total, definition) => total + definition.quantity, 0)).toBe(80);
  });
});
