import type { CardColor, MaterialColor } from "../data/cardData";
import { buildBasicDeck, buildTreasureDeck, type GameCard } from "./cards";
import {
  beginSynthesis,
  canBeginSynthesis,
  createGame,
  toggleMaterial,
  type GameState,
  type Phase,
  type SynthesisSummary,
} from "./game";

export interface BasicMaterialQuery {
  color: MaterialColor;
  synthesisScore: 1 | 2;
  index?: number;
}

export interface TreasureMaterialQuery {
  name: string;
  color?: Exclude<CardColor, "Special">;
  synthesisScore?: number;
  index?: number;
  inert?: boolean;
}

export interface MaterialScoreRow {
  id: string;
  name: string;
  kind: GameCard["kind"];
  color: CardColor;
  printedScore: number;
  evaluatedScore: number;
  delta: number;
}

export interface MaterialScoreEvaluation {
  totalScore: number;
  printedMaterialTotal: number;
  evaluatedMaterialTotal: number;
  phaseBonus: number;
  scoreAdjustment: number;
  scoreMultiplier: number;
  materials: MaterialScoreRow[];
  summary: SynthesisSummary;
}

export interface MaterialScoreOptions {
  phase?: Phase;
  seed?: string;
}

function matchingCard(cards: readonly GameCard[], predicate: (card: GameCard) => boolean, index: number, description: string): GameCard {
  const card = cards.filter(predicate)[index];
  if (!card) throw new Error(`No card matches ${description} at index ${index}`);
  return card;
}

export function getBasicMaterial(query: BasicMaterialQuery): GameCard {
  const { color, synthesisScore, index = 0 } = query;
  return matchingCard(
    buildBasicDeck(),
    (card) => card.color === color && card.synthesisScore === synthesisScore,
    index,
    `basic color=${color} score=${synthesisScore}`,
  );
}

export function asInertMaterial(card: GameCard, id = card.id): GameCard {
  return { ...card, id, effectSpecs: [{ type: "none" }] };
}

export function getTreasureMaterial(query: TreasureMaterialQuery): GameCard {
  const { name, color, synthesisScore, index = 0, inert = false } = query;
  const card = matchingCard(
    buildTreasureDeck(),
    (candidate) => candidate.kind === "treasure"
      && candidate.name === name
      && (color === undefined || candidate.color === color)
      && (synthesisScore === undefined || candidate.synthesisScore === synthesisScore),
    index,
    `treasure name=${name}${color ? ` color=${color}` : ""}${synthesisScore === undefined ? "" : ` score=${synthesisScore}`}`,
  );
  return inert ? asInertMaterial(card) : card;
}

export function evaluateMaterialScore(
  materials: readonly GameCard[],
  options: MaterialScoreOptions = {},
): MaterialScoreEvaluation {
  if (materials.length < 4) throw new Error("A score scenario requires at least four materials");
  if (new Set(materials.map((card) => card.id)).size !== materials.length) {
    throw new Error("Every score-scenario material must have a unique card id");
  }
  if (materials.some((card) => card.kind !== "base" && card.kind !== "treasure")) {
    throw new Error("Only basic and treasure cards can be score-scenario materials");
  }

  let state: GameState = {
    ...createGame(options.seed ?? "score-test-kit"),
    phase: options.phase ?? 1,
    hand: [...materials],
    treasureDeck: [],
  };
  for (const card of materials) state = toggleMaterial(state, card.id);
  if (!canBeginSynthesis(state)) {
    throw new Error(`Materials do not form a valid synthesis (${state.selectedMaterialIds.length}/${state.materialLimit} selected)`);
  }

  const completed = beginSynthesis(state);
  const summary = completed.synthesis;
  if (!summary) throw new Error("Score scenario did not produce a synthesis summary");

  const rows = materials.map((card): MaterialScoreRow => {
    const evaluatedScore = summary.materialScores[card.id] ?? card.synthesisScore;
    return {
      id: card.id,
      name: card.name,
      kind: card.kind,
      color: card.color,
      printedScore: card.synthesisScore,
      evaluatedScore,
      delta: evaluatedScore - card.synthesisScore,
    };
  });

  return {
    totalScore: summary.score,
    printedMaterialTotal: rows.reduce((total, row) => total + row.printedScore, 0),
    evaluatedMaterialTotal: rows.reduce((total, row) => total + row.evaluatedScore, 0),
    phaseBonus: summary.phaseBonus,
    scoreAdjustment: summary.scoreAdjustment,
    scoreMultiplier: summary.scoreMultiplier,
    materials: rows,
    summary,
  };
}

export function formatMaterialScore(evaluation: MaterialScoreEvaluation): string {
  const materialLines = evaluation.materials.map((row) =>
    `${row.name} [${row.color}] ${row.printedScore} -> ${row.evaluatedScore} (${row.delta >= 0 ? "+" : ""}${row.delta})`,
  );
  const equation = `materials ${evaluation.evaluatedMaterialTotal} + phase ${evaluation.phaseBonus} + adjustment ${evaluation.scoreAdjustment}, x${evaluation.scoreMultiplier} = total ${evaluation.totalScore}`;
  return [...materialLines, equation].join("\n");
}
