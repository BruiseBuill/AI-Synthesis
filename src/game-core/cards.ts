import { defaultTreasureDefinitions, type CardColor, type MaterialColor, type TreasureDefinition } from "../data/cardData";
import { compileTreasureEffectSpecs, type CardEffectSpec } from "./effects";

export type CardKind = "base" | "treasure" | "rare" | "stage";

export interface GameCard {
  id: string;
  name: string;
  kind: CardKind;
  color: CardColor;
  difficulty: number | null;
  synthesisScore: number;
  effect: string;
  additionalAcquireMethod?: string | null;
  additionalAcquireColor?: MaterialColor | null;
  priority: number | null;
  effectSpecs: CardEffectSpec[];
  resolution?: "gained" | "failed" | "destroyed";
}

export const STAGE_PROMPT_ID = "stage-prompt";

export function buildStagePromptCard(): GameCard {
  return {
    id: STAGE_PROMPT_ID,
    name: "阶段提示",
    kind: "stage",
    color: "Special",
    difficulty: null,
    synthesisScore: 0,
    effect: "推进炼金阶段",
    priority: null,
    effectSpecs: [],
  };
}

export const materialColors = ["R", "Y", "B", "W"] as const;

export function buildBasicDeck(): GameCard[] {
  return materialColors.flatMap((color) => [
    ...Array.from({ length: 4 }, (_, copy) => ({
      id: `base-${color}-1-${copy + 1}`,
      name: "基础素材",
      kind: "base" as const,
      color,
      difficulty: null,
      synthesisScore: 1,
      effect: "获得一张基础卡",
      priority: null,
      effectSpecs: [{ type: "draw-basic" as const, amount: 1 }],
    })),
    ...Array.from({ length: 6 }, (_, copy) => ({
      id: `base-${color}-2-${copy + 1}`,
      name: "基础素材",
      kind: "base" as const,
      color,
      difficulty: null,
      synthesisScore: 2,
      effect: "获得一张基础卡",
      priority: null,
      effectSpecs: [{ type: "draw-basic" as const, amount: 1 }],
    })),
  ]);
}

export function buildTreasureDeck(definitions: readonly TreasureDefinition[] = defaultTreasureDefinitions): GameCard[] {
  return definitions.flatMap((definition, definitionIndex) =>
    Array.from({ length: definition.quantity }, (_, copy) => ({
      id: `treasure-${definitionIndex + 1}-${copy + 1}`,
      name: definition.name,
      kind: definition.color === "Special" ? "rare" : "treasure",
      color: definition.color,
      difficulty: definition.difficulty,
      synthesisScore: definition.synthesisScore,
      effect: definition.effect,
      additionalAcquireMethod: definition.additionalAcquireMethod,
      additionalAcquireColor: definition.additionalAcquireColor,
      priority: definition.priority,
      effectSpecs: compileTreasureEffectSpecs(definition.name, definition.effectCode, {
        color: definition.color,
        priority: definition.priority,
      }),
    })),
  );
}
