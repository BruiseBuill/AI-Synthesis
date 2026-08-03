import { describe, expect, it } from "vitest";
import { createRandomSeed, createSeededRandom } from "./random";

describe("random seed generation", () => {
  it("is reproducible when supplied the same RandomSource", () => {
    expect(createRandomSeed(createSeededRandom("seed-source")))
      .toBe(createRandomSeed(createSeededRandom("seed-source")));
  });

  it("formats two random segments as a readable seed", () => {
    expect(createRandomSeed(() => 0)).toBe("forge-0000000-0000000");
  });
});
