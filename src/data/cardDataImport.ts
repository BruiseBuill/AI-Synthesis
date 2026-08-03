import { TreasureCatalogSchema, type CardColor, type MaterialColor, type TreasureDefinition } from "./cardData";

type SpreadsheetCell = string | number | boolean | Date | null | undefined;

const requiredHeaders = ["代号", "颜色", "数量", "卡面分值", "效果", "最终难度"] as const;
const rareDifficulties: Readonly<Record<string, number>> = {
  白玉: 16,
  蓝宝石: 16,
  黄宝石: 16,
  红宝石: 16,
  印玺: 18,
  王冠: 18,
  金玫瑰: 18,
  金杯: 20,
};
const additionalAcquireColors: Readonly<Record<string, MaterialColor>> = {
  所有的卡都为白色: "W",
  所有的卡都为蓝色: "B",
  所有的卡都为黄色: "Y",
  所有的卡都为红色: "R",
};

function asText(value: SpreadsheetCell, field: string, rowNumber: number): string {
  const text = value == null ? "" : String(value).trim();
  if (!text) throw new Error(`第 ${rowNumber} 行缺少“${field}”`);
  return text;
}

function asInteger(value: SpreadsheetCell, field: string, rowNumber: number): number {
  const number = typeof value === "number" ? value : Number(value);
  if (!Number.isInteger(number)) throw new Error(`第 ${rowNumber} 行的“${field}”必须是整数`);
  return number;
}

function asOptionalInteger(value: SpreadsheetCell, field: string, rowNumber: number): number | null {
  return value == null || value === "" ? null : asInteger(value, field, rowNumber);
}

function findHeaderRow(rows: SpreadsheetCell[][]): number {
  const index = rows.slice(0, 10).findIndex((row) => requiredHeaders.every((header) => row.includes(header)));
  if (index < 0) throw new Error(`找不到表头：${requiredHeaders.join("、")}`);
  return index;
}

export function parseCardDataRows(rows: SpreadsheetCell[][]): TreasureDefinition[] {
  const headerRowIndex = findHeaderRow(rows);
  const headers = rows[headerRowIndex].map((cell) => String(cell ?? "").trim());
  const column = (name: string) => headers.indexOf(name);

  const parsed = rows.slice(headerRowIndex + 1).flatMap((row, index) => {
    const rowNumber = headerRowIndex + index + 2;
    const nameCell = row[column("代号")];
    const colorCell = row[column("颜色")];
    if ((nameCell == null || nameCell === "") && (colorCell == null || colorCell === "")) return [];

    const name = asText(nameCell, "代号", rowNumber);
    const color = asText(colorCell, "颜色", rowNumber) as CardColor;
    const rawDifficulty = asInteger(row[column("最终难度")], "最终难度", rowNumber);
    const difficulty = color === "Special" ? (rareDifficulties[name] ?? rawDifficulty) : rawDifficulty;
    const additionalAcquireMethod = column("AdditionalAquireMethod") < 0
      || row[column("AdditionalAquireMethod")] == null
      || row[column("AdditionalAquireMethod")] === ""
      ? undefined
      : String(row[column("AdditionalAquireMethod")]).trim();
    const additionalAcquireColor = additionalAcquireMethod == null
      ? undefined
      : additionalAcquireColors[additionalAcquireMethod];
    if (additionalAcquireMethod && !additionalAcquireColor) {
      throw new Error(`第 ${rowNumber} 行的额外获取方式尚未支持：${additionalAcquireMethod}`);
    }

    return [{
      name,
      color,
      priority: asOptionalInteger(row[column("Priority")], "Priority", rowNumber),
      category: row[column("类别")] == null || row[column("类别")] === ""
        ? null
        : String(row[column("类别")]).trim(),
      effect: asText(row[column("效果")], "效果", rowNumber),
      effectCode: column("EffectCode") < 0 || row[column("EffectCode")] == null || row[column("EffectCode")] === ""
        ? undefined
        : String(row[column("EffectCode")]).trim(),
      additionalAcquireMethod,
      additionalAcquireColor,
      quantity: asInteger(row[column("数量")], "数量", rowNumber),
      synthesisScore: asInteger(row[column("卡面分值")], "卡面分值", rowNumber),
      difficulty,
    }];
  });

  const result = TreasureCatalogSchema.safeParse(parsed);
  if (!result.success) {
    const issue = result.error.issues[0];
    throw new Error(`卡牌数据校验失败：${issue?.message ?? "未知错误"}`);
  }
  return result.data;
}

export async function parseCardDataWorkbook(buffer: ArrayBuffer): Promise<TreasureDefinition[]> {
  const { default: readExcelFile } = await import("read-excel-file/browser");
  let sheets;
  try {
    sheets = await readExcelFile(buffer);
  } catch {
    throw new Error("无法读取该文件，请选择有效的 CardData.xlsm");
  }

  for (const sheet of sheets) {
    try {
      return parseCardDataRows(sheet.data as SpreadsheetCell[][]);
    } catch (error) {
      if (!(error instanceof Error) || !error.message.startsWith("找不到表头")) throw error;
    }
  }
  throw new Error("工作簿中没有找到卡牌数据表");
}
