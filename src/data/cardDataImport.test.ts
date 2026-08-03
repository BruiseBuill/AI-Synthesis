import { describe, expect, it } from "vitest";
import { parseCardDataRows } from "./cardDataImport";

const headers = ["代号", "颜色", "Priority", "类别", "效果", "数量", "卡面分值", "最终难度"];

describe("CardData row import", () => {
  it("retains the legacy machine effect for statue rows without an EffectCode column", () => {
    const [definition] = parseCardDataRows([
      ["代号", "颜色", "数量", "卡面分值", "效果", "最终难度", "Priority", "类别"],
      ["雕像", "Y", 2, 2, "合成时可以额外增加一张牌", 4, -5, "其他效果"],
    ]);

    expect(definition.effectCode).toBe("material-limit");
  });

  it("maps effects and keeps empty priorities as null", () => {
    const [definition] = parseCardDataRows([
      headers,
      ["金块", "B", null, "其他效果", "无特效", 3, 4, 5],
    ]);

    expect(definition).toMatchObject({
      name: "金块",
      color: "B",
      priority: null,
      effect: "无特效",
      quantity: 3,
      synthesisScore: 4,
      difficulty: 5,
    });
  });

  it("uses the authored difficulty for rare treasures without name-based overrides", () => {
    const [definition] = parseCardDataRows([
      headers,
      ["金杯", "Special", null, null, "无特效", 1, 0, 17],
    ]);

    expect(definition.difficulty).toBe(17);
  });

  it("rejects sheets without the required CardData headers", () => {
    expect(() => parseCardDataRows([["名称", "数量"], ["陶罐", 1]])).toThrow("找不到表头");
  });

  it("reads an optional machine effect code when a workbook provides one", () => {
    const codedHeaders = [...headers, "EffectCode"];
    const [definition] = parseCardDataRows([
      codedHeaders,
      ["雕像", "Y", -5, "其他效果", "合成时可以额外增加一张牌", 2, 2, 4, "material-limit"],
    ]);

    expect(definition.effectCode).toBe("material-limit");
  });

  it("maps the workbook's additional acquisition text to a typed color condition", () => {
    const additionalHeaders = [
      "代号",
      "颜色",
      "Priority",
      "AdditionalAquireMethod",
      "类别",
      "效果",
      "数量",
      "卡面分值",
      "最终难度",
    ];
    const [definition] = parseCardDataRows([
      additionalHeaders,
      ["红宝石", "Special", null, "所有的卡都为红色", null, "终局分数加3", 1, 0, 16],
    ]);

    expect(definition).toMatchObject({
      additionalAcquireMethod: "所有的卡都为红色",
      additionalAcquireColor: "R",
    });
  });

  it("rejects additional acquisition text without an executable mapping", () => {
    const additionalHeaders = [...headers.slice(0, 3), "AdditionalAquireMethod", ...headers.slice(3)];
    expect(() => parseCardDataRows([
      additionalHeaders,
      ["测试稀有", "Special", null, "任意条件", null, "终局分数加3", 1, 0, 16],
    ])).toThrow("额外获取方式尚未支持");
  });
});
