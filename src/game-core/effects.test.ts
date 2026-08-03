import { describe, expect, it } from "vitest";
import { buildBasicDeck, buildTreasureDeck, type GameCard } from "./cards";
import {
  buildSchedulerQueue,
  compileTreasureEffectSpecs,
  createEffectInstances,
} from "./effects";

describe("effect compilation", () => {
  it("assigns a typed spec to every bundled physical treasure card", () => {
    expect(buildTreasureDeck().every((card) => card.effectSpecs.length > 0)).toBe(true);
  });

  it("compiles both explicit and legacy statue definitions without reading effect text", () => {
    expect(compileTreasureEffectSpecs("任意名称", "material-limit")).toEqual([
      { type: "material-limit", amount: 1 },
    ]);
    expect(compileTreasureEffectSpecs("雕像")).toEqual([
      { type: "material-limit", amount: 1 },
    ]);
    expect(compileTreasureEffectSpecs("雕像改名后")).toEqual([]);
  });

  it("compiles the reveal-plan effects from the catalog by card name", () => {
    expect(compileTreasureEffectSpecs("陶罐")).toEqual([
      { type: "modify-reveal-plan", operation: { type: "add-safe", amount: 1 } },
    ]);
    expect(compileTreasureEffectSpecs("珊瑚")[0]).toEqual({
      type: "modify-reveal-plan",
      operation: { type: "add-safe", amount: 2, condition: "four-colors" },
    });
    expect(compileTreasureEffectSpecs("提灯")[0]).toEqual({
      type: "modify-reveal-plan",
      operation: { type: "add-safe", amount: 2, condition: "same-color" },
    });
    expect(compileTreasureEffectSpecs("沙漏")).toHaveLength(2);
    expect(compileTreasureEffectSpecs("怀表")[0]).toMatchObject({ operation: { type: "convert-risk-to-safe" } });
    expect(compileTreasureEffectSpecs("骰子")[0]).toMatchObject({ operation: { type: "add-risk", amount: 1 } });
    expect(compileTreasureEffectSpecs("宝瓶")[0]).toMatchObject({ operation: { type: "add-risk", amount: 2 } });
    expect(compileTreasureEffectSpecs("诅咒盒")).toHaveLength(2);
    expect(compileTreasureEffectSpecs("胸针")[0]).toMatchObject({ operation: { type: "override-risk", amount: 4 } });
    expect(compileTreasureEffectSpecs("银壶")[0]).toMatchObject({ operation: { type: "preview-risk" } });
  });

  it("compiles base-score wording as printed-score operations", () => {
    expect(compileTreasureEffectSpecs("铃铛", null, { color: "B" })).toEqual([
      { type: "modify-score", operation: { type: "double-highest-printed-score", color: "W" } },
    ]);
    expect(compileTreasureEffectSpecs("青铜钟", null, { color: "R" })).toEqual([
      { type: "modify-score", operation: { type: "add", selector: { type: "printed-score-at-most", threshold: 2 }, amount: 1 } },
    ]);
  });
});

describe("priority queue", () => {
  it("orders effects, fixed checkpoints, material positions, and card-local effects deterministically", () => {
    const [first, second] = buildBasicDeck();
    const cards: GameCard[] = [
      {
        ...first,
        id: "same-priority-first",
        priority: 0,
        effectSpecs: [
          { type: "material-limit", amount: 1 },
          { type: "material-limit", amount: 2 },
        ],
      },
      {
        ...second,
        id: "same-priority-second",
        priority: 0,
        effectSpecs: [{ type: "material-limit", amount: 1 }],
      },
    ];

    const queue = buildSchedulerQueue(createEffectInstances(cards));

    expect(queue.map((entry) => entry.id)).toEqual([
      "same-priority-first:effect:0",
      "same-priority-first:effect:1",
      "same-priority-second:effect:0",
      "checkpoint-0",
      "checkpoint-50",
      "checkpoint-100",
      "checkpoint-150",
    ]);
  });

  it("places the statue before Priority 0 and inherent basic draws after Priority 150", () => {
    const statue = buildTreasureDeck().find((card) => card.name === "雕像")!;
    const basic = buildBasicDeck()[0];

    expect(buildSchedulerQueue(createEffectInstances([basic, statue])).map((entry) => entry.priority)).toEqual([
      -5,
      0,
      50,
      100,
      150,
      151,
    ]);
  });
});
