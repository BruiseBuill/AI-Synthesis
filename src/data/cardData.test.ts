import { describe, expect, it } from "vitest";
import { defaultTreasureDefinitions, getDifficultyStats } from "./cardData";

describe("difficulty statistics", () => {
  it("counts physical cards and rounds cumulative percentages", () => {
    const stats = getDifficultyStats(defaultTreasureDefinitions);

    expect(stats).toHaveLength(15);
    expect(stats[0]).toEqual({ difficulty: 4, count: 8, cumulativePercentage: 10 });
    expect(stats[1]).toEqual({ difficulty: 5, count: 19, cumulativePercentage: 34 });
    expect(stats.at(-1)).toEqual({ difficulty: 20, count: 1, cumulativePercentage: 100 });
    expect(stats.reduce((total, item) => total + item.count, 0)).toBe(80);
  });

  it("keeps the four gemstone acquisition methods in the bundled catalog", () => {
    expect(defaultTreasureDefinitions.filter((definition) => definition.additionalAcquireMethod)).toEqual([
      expect.objectContaining({ name: "白玉", additionalAcquireMethod: "所有的卡都为白色", additionalAcquireColor: "W" }),
      expect.objectContaining({ name: "蓝宝石", additionalAcquireMethod: "所有的卡都为蓝色", additionalAcquireColor: "B" }),
      expect.objectContaining({ name: "黄宝石", additionalAcquireMethod: "所有的卡都为黄色", additionalAcquireColor: "Y" }),
      expect.objectContaining({ name: "红宝石", additionalAcquireMethod: "所有的卡都为红色", additionalAcquireColor: "R" }),
    ]);
  });
});
