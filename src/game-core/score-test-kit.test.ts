import { describe, expect, it } from "vitest";
import {
  evaluateMaterialScore,
  formatMaterialScore,
  getBasicMaterial,
  getTreasureMaterial,
} from "./score-test-kit";

describe("score test kit", () => {
  it("reports printed and evaluated scores for a simple synthesis", () => {
    const materials = [
      getBasicMaterial({ color: "R", synthesisScore: 1 }),
      getBasicMaterial({ color: "Y", synthesisScore: 1 }),
      getBasicMaterial({ color: "B", synthesisScore: 2 }),
      getBasicMaterial({ color: "W", synthesisScore: 2 }),
    ];

    const result = evaluateMaterialScore(materials);

    expect(result.printedMaterialTotal).toBe(6);
    expect(result.evaluatedMaterialTotal).toBe(6);
    expect(result.totalScore).toBe(6);
    expect(result.materials.every((row) => row.delta === 0)).toBe(true);
  });

  it("makes the seal 3+3+3+2 score scenario directly inspectable", () => {
    const materials = [
      getTreasureMaterial({ name: "印章", color: "B" }),
      getBasicMaterial({ color: "W", synthesisScore: 2, index: 0 }),
      getBasicMaterial({ color: "W", synthesisScore: 2, index: 1 }),
      getBasicMaterial({ color: "B", synthesisScore: 2 }),
    ];

    const result = evaluateMaterialScore(materials);

    expect(result.materials.map((row) => row.evaluatedScore)).toEqual([3, 3, 3, 2]);
    expect(result.totalScore).toBe(11);
    expect(formatMaterialScore(result)).toContain("materials 11 + phase 0 + adjustment 0, x1 = total 11");
  });
});
