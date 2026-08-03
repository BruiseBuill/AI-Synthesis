import type { CardColor } from "../data/cardData";
import type { GameCard } from "./cards";

export const SYNTHESIS_CHECKPOINTS = [0, 50, 100, 150] as const;
export const BASIC_DRAW_PRIORITY = 151;

export type SynthesisCheckpoint = (typeof SYNTHESIS_CHECKPOINTS)[number];

export type ScoreSelector =
  | { type: "all-basic" }
  | { type: "all-treasure" }
  | { type: "color"; color: Exclude<CardColor, "Special"> }
  | { type: "safe-treasure" }
  | { type: "printed-score-at-most"; threshold: number };

export type ScoreOperation =
  | { type: "add"; selector: ScoreSelector; amount: number }
  | { type: "add-per-color"; amount: number }
  | { type: "double-highest-printed-score"; color: Exclude<CardColor, "Special"> }
  | { type: "multiply-total"; factor: number };

export type RetentionSelector =
  | { type: "choose"; count: number }
  | { type: "treasure-difficulty-below-source" };

export type CardEffectSpec =
  | { type: "none" }
  | { type: "material-limit"; amount: number }
  | { type: "draw-basic"; amount: number }
  | { type: "set-self-colors"; colors: Exclude<CardColor, "Special">[] }
  | { type: "set-all-colors"; color: Exclude<CardColor, "Special"> }
  | { type: "modify-score"; operation: ScoreOperation }
  | { type: "modify-reveal-plan"; operation: RevealPlanOperation }
  | { type: "guarantee-acquisition"; revealIndex: number }
  | { type: "prevent-explosion-loss"; explosionIndex: number }
  | { type: "retain-materials"; selector: RetentionSelector };

export type RevealPlanOperation =
  | { type: "add-safe"; amount: number; condition?: "four-colors" | "same-color" }
  | { type: "add-risk"; amount: number }
  | { type: "convert-safe-to-risk" }
  | { type: "convert-risk-to-safe" }
  | { type: "force-risk" }
  | { type: "override-risk"; amount: number }
  | { type: "preview-risk" };

export interface EffectInstance {
  id: string;
  sourceCardId: string;
  sourceCardName: string;
  sourcePosition: number;
  specIndex: number;
  priority: number;
  spec: CardEffectSpec;
}

export type SchedulerEntry =
  | { kind: "checkpoint"; id: `checkpoint-${SynthesisCheckpoint}`; priority: SynthesisCheckpoint }
  | { kind: "effect"; id: string; priority: number; effect: EffectInstance };

type CompileContext = { color?: CardColor; priority?: number | null; effect?: string };

const colorBySeal: Record<string, Exclude<CardColor, "Special">> = { B: "W", Y: "B", R: "Y", W: "R" };

function legacyEffectCodes(name: string, context: CompileContext = {}): CardEffectSpec[] {
  switch (name) {
    case "雕像": return [{ type: "material-limit", amount: 1 }];
    case "陶罐": return [{ type: "modify-reveal-plan", operation: { type: "add-safe", amount: 1 } }];
    case "珊瑚": return [{ type: "modify-reveal-plan", operation: { type: "add-safe", amount: 2, condition: "four-colors" } }];
    case "提灯": return [{ type: "modify-reveal-plan", operation: { type: "add-safe", amount: 2, condition: "same-color" } }];
    case "沙漏": return [
      { type: "modify-reveal-plan", operation: { type: "add-risk", amount: 3 } },
      { type: "modify-reveal-plan", operation: { type: "convert-safe-to-risk" } },
    ];
    case "怀表": return [{ type: "modify-reveal-plan", operation: { type: "convert-risk-to-safe" } }];
    case "骰子": return [{ type: "modify-reveal-plan", operation: { type: "add-risk", amount: 1 } }];
    case "宝瓶": return [{ type: "modify-reveal-plan", operation: { type: "add-risk", amount: 2 } }];
    case "诅咒盒": return [
      { type: "modify-reveal-plan", operation: { type: "add-risk", amount: 3 } },
      { type: "modify-reveal-plan", operation: { type: "force-risk" } },
    ];
    case "胸针": return [{ type: "modify-reveal-plan", operation: { type: "override-risk", amount: 4 } }];
    case "银壶": return [{ type: "modify-reveal-plan", operation: { type: "preview-risk" } }];
    case "黏土": return [{ type: "retain-materials", selector: { type: "choose", count: 1 } }];
    case "琥珀": return [{ type: "retain-materials", selector: { type: "treasure-difficulty-below-source" } }];
    case "香炉": return [{ type: "prevent-explosion-loss", explosionIndex: 1 }];
    case "保险箱": return [{ type: "guarantee-acquisition", revealIndex: 1 }];
    case "珠宝匣": return context.color && context.color !== "Special"
      ? [{ type: "set-all-colors", color: context.color }]
      : [];
    case "水晶": return [{ type: "set-self-colors", colors: ["R", "Y", "B", "W"] }];
    case "金块":
    case "白玉":
    case "蓝宝石":
    case "黄宝石":
    case "红宝石":
    case "印玺":
    case "金玫瑰":
    case "金杯": return [{ type: "none" }];
    case "戒指": return [{ type: "modify-score", operation: { type: "add", selector: { type: "all-basic" }, amount: 1 } }];
    case "酒杯": return [{ type: "modify-score", operation: { type: "add", selector: { type: "all-treasure" }, amount: 1 } }];
    case "印章": return context.color && context.color !== "Special"
      ? [{ type: "modify-score", operation: { type: "add", selector: { type: "color", color: colorBySeal[context.color] }, amount: 1 } }]
      : [{ type: "none" }];
    case "权杖": return [{ type: "modify-score", operation: { type: "add", selector: { type: "color", color: "R" }, amount: 2 } }];
    case "铃铛": return context.color && context.color !== "Special"
      ? [{ type: "modify-score", operation: { type: "double-highest-printed-score", color: colorBySeal[context.color] } }]
      : [];
    case "金苹果": return [{ type: "modify-score", operation: { type: "add-per-color", amount: 1 } }];
    case "王冠": return context.effect === "最终的总分翻倍"
      ? [{ type: "modify-score", operation: { type: "multiply-total", factor: 2 } }]
      : [{ type: "none" }];
    case "青铜钟": return [{ type: "modify-score", operation: { type: "add", selector: { type: "printed-score-at-most", threshold: context.color === "B" ? 1 : 2 }, amount: 1 } }];
    case "烛台": return [{ type: "modify-score", operation: { type: "add", selector: { type: "safe-treasure" }, amount: 3 } }];
    default: return [];
  }
}

export function compileTreasureEffectSpecs(
  name: string,
  effectCode?: string | null,
  context: CompileContext = {},
): CardEffectSpec[] {
  if (effectCode === "material-limit") return [{ type: "material-limit", amount: 1 }];
  return legacyEffectCodes(name, context);
}

export function createEffectInstances(materials: readonly GameCard[]): EffectInstance[] {
  return materials.flatMap((card, sourcePosition) =>
    (card.effectSpecs ?? []).map((spec, specIndex) => ({
      id: `${card.id}:effect:${specIndex}`,
      sourceCardId: card.id,
      sourceCardName: card.name,
      sourcePosition,
      specIndex,
      priority: spec.type === "draw-basic" ? BASIC_DRAW_PRIORITY : (card.priority ?? BASIC_DRAW_PRIORITY),
      spec,
    })),
  );
}

function compareSchedulerEntries(left: SchedulerEntry, right: SchedulerEntry): number {
  if (left.priority !== right.priority) return left.priority - right.priority;
  if (left.kind !== right.kind) return left.kind === "effect" ? -1 : 1;
  if (left.kind === "checkpoint" || right.kind === "checkpoint") return left.id.localeCompare(right.id);
  if (left.effect.sourcePosition !== right.effect.sourcePosition) return left.effect.sourcePosition - right.effect.sourcePosition;
  if (left.effect.specIndex !== right.effect.specIndex) return left.effect.specIndex - right.effect.specIndex;
  return left.effect.sourceCardId.localeCompare(right.effect.sourceCardId);
}

export function buildSchedulerQueue(effects: readonly EffectInstance[]): SchedulerEntry[] {
  const checkpoints: SchedulerEntry[] = SYNTHESIS_CHECKPOINTS.map((priority) => ({
    kind: "checkpoint",
    id: `checkpoint-${priority}`,
    priority,
  }));
  const effectEntries: SchedulerEntry[] = effects.map((effect) => ({ kind: "effect", id: effect.id, priority: effect.priority, effect }));
  return [...checkpoints, ...effectEntries].sort(compareSchedulerEntries);
}

export function getInitialMaterialLimit(cards: readonly GameCard[], initialCount = 4): number {
  return cards.slice(0, initialCount).reduce(
    (limit, card) => limit + (card.effectSpecs ?? []).reduce(
      (amount, spec) => amount + (spec.type === "material-limit" ? spec.amount : 0),
      0,
    ),
    initialCount,
  );
}
