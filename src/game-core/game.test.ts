import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { buildBasicDeck, buildStagePromptCard, buildTreasureDeck, materialColors, type GameCard } from "./cards";
import { beginSynthesis, canBeginSynthesis, createGame, drawBasicCard, INITIAL_HAND_SIZE, resolveNextRisk, revealTreasureCard, submitSynthesisDecision, toggleMaterial, type GameState } from "./game";
import { defaultTreasureDefinitions } from "../data/cardData";

describe("card decks", () => {
  it("builds the 40-card basic deck from the written rules", () => {
    const deck = buildBasicDeck();

    expect(deck).toHaveLength(40);
    expect(deck.filter((card) => card.synthesisScore === 1)).toHaveLength(16);
    expect(deck.filter((card) => card.synthesisScore === 2)).toHaveLength(24);

    for (const color of materialColors) {
      expect(deck.filter((card) => card.color === color)).toHaveLength(10);
    }
  });

  it("builds the 80-card treasure deck exported from CardData.xlsm", () => {
    const deck = buildTreasureDeck();

    expect(deck).toHaveLength(80);
    expect(deck.filter((card) => card.kind === "rare")).toHaveLength(8);
    for (const color of [...materialColors, "Special"] as const) {
      const expected = defaultTreasureDefinitions
        .filter((definition) => definition.color === color)
        .reduce((total, definition) => total + definition.quantity, 0);
      expect(deck.filter((card) => card.color === color)).toHaveLength(expected);
    }
    expect(deck.every((card) => card.effect.length > 0)).toBe(true);
  });
});

describe("seeded dealing", () => {
  it("deals six basic cards and preserves deck totals", () => {
    const game = createGame("first-deal");

    expect(game.hand).toHaveLength(INITIAL_HAND_SIZE);
    expect(game.basicDeck).toHaveLength(34);
    expect(game.treasureDeck).toHaveLength(81);
    expect(game.treasureDeck.at(-1)?.kind).toBe("stage");
  });

  it("uses the same seed to reproduce both complete deck orders", () => {
    fc.assert(
      fc.property(fc.string(), (seed) => {
        const first = createGame(seed);
        const second = createGame(seed);

        expect(first.hand.map((card) => card.id)).toEqual(second.hand.map((card) => card.id));
        expect(first.basicDeck.map((card) => card.id)).toEqual(second.basicDeck.map((card) => card.id));
        expect(first.treasureDeck.map((card) => card.id)).toEqual(second.treasureDeck.map((card) => card.id));
      }),
    );
  });

  it("uses different seeds to produce different visible deals", () => {
    const first = createGame("red-copper");
    const second = createGame("blue-glass");

    expect(first.hand.map((card) => card.id)).not.toEqual(
      second.hand.map((card) => card.id),
    );
  });

  it("draws from the pre-shuffled order without changing the seed", () => {
    const started = createGame("continuous-order");
    const expectedBasic = started.basicDeck[0];
    const expectedTreasure = started.treasureDeck[0];
    const afterBasic = drawBasicCard(started);
    const afterTreasure = revealTreasureCard(afterBasic);

    expect(afterBasic.hand.at(-1)).toEqual(expectedBasic);
    expect(afterTreasure.revealedTreasures.at(-1)).toEqual(expectedTreasure);
    expect(afterTreasure.seed).toBe("continuous-order");
  });
});

describe("synthesis checkpoints", () => {
  it.each([
    [1, 4],
    [2, 5],
    [3, 6],
  ] as const)("applies the phase %i synthesis bonus", (phase, expectedScore) => {
    const materials = materialColors.map((color) =>
      buildBasicDeck().find((card) => card.color === color && card.synthesisScore === 1)!,
    );
    let state: GameState = { ...createGame(`phase-${phase}-bonus`), phase, hand: materials };
    for (const card of materials) state = toggleMaterial(state, card.id);

    const started = beginSynthesis(state);

    expect(started.synthesis?.score).toBe(expectedScore);
  });

  it("allows exactly four materials and ignores a fifth selection", () => {
    const materials = buildBasicDeck().slice(0, 5);
    let state = { ...createGame("exact-four"), hand: materials };

    for (const card of materials) state = toggleMaterial(state, card.id);

    expect(state.selectedMaterialIds).toHaveLength(4);
    expect(state.selectedMaterialIds).not.toContain(materials[4].id);
    expect(beginSynthesis(state).synthesis?.materials).toHaveLength(4);
  });

  it("keeps failed treasures in the queue after the stage prompt", () => {
    const materials = buildBasicDeck().slice(0, 4);
    const hardTreasure = buildTreasureDeck().find((card) => card.kind === "rare" && card.difficulty === 20)!;
    let state = { ...createGame("queue-order"), hand: materials, treasureDeck: [hardTreasure, hardTreasure, hardTreasure, buildStagePromptCard()] };
    for (const card of materials) state = toggleMaterial(state, card.id);

    const started = beginSynthesis(state);
    const failedCard = started.revealedTreasures.find((card) => card.resolution === "failed")!;
    const stageIndex = started.treasureDeck.findIndex((card) => card.kind === "stage");
    const failedIndex = started.treasureDeck.findIndex((card) => card.id === failedCard.id);

    expect(failedCard.resolution).toBe("failed");
    expect(stageIndex).toBeGreaterThanOrEqual(0);
    expect(failedIndex).toBeGreaterThan(stageIndex);
  });

  it("marks a treasure as gained when the score reaches its difficulty", () => {
    const materials = Array.from({ length: 4 }, (_, index) => ({
      id: `high-score-${index}`,
      name: "基础素材",
      kind: "base" as const,
      color: "R" as const,
      difficulty: null,
      synthesisScore: 15,
      effect: "获得一张基础卡",
      priority: null,
      effectSpecs: [{ type: "draw-basic" as const, amount: 1 }],
    }));
    const easyTreasure = {
      id: "test-easy-treasure",
      name: "测试宝物",
      kind: "treasure" as const,
      color: "W" as const,
      difficulty: 9,
      synthesisScore: 1,
      effect: "无特效",
      priority: null,
      effectSpecs: [],
    };
    let state: GameState = { ...createGame("difficulty-check"), hand: materials, treasureDeck: [easyTreasure, easyTreasure, easyTreasure, buildStagePromptCard()] };
    for (const card of materials) state = toggleMaterial(state, card.id);

    const started = beginSynthesis(state);

    expect(started.synthesis?.failed).toHaveLength(0);
    expect(started.revealedTreasures[0]?.resolution).toBe("gained");
  });

  it("does not end before the third stage prompt", () => {
    const materials = buildBasicDeck().slice(0, 4);
    let state = { ...createGame("stage-end"), hand: materials, treasureDeck: [buildStagePromptCard()] };
    for (const card of materials) state = toggleMaterial(state, card.id);

    const ended = beginSynthesis(state);

    expect(ended.phase).toBe(3);
    expect(ended.status).toBe("game-over");
    expect(ended.terminalScore).toBe(0);
  });

  it("uses color diversity for safe and risk quotas", () => {
    const materials = buildBasicDeck().slice(0, 4);
    const hardTreasure = buildTreasureDeck().find((card) => card.kind === "rare" && card.difficulty === 20)!;
    let state = { ...createGame("synthesis-checkpoint"), hand: materials, treasureDeck: [hardTreasure, hardTreasure, hardTreasure, hardTreasure] };
    for (const card of materials) state = toggleMaterial(state, card.id);

    const started = beginSynthesis(state);
    expect(started.synthesis?.safeQuota).toBe(3);
    expect(started.synthesis?.riskQuota).toBe(1);
    expect(started.status).toBe("risk");

    const stopped = resolveNextRisk(started, false);
    expect(stopped.cauldronExplosions).toBe(0);
    const exploded = resolveNextRisk(started, true);
    expect(exploded.cauldronExplosions).toBe(1);
  });

  it("destroys the latest gained treasure immediately on the first explosion", () => {
    const materials = buildBasicDeck().filter((card, index, deck) =>
      deck.findIndex((candidate) => candidate.color === card.color) === index,
    );
    const easyTreasure = {
      ...buildTreasureDeck().find((card) => card.kind === "treasure")!,
      id: "immediate-easy",
      difficulty: 0,
    };
    const hardTreasure = {
      ...easyTreasure,
      id: "immediate-hard",
      difficulty: 99,
    };
    let state: GameState = {
      ...createGame("immediate-first-explosion"),
      hand: materials,
      treasureDeck: [easyTreasure, hardTreasure, buildStagePromptCard()],
    };
    for (const card of materials) state = toggleMaterial(state, card.id);

    const started = beginSynthesis(state);
    const gained = resolveNextRisk(started);
    const exploded = resolveNextRisk(gained);

    expect(exploded.status).toBe("risk");
    expect(exploded.cauldronExplosions).toBe(1);
    expect(exploded.synthesis?.gained).toHaveLength(0);
    expect(exploded.synthesis?.destroyed.map((card) => card.id)).toEqual([easyTreasure.id]);
    expect(exploded.revealedTreasures[0]).toMatchObject({ id: easyTreasure.id, resolution: "destroyed" });
  });

  it("ends immediately on the second explosion without revealing the remaining quota", () => {
    const materials = buildBasicDeck().filter((card, index, deck) =>
      deck.findIndex((candidate) => candidate.color === card.color) === index,
    );
    const template = buildTreasureDeck().find((card) => card.kind === "treasure")!;
    const easyTreasure = { ...template, id: "second-easy", difficulty: 0 };
    const firstFailure = { ...template, id: "second-failure-one", difficulty: 99 };
    const secondFailure = { ...template, id: "second-failure-two", difficulty: 99 };
    const unopenedTreasure = { ...template, id: "must-remain-unopened", difficulty: 0 };
    let state: GameState = {
      ...createGame("immediate-second-explosion"),
      hand: materials,
      treasureDeck: [easyTreasure, firstFailure, secondFailure, unopenedTreasure, buildStagePromptCard()],
    };
    for (const card of materials) state = toggleMaterial(state, card.id);

    let next = beginSynthesis(state);
    next = resolveNextRisk(next);
    next = resolveNextRisk(next);
    next = resolveNextRisk(next);

    expect(next.cauldronExplosions).toBe(2);
    expect(next.status).toBe("idle");
    expect(next.synthesis?.riskResolved).toBe(3);
    expect(next.synthesis?.checkpoints).toContain(150);
    expect(next.revealedTreasures).toHaveLength(3);
    expect(next.treasureDeck[0]?.id).toBe(unopenedTreasure.id);
    expect(resolveNextRisk(next)).toBe(next);
  });
});

describe("material effects", () => {
  it("stacks statues from the initial four but not from extra material slots", () => {
    const statues = buildTreasureDeck().filter((card) => card.name === "雕像");
    const basics = buildBasicDeck().slice(0, 4);
    const hand = [statues[0], statues[1], basics[0], basics[1], statues[2], basics[2], basics[3]];
    let state = { ...createGame("statue-limit"), hand };

    for (const card of hand) state = toggleMaterial(state, card.id);

    expect(state.materialLimit).toBe(6);
    expect(state.selectedMaterialIds).toEqual(hand.slice(0, 6).map((card) => card.id));
    expect(state.selectedMaterialIds).not.toContain(basics[3].id);
    expect(canBeginSynthesis(state)).toBe(true);
  });

  it("does not let an extra-slot statue recursively increase the limit", () => {
    const statues = buildTreasureDeck().filter((card) => card.name === "雕像");
    const basics = buildBasicDeck().slice(0, 5);
    const hand = [statues[0], basics[0], basics[1], basics[2], statues[1], basics[3]];
    let state = { ...createGame("extra-statue"), hand };

    for (const card of hand) state = toggleMaterial(state, card.id);

    expect(state.materialLimit).toBe(5);
    expect(state.selectedMaterialIds).toHaveLength(5);
    expect(state.selectedMaterialIds).not.toContain(basics[3].id);
  });

  it("runs each physical material effect once through the scheduler", () => {
    const statue = buildTreasureDeck().find((card) => card.name === "雕像")!;
    const basics = buildBasicDeck().slice(0, 3);
    const materials = [statue, ...basics];
    let state: GameState = {
      ...createGame("effect-instances"),
      hand: materials,
      basicDeck: buildBasicDeck().slice(20, 30),
      treasureDeck: [],
    };
    for (const card of materials) state = toggleMaterial(state, card.id);

    const completed = beginSynthesis(state);

    expect(completed.synthesis?.checkpoints).toEqual([0, 50, 100, 150]);
    expect(completed.synthesis?.runtime.executedEffectIds).toEqual([
      `${statue.id}:effect:0`,
      ...basics.map((card) => `${card.id}:effect:0`),
    ]);
    expect(completed.synthesis?.runtime.step).toBe("complete");
  });
});

describe("reveal-plan material effects", () => {
  function materialsFor(treasureName: string, colors: readonly (typeof materialColors[number])[]): GameState {
    const treasure = buildTreasureDeck().find((card) => card.name === treasureName)!;
    const basicDeck = buildBasicDeck();
    const basics = colors.map((color, index) => basicDeck.filter((card) => card.color === color)[index]);
    let state: GameState = { ...createGame(`effect-${treasureName}`), hand: [treasure, ...basics], treasureDeck: [] };
    for (const card of state.hand) state = toggleMaterial(state, card.id);
    return state;
  }

  it("adds conditional safe reveals for pottery, coral, and lantern", () => {
    expect(beginSynthesis(materialsFor("陶罐", ["R", "R", "R"])).synthesis?.safeQuota).toBe(3);
    expect(beginSynthesis(materialsFor("珊瑚", ["Y", "B", "W"])).synthesis?.safeQuota).toBe(2);
    expect(beginSynthesis(materialsFor("提灯", ["Y", "Y", "Y"])).synthesis?.safeQuota).toBe(5);
  });

  it("adds risk reveals for dice and vase", () => {
    expect(beginSynthesis(materialsFor("骰子", ["R", "R", "R"])).synthesis?.riskQuota).toBe(3);
    expect(beginSynthesis(materialsFor("宝瓶", ["R", "R", "R"])).synthesis?.riskQuota).toBe(3);
  });

  it("converts reveal categories for hourglass and pocket watch", () => {
    const hourglass = beginSynthesis(materialsFor("沙漏", ["B", "B", "B"]));
    expect(hourglass.synthesis?.safeQuota).toBe(0);
    expect(hourglass.synthesis?.riskQuota).toBe(7);

    const pocketWatch = beginSynthesis(materialsFor("怀表", ["R", "Y", "B"]));
    expect(pocketWatch.synthesis?.safeQuota).toBe(4);
    expect(pocketWatch.synthesis?.riskQuota).toBe(0);
  });

  it("forces cursed-box risk reveals and lets brooch override the risk quota", () => {
    const template = buildTreasureDeck().find((card) => card.kind === "treasure")!;
    const cursedMaterials = materialsFor("诅咒盒", ["R", "R", "R"]);
    const cursedDeck = Array.from({ length: 8 }, (_, index) => ({ ...template, id: `forced-${index}`, difficulty: 0 }));
    const cursed = beginSynthesis({ ...cursedMaterials, treasureDeck: cursedDeck });
    expect(cursed.synthesis?.riskQuota).toBe(5);
    expect(cursed.synthesis?.revealPlan.riskForced).toBe(true);
    expect(cursed.synthesis?.runtime.pendingDecision).toMatchObject({ forced: true });

    const cannotStop = resolveNextRisk(cursed, false);
    expect(cannotStop.synthesis?.riskResolved).toBe(1);
    expect(cannotStop.status).toBe("risk");

    const brooch = beginSynthesis(materialsFor("胸针", ["R", "R", "R"]));
    expect(brooch.synthesis?.riskQuota).toBe(4);
    expect(brooch.synthesis?.revealPlan.riskOverride).toBe(4);

    const cursedBroochCard = buildTreasureDeck().find((card) => card.name === "胸针")!;
    const cursedCard = buildTreasureDeck().find((card) => card.name === "诅咒盒")!;
    const cursedBroochBasics = buildBasicDeck().filter((card) => card.color === "R").slice(0, 2);
    let cursedBroochState: GameState = {
      ...createGame("cursed-brooch"),
      hand: [cursedBroochCard, cursedCard, ...cursedBroochBasics],
      treasureDeck: [],
    };
    for (const card of cursedBroochState.hand) cursedBroochState = toggleMaterial(cursedBroochState, card.id);
    const cursedBrooch = beginSynthesis(cursedBroochState);
    expect(cursedBrooch.synthesis?.revealPlan.riskForced).toBe(false);
    expect(cursedBrooch.synthesis?.revealPlan.previewRisk).toBe(false);
  });

  it("previews a silver-flask risk card without consuming it or its quota", () => {
    const template = buildTreasureDeck().find((card) => card.kind === "treasure")!;
    const started = materialsFor("银壶", ["R", "R", "R"]);
    const fillers = [0, 1, 2].map((index) => ({ ...template, id: `preview-filler-${index}`, difficulty: 0 }));
    const withDeck: GameState = { ...started, treasureDeck: [...fillers, { ...template, id: "preview-target", difficulty: 99 }, buildStagePromptCard()] };
    const selected = beginSynthesis(withDeck);
    const previewed = resolveNextRisk(selected, true);

    expect(previewed.treasureDeck[0]?.id).toBe("preview-target");
    expect(previewed.synthesis?.runtime.pendingDecision?.preview?.id).toBe("preview-target");
    expect(previewed.synthesis?.riskResolved).toBe(0);

    const stopped = resolveNextRisk(previewed, false);
    expect(stopped.status).toBe("idle");
    expect(stopped.treasureDeck[0]?.id).toBe("preview-target");

    const silver = buildTreasureDeck().find((card) => card.name === "银壶")!;
    const dice = buildTreasureDeck().find((card) => card.name === "骰子")!;
    const red = buildBasicDeck().filter((card) => card.color === "R").slice(0, 2);
    const targets = Array.from({ length: 3 }, (_, index) => ({ ...template, id: `multi-preview-${index}`, difficulty: 99 }));
    let multi: GameState = {
      ...createGame("multi-preview"),
      hand: [silver, dice, ...red],
      treasureDeck: [...fillers.slice(0, 2), ...targets, buildStagePromptCard()],
    };
    for (const card of multi.hand) multi = toggleMaterial(multi, card.id);
    const multiStarted = beginSynthesis(multi);
    const multiPreview = resolveNextRisk(multiStarted, true);
    const accepted = resolveNextRisk(multiPreview, true);
    expect(accepted.status).toBe("risk");
    expect(accepted.synthesis?.riskResolved).toBe(1);
    expect(accepted.synthesis?.runtime.pendingDecision?.preview).toBeNull();
  });
});

describe("inherent basic draw effect", () => {
  it("replaces each spent basic material after synthesis", () => {
    const materials = buildBasicDeck().slice(0, 4);
    const reserve = buildBasicDeck().slice(20, 24);
    let state: GameState = {
      ...createGame("basic-replacement"),
      hand: materials,
      basicDeck: reserve,
      treasureDeck: [],
    };
    for (const card of materials) state = toggleMaterial(state, card.id);

    const completed = beginSynthesis(state);

    expect(completed.hand.map((card) => card.id)).toEqual(reserve.map((card) => card.id));
    expect(completed.basicDiscard.map((card) => card.id)).toEqual(materials.map((card) => card.id));
    expect(completed.pendingBasicDraws).toBe(0);
  });

  it("defers draws until current materials are discarded, then recycles deterministically", () => {
    const materials = buildBasicDeck().slice(0, 4);
    const initial: GameState = {
      ...createGame("deferred-basic-draw"),
      hand: materials,
      basicDeck: [],
      basicDiscard: [],
      treasureDeck: [],
    };
    let selected = initial;
    for (const card of materials) selected = toggleMaterial(selected, card.id);

    const first = beginSynthesis(selected);
    const second = beginSynthesis(selected);

    expect(first.pendingBasicDraws).toBe(0);
    expect(first.basicRecycleCount).toBe(1);
    expect(first.basicDeck).toHaveLength(0);
    expect(first.basicDiscard).toHaveLength(0);
    expect(first.hand.map((card) => card.id)).toEqual(second.hand.map((card) => card.id));
    expect(first.hand).toHaveLength(4);
  });

  it("recycles the old discard before the active materials enter it", () => {
    const materials = buildBasicDeck().slice(0, 4);
    const oldDiscard = buildBasicDeck().slice(20, 22);
    let state: GameState = {
      ...createGame("two-step-recycle"),
      hand: materials,
      basicDeck: [],
      basicDiscard: oldDiscard,
      treasureDeck: [],
    };
    for (const card of materials) state = toggleMaterial(state, card.id);

    const completed = beginSynthesis(state);

    expect(completed.hand).toHaveLength(4);
    expect(completed.basicRecycleCount).toBe(2);
    expect(completed.basicDeck).toHaveLength(2);
    expect(completed.basicDiscard).toHaveLength(0);
  });
});

describe("catalog score, color, safety, and retention effects", () => {
  function startWith(cards: GameCard[], treasureDeck: GameCard[] = []): GameState {
    let state: GameState = { ...createGame("catalog-effects"), hand: cards, treasureDeck };
    for (const card of cards) state = toggleMaterial(state, card.id);
    return beginSynthesis(state);
  }

  it("resolves effective colors before the quota checkpoint", () => {
    const box = buildTreasureDeck().find((card) => card.name === "珠宝匣" && card.color === "W")!;
    const basics = buildBasicDeck().slice(0, 3);
    const boxed = startWith([box, ...basics]);
    expect(boxed.synthesis?.materialColors).toEqual(["W"]);
    expect(boxed.synthesis?.safeQuota).toBe(3);
    expect(boxed.synthesis?.riskQuota).toBe(1);

    const crystal = buildTreasureDeck().find((card) => card.name === "水晶")!;
    const crystalline = startWith([crystal, ...basics]);
    expect(crystalline.synthesis?.materialColors).toHaveLength(4);
    expect(crystalline.synthesis?.riskQuota).toBe(4);
  });

  it.each([
    ["白玉", "W"],
    ["蓝宝石", "B"],
    ["黄宝石", "Y"],
    ["红宝石", "R"],
  ] as const)("acquires %s when every material has its required effective color", (name, color) => {
    const materials = buildBasicDeck().filter((card) => card.color === color).slice(0, 4);
    const gemstone = buildTreasureDeck().find((card) => card.name === name)!;
    const completed = startWith(materials, [gemstone]);

    expect(completed.synthesis?.score).toBe(4);
    expect(completed.synthesis?.gained.map((card) => card.id)).toContain(gemstone.id);
    expect(completed.revealedTreasures).toContainEqual(expect.objectContaining({ id: gemstone.id, resolution: "gained" }));
  });

  it("uses Priority 0 effective colors and still rejects a nonmatching gemstone", () => {
    const redBox = buildTreasureDeck().find((card) => card.name === "珠宝匣" && card.color === "R")!;
    const mixedBasics = ["W", "B", "Y"].map((color) => buildBasicDeck().find((card) => card.color === color)!);
    const redGemstone = buildTreasureDeck().find((card) => card.name === "红宝石")!;
    const recolored = startWith([redBox, ...mixedBasics], [redGemstone]);
    expect(recolored.synthesis?.gained.map((card) => card.id)).toContain(redGemstone.id);

    const printedMixed = startWith(buildBasicDeck().slice(0, 3).concat(
      buildBasicDeck().find((card) => card.color === "Y")!,
    ), [redGemstone]);
    expect(printedMixed.synthesis?.failed.map((card) => card.id)).toContain(redGemstone.id);
  });

  it("applies material score modifiers and safe reveal bonuses", () => {
    const ring = buildTreasureDeck().find((card) => card.name === "戒指")!;
    const basics = buildBasicDeck().slice(0, 3).map((card) => ({ ...card, synthesisScore: 1 }));
    const scoreState = startWith([ring, ...basics]);
    expect(scoreState.synthesis?.score).toBe(9);

    const candle = buildTreasureDeck().find((card) => card.name === "烛台")!;
    const safeCard = { ...buildTreasureDeck().find((card) => card.kind === "treasure")!, id: "safe-score", difficulty: 8 };
    const candleState = startWith([candle, ...basics], [safeCard]);
    expect(candleState.synthesis?.score).toBe(9);
    expect(candleState.synthesis?.gained.map((card) => card.id)).toContain("safe-score");
  });

  it("adds a seal bonus once to each matching material and not to the revealed treasure", () => {
    const seal = buildTreasureDeck().find((card) => card.name === "印章" && card.color === "B")!;
    const whiteBasics = buildBasicDeck().filter((card) => card.color === "W" && card.synthesisScore === 2).slice(0, 2);
    const blueBasic = buildBasicDeck().find((card) => card.color === "B" && card.synthesisScore === 2)!;
    const whiteTarget = {
      ...buildTreasureDeck().find((card) => card.color === "W" && card.kind === "treasure")!,
      id: "white-score-target",
      difficulty: 12,
    };
    const filler = {
      ...buildTreasureDeck().find((card) => card.color === "R" && card.kind === "treasure")!,
      id: "seal-safe-filler",
      difficulty: 0,
    };
    const completed = startWith([seal, ...whiteBasics, blueBasic], [whiteTarget, filler]);

    expect(completed.synthesis?.materialScores).toMatchObject({
      [seal.id]: 3,
      [whiteBasics[0].id]: 3,
      [whiteBasics[1].id]: 3,
      [blueBasic.id]: 2,
    });
    expect(completed.synthesis?.score).toBe(11);
    expect(completed.synthesis?.failed.map((card) => card.id)).toContain("white-score-target");
  });

  it("treats base score wording as the printed synthesis score of any material", () => {
    const bronzeBell = buildTreasureDeck().find((card) => card.name === "青铜钟" && card.color === "R")!;
    const lowTreasure = {
      ...buildTreasureDeck().find((card) => card.id !== bronzeBell.id && card.synthesisScore === 2 && card.kind === "treasure")!,
      id: "low-score-treasure",
      effectSpecs: [{ type: "none" } as const],
    };
    const lowBasic = buildBasicDeck().find((card) => card.synthesisScore === 2)!;
    const highTreasure = {
      ...buildTreasureDeck().find((card) => card.synthesisScore === 3 && card.kind === "treasure")!,
      id: "high-score-treasure",
      effectSpecs: [{ type: "none" } as const],
    };
    const completed = startWith([bronzeBell, lowTreasure, lowBasic, highTreasure]);

    expect(completed.synthesis?.materialScores).toMatchObject({
      [bronzeBell.id]: 3,
      [lowTreasure.id]: 3,
      [lowBasic.id]: 3,
      [highTreasure.id]: 3,
    });
    expect(completed.synthesis?.score).toBe(12);
  });

  it("doubles the highest printed score of the target color even when it is a treasure", () => {
    const bell = buildTreasureDeck().find((card) => card.name === "铃铛" && card.color === "B")!;
    const seal = buildTreasureDeck().find((card) => card.name === "印章" && card.color === "B")!;
    const whiteTreasure = {
      ...buildTreasureDeck().find((card) => card.color === "W" && card.synthesisScore === 6)!,
      id: "high-white-treasure",
      effectSpecs: [{ type: "none" } as const],
    };
    const whiteBasic = buildBasicDeck().find((card) => card.color === "W" && card.synthesisScore === 2)!;
    const completed = startWith([seal, bell, whiteTreasure, whiteBasic]);

    expect(completed.synthesis?.materialScores[whiteTreasure.id]).toBe(13);
    expect(completed.synthesis?.materialScores[whiteBasic.id]).toBe(3);
  });

  it("guarantees the first acquisition and pauses for clay retention", () => {
    const safe = buildTreasureDeck().find((card) => card.name === "保险箱")!;
    const basics = buildBasicDeck().slice(0, 3);
    const target = { ...buildTreasureDeck().find((card) => card.kind === "treasure")!, id: "guaranteed", difficulty: 99 };
    const guaranteed = startWith([safe, ...basics], [target]);
    expect(guaranteed.synthesis?.gained.map((card) => card.id)).toContain("guaranteed");

    const clay = buildTreasureDeck().find((card) => card.name === "黏土")!;
    const paused = startWith([clay, ...basics]);
    expect(paused.status).toBe("retention");
    expect(paused.synthesis?.runtime.pendingDecision?.type).toBe("retain-materials");
    const chosen = submitSynthesisDecision(paused, { type: "select-retained-materials", cardIds: [clay.id] });
    expect(chosen.status).toBe("idle");
    expect(chosen.hand.map((card) => card.id)).toContain(clay.id);
  });

  it("automatically retains lower-difficulty treasure materials with amber", () => {
    const amber = buildTreasureDeck().find((card) => card.name === "琥珀")!;
    const treasure = { ...buildTreasureDeck().find((card) => card.name === "金块")!, id: "retained-treasure", difficulty: 5 };
    const basics = buildBasicDeck().slice(0, 2);
    const completed = startWith([amber, treasure, ...basics]);
    expect(completed.hand.map((card) => card.id)).toContain("retained-treasure");
    expect(completed.treasureDiscard.map((card) => card.id)).not.toContain("retained-treasure");
  });

  it("keeps additive score effects when later multipliers and selectors execute", () => {
    const necklace = buildTreasureDeck().find((card) => card.name === "项链" && card.kind === "treasure")!;
    const apple = buildTreasureDeck().find((card) => card.name === "金苹果")!;
    const bell = buildTreasureDeck().find((card) => card.name === "铃铛" && card.color === "B")!;
    const whiteBase = buildBasicDeck().find((card) => card.color === "W" && card.synthesisScore === 1)!;
    const completed = startWith([necklace, apple, bell, whiteBase]);
    expect(completed.synthesis?.score).toBe(18);

    const necklaceOnly = buildTreasureDeck().find((card) => card.name === "项链" && card.kind === "treasure")!;
    const target = { ...buildTreasureDeck().find((card) => card.kind === "treasure")!, id: "necklace-target", difficulty: 6 };
    const doubledReveal = startWith([necklaceOnly, ...buildBasicDeck().slice(0, 3)], [target]);
    expect(doubledReveal.synthesis?.gained.map((card) => card.id)).toContain("necklace-target");
  });

  it("prevents treasure loss on the first explosion with incense", () => {
    const incense = buildTreasureDeck().find((card) => card.name === "香炉")!;
    const cursed = buildTreasureDeck().find((card) => card.name === "诅咒盒")!;
    const basics = buildBasicDeck().slice(0, 2);
    const template = buildTreasureDeck().find((card) => card.kind === "treasure")!;
    const started = startWith([incense, cursed, ...basics], [
      { ...template, id: "safe-filler", difficulty: 99 },
      { ...template, id: "risk-gain", difficulty: 0 },
      { ...template, id: "risk-fail", difficulty: 99 },
      { ...template, id: "risk-rest", difficulty: 99 },
    ]);
    const gained = resolveNextRisk(started, true);
    const protectedState = resolveNextRisk(gained, true);
    expect(protectedState.cauldronExplosions).toBe(1);
    expect(protectedState.synthesis?.gained.map((card) => card.id)).toContain("risk-gain");
    expect(protectedState.synthesis?.destroyed).toHaveLength(0);
  });
});
