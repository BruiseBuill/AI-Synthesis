import { describe, expect, it } from "vitest";
import { defaultTreasureDefinitions, getDifficultyStats, type TreasureDefinition } from "./cardData";

function definition(difficulty: number, quantity: number): TreasureDefinition {
  return {
    name: `难度 ${difficulty}`,
    color: "W",
    priority: null,
    category: null,
    effect: "无特效",
    quantity,
    synthesisScore: 0,
    difficulty,
  };
}

describe("difficulty statistics", () => {
  it("counts physical cards and rounds cumulative percentages", () => {
    const stats = getDifficultyStats([
      definition(11, 3),
      definition(5, 2),
      definition(7, 1),
    ]);

    expect(stats).toEqual([
      { difficulty: 5, count: 2, cumulativePercentage: 33 },
      { difficulty: 7, count: 1, cumulativePercentage: 50 },
      { difficulty: 11, count: 3, cumulativePercentage: 100 },
    ]);
  });

  it("keeps the four gemstone acquisition methods in the bundled catalog", () => {
    expect(defaultTreasureDefinitions
      .filter((definition) => definition.additionalAcquireMethod)
      .map(({ additionalAcquireMethod, additionalAcquireColor }) => ({ additionalAcquireMethod, additionalAcquireColor })))
      .toEqual([
      { additionalAcquireMethod: "所有的卡都为白色", additionalAcquireColor: "W" },
      { additionalAcquireMethod: "所有的卡都为蓝色", additionalAcquireColor: "B" },
      { additionalAcquireMethod: "所有的卡都为黄色", additionalAcquireColor: "Y" },
      { additionalAcquireMethod: "所有的卡都为红色", additionalAcquireColor: "R" },
    ]);
  });
});
