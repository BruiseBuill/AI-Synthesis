import { defaultTreasureDefinitions, type TreasureDefinition } from "../data/cardData";
import { buildBasicDeck, buildStagePromptCard, buildTreasureDeck, type GameCard } from "./cards";
import {
  buildSchedulerQueue,
  createEffectInstances,
  getInitialMaterialLimit,
  type EffectInstance,
  type RetentionSelector,
  type ScoreSelector,
  type ScoreOperation,
  type RevealPlanOperation,
  type SchedulerEntry,
} from "./effects";
import { createSeededRandom, shuffleWith } from "./random";

export const DEFAULT_SEED = "royal-forge";
export const INITIAL_HAND_SIZE = 6;
export const SYNTHESIS_MIN_MATERIALS = 4;
export const STAGE_BONUS: Record<Phase, number> = { 1: 0, 2: 1, 3: 2 };

export type Phase = 1 | 2 | 3;
export type SynthesisStatus = "idle" | "resolving" | "risk" | "retention" | "finished" | "game-over";

export type PendingDecision =
  | { type: "risk-reveal"; preview: GameCard | null; forced: boolean }
  | { type: "retain-materials"; candidateIds: string[]; count: number; preview: null; forced: false };

export interface RetentionRequest {
  sourceCardId: string;
  selector: RetentionSelector;
}

export interface SynthesisRuntime {
  effects: EffectInstance[];
  queue: SchedulerEntry[];
  cursor: number;
  executedEffectIds: string[];
  pendingDecision: PendingDecision | null;
  retentionRequests: RetentionRequest[];
  retainedMaterialIds: string[];
  step: "effects" | "risk-decision" | "complete";
}

export interface RevealPlan {
  baseSafeQuota: number;
  baseRiskQuota: number;
  safeBonus: number;
  riskBonus: number;
  safeQuota: number;
  riskQuota: number;
  conversion: "none" | "safe-to-risk" | "risk-to-safe";
  riskForced: boolean;
  riskOverride: number | null;
  previewRisk: boolean;
}

export interface SynthesisSummary {
  materials: GameCard[];
  materialColors: string[];
  safeQuota: number;
  riskQuota: number;
  safeResolved: number;
  riskResolved: number;
  riskFailures: number;
  checkpoints: number[];
  score: number;
  phaseBonus: number;
  scoreAdjustment: number;
  materialScores: Record<string, number>;
  scoreMultiplier: number;
  revealScoreModifiers: ScoreOperation[];
  effectiveColors: Record<string, string[]>;
  globalColorOverride: "R" | "Y" | "B" | "W" | null;
  guaranteedAcquisitions: number[];
  explosionProtection: number;
  gained: GameCard[];
  failed: GameCard[];
  destroyed: GameCard[];
  lastEvent: string;
  revealPlan: RevealPlan;
  runtime: SynthesisRuntime;
}

export interface GameState {
  seed: string;
  basicDeck: GameCard[];
  treasureDeck: GameCard[];
  hand: GameCard[];
  revealedTreasures: GameCard[];
  basicDiscard: GameCard[];
  treasureDiscard: GameCard[];
  ownedTreasures: GameCard[];
  selectedMaterialIds: string[];
  materialLimit: number;
  phase: Phase;
  status: SynthesisStatus;
  stagePromptVisible: boolean;
  synthesis: SynthesisSummary | null;
  cauldronExplosions: number;
  terminalScore: number | null;
  pendingBasicDraws: number;
  basicRecycleCount: number;
}

export function normalizeSeed(seed: string): string {
  return seed.trim() || DEFAULT_SEED;
}

export function createGame(
  seed: string,
  treasureDefinitions: readonly TreasureDefinition[] = defaultTreasureDefinitions,
): GameState {
  const normalizedSeed = normalizeSeed(seed);
  const random = createSeededRandom(normalizedSeed);
  const shuffledBasicDeck = shuffleWith(buildBasicDeck(), random);
  const treasureDeck = [...shuffleWith(buildTreasureDeck(treasureDefinitions), random), buildStagePromptCard()];

  return {
    seed: normalizedSeed,
    basicDeck: shuffledBasicDeck.slice(INITIAL_HAND_SIZE),
    treasureDeck,
    hand: shuffledBasicDeck.slice(0, INITIAL_HAND_SIZE),
    revealedTreasures: [],
    basicDiscard: [],
    treasureDiscard: [],
    ownedTreasures: [],
    selectedMaterialIds: [],
    materialLimit: SYNTHESIS_MIN_MATERIALS,
    phase: 1,
    status: "idle",
    stagePromptVisible: false,
    synthesis: null,
    cauldronExplosions: 0,
    terminalScore: null,
    pendingBasicDraws: 0,
    basicRecycleCount: 0,
  };
}

function fulfillBasicDraws(state: GameState, requested: number): GameState {
  let basicDeck = state.basicDeck;
  let basicDiscard = state.basicDiscard;
  let hand = state.hand;
  let remaining = requested;
  let recycleCount = state.basicRecycleCount;

  while (remaining > 0) {
    if (basicDeck.length === 0 && basicDiscard.length > 0) {
      recycleCount += 1;
      basicDeck = shuffleWith(
        basicDiscard,
        createSeededRandom(`${state.seed}:basic-recycle:${recycleCount}`),
      );
      basicDiscard = [];
    }
    const [card, ...rest] = basicDeck;
    if (!card) break;
    basicDeck = rest;
    hand = [...hand, card];
    remaining -= 1;
  }

  return {
    ...state,
    basicDeck,
    basicDiscard,
    hand,
    pendingBasicDraws: remaining,
    basicRecycleCount: recycleCount,
  };
}

export function drawBasicCard(state: GameState): GameState {
  const next = fulfillBasicDraws(state, 1);
  return next.pendingBasicDraws === 0 ? next : { ...next, pendingBasicDraws: state.pendingBasicDraws };
}

export function revealTreasureCard(state: GameState): GameState {
  const [card, ...treasureDeck] = state.treasureDeck;
  if (!card || card.kind === "stage") return state;

  return {
    ...state,
    treasureDeck,
    revealedTreasures: [...state.revealedTreasures, card],
  };
}

function selectedCards(state: GameState, ids: readonly string[]): GameCard[] {
  const cardsById = new Map(state.hand.map((card) => [card.id, card]));
  return ids.flatMap((id) => {
    const card = cardsById.get(id);
    return card ? [card] : [];
  });
}

export function canBeginSynthesis(state: GameState): boolean {
  return state.status === "idle"
    && state.selectedMaterialIds.length >= SYNTHESIS_MIN_MATERIALS
    && state.selectedMaterialIds.length <= state.materialLimit;
}

export function toggleMaterial(state: GameState, cardId: string): GameState {
  if (state.status !== "idle") return state;
  const card = state.hand.find((candidate) => candidate.id === cardId);
  if (!card || card.kind === "rare" || card.kind === "stage") return state;

  const alreadySelected = state.selectedMaterialIds.includes(cardId);
  if (!alreadySelected && state.selectedMaterialIds.length >= state.materialLimit) return state;

  const candidateIds = alreadySelected
    ? state.selectedMaterialIds.filter((id) => id !== cardId)
    : [...state.selectedMaterialIds, cardId];
  const materialLimit = getInitialMaterialLimit(selectedCards(state, candidateIds), SYNTHESIS_MIN_MATERIALS);
  const selectedMaterialIds = candidateIds.slice(0, materialLimit);

  return { ...state, selectedMaterialIds, materialLimit };
}

function appendToTreasureQueue(deck: GameCard[], card: GameCard): GameCard[] {
  const cleanCard = { ...card, resolution: undefined };
  const stageIndex = deck.findIndex((candidate) => candidate.kind === "stage");
  if (stageIndex < 0) return [...deck, cleanCard];
  return [...deck.slice(0, stageIndex + 1), cleanCard, ...deck.slice(stageIndex + 1)];
}

function resolveCauldronExplosion(state: GameState): GameState {
  if (!state.synthesis) return state;
  const explosions = Math.min(2, state.synthesis.riskFailures);
  const protectedFirst = explosions === 1 && state.synthesis.explosionProtection > 0;
  const destroyedNow = protectedFirst
    ? []
    : explosions === 1
      ? state.synthesis.gained.slice(-1)
      : state.synthesis.gained;
  const destroyedIds = new Set(destroyedNow.map((card) => card.id));
  const synthesis = {
    ...state.synthesis,
    explosionProtection: protectedFirst ? state.synthesis.explosionProtection - 1 : state.synthesis.explosionProtection,
    gained: protectedFirst ? state.synthesis.gained : explosions === 1 ? state.synthesis.gained.slice(0, -1) : [],
    destroyed: [...state.synthesis.destroyed, ...destroyedNow],
    lastEvent: protectedFirst
      ? "首次炸锅被香炉抵消，未损失宝物"
      : explosions === 1
      ? destroyedNow.length > 0
        ? "炸锅 1：失去本次最近获得的宝物"
        : "炸锅 1：本次尚未获得宝物，无宝物损毁"
      : "炸锅 2：本次合成获得的宝物全部失去，合成立即结束",
  };

  return {
    ...state,
    cauldronExplosions: explosions,
    treasureDeck: destroyedNow.reduce(appendToTreasureQueue, state.treasureDeck),
    revealedTreasures: state.revealedTreasures.map((card) =>
      destroyedIds.has(card.id) ? { ...card, resolution: "destroyed" as const } : card,
    ),
    synthesis,
  };
}

function cardColors(summary: SynthesisSummary, card: GameCard): string[] {
  if (summary.globalColorOverride) return [summary.globalColorOverride];
  return summary.effectiveColors[card.id] ?? (card.color === "Special" ? [] : [card.color]);
}

function matchesSelector(selector: ScoreSelector, card: GameCard, summary: SynthesisSummary, isRisk: boolean): boolean {
  const colors = cardColors(summary, card);
  switch (selector.type) {
    case "all-basic": return card.kind === "base";
    case "all-treasure": return card.kind === "treasure" || card.kind === "rare";
    case "color": return colors.includes(selector.color);
    case "safe-treasure": return !isRisk && (card.kind === "treasure" || card.kind === "rare");
    case "printed-score-at-most": return card.synthesisScore <= selector.threshold;
  }
}

function revealScore(summary: SynthesisSummary, card: GameCard, isRisk: boolean): number {
  let value = Object.values(summary.materialScores).reduce((total, score) => total + score, 0)
    + summary.phaseBonus
    + summary.scoreAdjustment;
  for (const operation of summary.revealScoreModifiers) {
    if (operation.type !== "add") continue;
    if (matchesSelector(operation.selector, card, summary, isRisk)) value += operation.amount;
  }
  return value * summary.scoreMultiplier;
}

function matchesAdditionalAcquireCondition(summary: SynthesisSummary, card: GameCard): boolean {
  const targetColor = card.additionalAcquireColor;
  return targetColor != null
    && summary.materials.every((material) => cardColors(summary, material).includes(targetColor));
}

function resolveTreasure(state: GameState, card: GameCard, summary: SynthesisSummary, isRisk = false): GameState {
  const next = {
    ...summary,
    safeResolved: isRisk ? summary.safeResolved : summary.safeResolved + 1,
    riskResolved: isRisk ? summary.riskResolved + 1 : summary.riskResolved,
  };
  const resolvedCard = { ...card, resolution: "failed" as const };
  const revealIndex = next.safeResolved + next.riskResolved;
  const currentScore = revealScore(next, card, isRisk);
  next.score = currentScore;
  const guaranteed = next.guaranteedAcquisitions.includes(revealIndex);
  const additionalAcquire = matchesAdditionalAcquireCondition(next, card);
  if (card.kind === "rare") {
    if (guaranteed || additionalAcquire || currentScore >= (card.difficulty ?? Number.MAX_SAFE_INTEGER)) {
      next.gained = [...next.gained, card];
      next.lastEvent = additionalAcquire && !guaranteed && currentScore < (card.difficulty ?? Number.MAX_SAFE_INTEGER)
        ? `通过额外条件获得稀有宝物：${card.name}`
        : `获得稀有宝物：${card.name}`;
      return { ...state, synthesis: next, revealedTreasures: [...state.revealedTreasures, { ...card, resolution: "gained" }] };
    }
    next.failed = [...next.failed, card];
    if (isRisk) next.riskFailures += 1;
    next.lastEvent = `稀有宝物获取失败：${card.name}`;
  } else if (guaranteed || currentScore >= (card.difficulty ?? 0)) {
    next.gained = [...next.gained, card];
    next.lastEvent = `获得宝物：${card.name}`;
    return { ...state, synthesis: next, revealedTreasures: [...state.revealedTreasures, { ...card, resolution: "gained" }] };
  } else {
    next.failed = [...next.failed, card];
    if (isRisk) next.riskFailures += 1;
    next.lastEvent = `宝物获取失败：${card.name}`;
  }
  const failedState = {
    ...state,
    treasureDeck: appendToTreasureQueue(state.treasureDeck, card),
    synthesis: next,
    revealedTreasures: [...state.revealedTreasures, resolvedCard],
  };
  return isRisk ? resolveCauldronExplosion(failedState) : failedState;
}

function recycleTreasureCards(cards: GameCard[]): GameCard[] {
  return cards.map(({ resolution: _resolution, ...card }) => card);
}

function resolveStageCard(state: GameState, summary: SynthesisSummary): GameState {
  if (state.phase === 3) {
    return {
      ...state,
      treasureDeck: state.treasureDeck.filter((card) => card.kind !== "stage"),
      status: "game-over",
      stagePromptVisible: false,
      terminalScore: calculateTerminalScore([...state.ownedTreasures, ...summary.gained]),
      synthesis: { ...summary, lastEvent: "第三张阶段提示卡：牌局结束" },
    };
  }

  const nextPhase = (state.phase + 1) as Phase;
  const remainingTreasure = state.treasureDeck.filter((card) => card.kind !== "stage");
  const shuffled = shuffleWith(
    recycleTreasureCards(remainingTreasure),
    createSeededRandom(`${state.seed}:phase:${nextPhase}`),
  );

  return {
    ...state,
    phase: nextPhase,
    treasureDeck: [...shuffled, buildStagePromptCard()],
    stagePromptVisible: false,
    synthesis: {
      ...summary,
      score: (Object.values(summary.materialScores).reduce((total, value) => total + value, 0)
        + STAGE_BONUS[nextPhase]
        + summary.scoreAdjustment) * summary.scoreMultiplier,
      phaseBonus: STAGE_BONUS[nextPhase],
      lastEvent: `阶段提示卡：进入第 ${nextPhase} 阶段`,
    },
  };
}

function drawAndResolve(state: GameState, summary: SynthesisSummary, isRisk = false): GameState {
  const [card, ...treasureDeck] = state.treasureDeck;
  if (!card) return { ...state, treasureDeck, synthesis: summary };
  if (card.kind === "stage") return resolveStageCard({ ...state, treasureDeck }, summary);
  return resolveTreasure({ ...state, treasureDeck }, card, summary, isRisk);
}

function updateRuntime(
  state: GameState,
  update: (runtime: SynthesisRuntime) => SynthesisRuntime,
): GameState {
  if (!state.synthesis) return state;
  return { ...state, synthesis: { ...state.synthesis, runtime: update(state.synthesis.runtime) } };
}

function conditionMatches(summary: SynthesisSummary, condition: "four-colors" | "same-color" | undefined): boolean {
  if (!condition) return true;
  return condition === "four-colors"
    ? summary.materialColors.length === 4
    : summary.materialColors.length === 1;
}

function applyRevealPlanOperation(state: GameState, operation: RevealPlanOperation): GameState {
  if (!state.synthesis) return state;
  const summary = state.synthesis;
  const initialized = summary.checkpoints.includes(0);
  const plan = { ...summary.revealPlan };

  switch (operation.type) {
    case "add-safe":
      if (!conditionMatches(summary, operation.condition)) return state;
      if (initialized) {
        if (plan.conversion === "safe-to-risk") plan.riskQuota += operation.amount;
        else plan.safeQuota += operation.amount;
      } else {
        plan.safeBonus += operation.amount;
      }
      break;
    case "add-risk":
      if (initialized) {
        if (plan.conversion === "risk-to-safe") plan.safeQuota += operation.amount;
        else plan.riskQuota += operation.amount;
      } else {
        plan.riskBonus += operation.amount;
      }
      break;
    case "convert-safe-to-risk":
      plan.conversion = "safe-to-risk";
      if (initialized) {
        plan.riskQuota += plan.safeQuota;
        plan.safeQuota = 0;
      }
      break;
    case "convert-risk-to-safe":
      plan.conversion = "risk-to-safe";
      if (initialized) {
        plan.safeQuota += plan.riskQuota;
        plan.riskQuota = 0;
      }
      break;
    case "force-risk":
      plan.riskForced = true;
      break;
    case "override-risk":
      plan.riskOverride = operation.amount;
      plan.riskForced = false;
      plan.previewRisk = false;
      if (initialized) plan.riskQuota = operation.amount;
      break;
    case "preview-risk":
      plan.previewRisk = true;
      break;
  }

  return {
    ...state,
    synthesis: {
      ...summary,
      safeQuota: plan.safeQuota,
      riskQuota: plan.riskQuota,
      revealPlan: plan,
    },
  };
}

function updateScoreFromMaterials(summary: SynthesisSummary): SynthesisSummary {
  const materialScore = Object.values(summary.materialScores).reduce((total, value) => total + value, 0);
  return { ...summary, score: (materialScore + summary.phaseBonus + summary.scoreAdjustment) * summary.scoreMultiplier };
}

function applyScoreOperation(summary: SynthesisSummary, operation: ScoreOperation): SynthesisSummary {
  const materialScores = { ...summary.materialScores };
  const materials = summary.materials;
  if (operation.type === "multiply-total") {
    return {
      ...summary,
      scoreMultiplier: summary.scoreMultiplier * operation.factor,
      score: summary.score * operation.factor,
    };
  }
  if (operation.type === "add-per-color") {
    const scoreAdjustment = summary.scoreAdjustment + summary.materialColors.length * operation.amount;
    return updateScoreFromMaterials({ ...summary, scoreAdjustment });
  }
  if (operation.type === "double-highest-printed-score") {
    const candidates = materials.filter((card) => cardColors(summary, card).includes(operation.color));
    const target = candidates.reduce<GameCard | null>((best, card) => {
      if (!best) return card;
      return card.synthesisScore > best.synthesisScore ? card : best;
    }, null);
    if (target) materialScores[target.id] = (materialScores[target.id] ?? target.synthesisScore) + target.synthesisScore;
    return updateScoreFromMaterials({ ...summary, materialScores });
  }
  const { selector, amount } = operation;
  for (const card of materials) {
    if (selector.type !== "safe-treasure" && matchesSelector(selector, card, summary, false)) {
      materialScores[card.id] = (materialScores[card.id] ?? card.synthesisScore) + amount;
    }
  }
  const revealScoreModifiers = selector.type === "safe-treasure"
    ? [...summary.revealScoreModifiers, operation]
    : summary.revealScoreModifiers;
  return updateScoreFromMaterials({ ...summary, materialScores, revealScoreModifiers });
}

function executeEffect(state: GameState, effect: EffectInstance): GameState {
  let next = state;
  if (effect.spec.type === "draw-basic") {
    next = fulfillBasicDraws(state, state.pendingBasicDraws + effect.spec.amount);
  } else if (effect.spec.type === "modify-reveal-plan") {
    next = applyRevealPlanOperation(state, effect.spec.operation);
  } else if (effect.spec.type === "set-self-colors") {
    next = updateRuntime(state, (runtime) => runtime);
    if (next.synthesis) {
      next = { ...next, synthesis: { ...next.synthesis, effectiveColors: { ...next.synthesis.effectiveColors, [effect.sourceCardId]: effect.spec.colors } } };
    }
  } else if (effect.spec.type === "set-all-colors") {
    if (state.synthesis) next = { ...state, synthesis: { ...state.synthesis, globalColorOverride: effect.spec.color } };
  } else if (effect.spec.type === "modify-score") {
    if (state.synthesis) next = { ...state, synthesis: applyScoreOperation(state.synthesis, effect.spec.operation) };
  } else if (effect.spec.type === "guarantee-acquisition") {
    if (state.synthesis) next = { ...state, synthesis: { ...state.synthesis, guaranteedAcquisitions: [...state.synthesis.guaranteedAcquisitions, effect.spec.revealIndex] } };
  } else if (effect.spec.type === "prevent-explosion-loss") {
    if (state.synthesis) next = { ...state, synthesis: { ...state.synthesis, explosionProtection: state.synthesis.explosionProtection + 1 } };
  } else if (effect.spec.type === "retain-materials") {
    if (state.synthesis) next = { ...state, synthesis: { ...state.synthesis, runtime: { ...state.synthesis.runtime, retentionRequests: [...state.synthesis.runtime.retentionRequests, { sourceCardId: effect.sourceCardId, selector: effect.spec.selector }] } } };
  }
  return updateRuntime(next, (runtime) => ({
    ...runtime,
    executedEffectIds: [...runtime.executedEffectIds, effect.id],
  }));
}

function resolveSafeCheckpoint(state: GameState): GameState {
  let next = state;
  while (
    next.synthesis
    && next.synthesis.safeResolved < next.synthesis.safeQuota
    && next.status !== "game-over"
  ) {
    const previousResolved = next.synthesis.safeResolved;
    const previousDeckSize = next.treasureDeck.length;
    const previousPhase = next.phase;
    next = drawAndResolve(next, next.synthesis);
    if (
      next.synthesis?.safeResolved === previousResolved
      && next.treasureDeck.length === previousDeckSize
      && next.phase === previousPhase
    ) break;
  }
  return next;
}

function executeCheckpoint(state: GameState, priority: number): GameState {
  if (!state.synthesis) return state;
  let next: GameState = {
    ...state,
    synthesis: {
      ...state.synthesis,
      checkpoints: [...state.synthesis.checkpoints, priority],
    },
  };

  if (priority === 0) {
    const summary = next.synthesis!;
    const effectiveColors = { ...summary.effectiveColors };
    const colors = [...new Set(summary.materials.flatMap((card) => {
      if (summary.globalColorOverride) return [summary.globalColorOverride];
      return effectiveColors[card.id] ?? (card.color === "Special" ? [] : [card.color]);
    }))];
    const plan = { ...summary.revealPlan };
    const baseSafeQuota = Math.max(0, summary.materials.length - colors.length);
    const baseRiskQuota = colors.length;
    let safeQuota = baseSafeQuota + plan.safeBonus;
    let riskQuota = baseRiskQuota + plan.riskBonus;
    if (plan.conversion === "safe-to-risk") {
      riskQuota += safeQuota;
      safeQuota = 0;
    } else if (plan.conversion === "risk-to-safe") {
      safeQuota += riskQuota;
      riskQuota = 0;
    }
    if (plan.riskOverride !== null) riskQuota = plan.riskOverride;
    plan.baseSafeQuota = baseSafeQuota;
    plan.baseRiskQuota = baseRiskQuota;
    plan.safeQuota = safeQuota;
    plan.riskQuota = riskQuota;
    const materialScores = Object.fromEntries(summary.materials.map((card) => [card.id, card.synthesisScore]));
    const score = summary.materials.reduce((total, card) => total + card.synthesisScore, 0) + STAGE_BONUS[next.phase];
    next = {
      ...next,
      synthesis: {
        ...summary,
        materialColors: colors,
        safeQuota,
        riskQuota,
        revealPlan: plan,
        score,
        phaseBonus: STAGE_BONUS[next.phase],
        materialScores,
        lastEvent: `Priority 0：${colors.length} 种颜色，安全 ${safeQuota}，风险 ${riskQuota}`,
      },
    };
  } else if (priority === 50) {
    next = resolveSafeCheckpoint(next);
  } else if (priority === 100) {
    const summary = next.synthesis!;
    const hasRiskDecision = summary.riskResolved < summary.riskQuota
      && next.treasureDeck.length > 0;
    if (hasRiskDecision) {
      next = {
        ...next,
        status: "risk",
        synthesis: {
          ...summary,
          lastEvent: `Priority 100：安全宝物结算完成，等待风险牌（${summary.riskQuota} 张）`,
          runtime: {
            ...summary.runtime,
            step: "risk-decision",
            pendingDecision: { type: "risk-reveal", preview: null, forced: summary.revealPlan.riskForced },
          },
        },
      };
    }
  } else if (priority === 150) {
    const summary = next.synthesis!;
    next = {
      ...next,
      synthesis: {
        ...summary,
        lastEvent: `Priority 150：风险流程结束，开始处理收尾效果`,
      },
    };
  }
  return next;
}

function finalizeSynthesis(state: GameState, selectedRetentionIds: readonly string[] = []): GameState {
  if (!state.synthesis) return state;
  const { materials, gained, runtime } = state.synthesis;
  const autoRetained = new Set<string>();
  for (const request of runtime.retentionRequests) {
    if (request.selector.type !== "treasure-difficulty-below-source") continue;
    const source = materials.find((card) => card.id === request.sourceCardId);
    if (!source) continue;
    for (const card of materials) {
      if (card.kind === "treasure" && (card.difficulty ?? Number.MAX_SAFE_INTEGER) < (source.difficulty ?? 0)) autoRetained.add(card.id);
    }
  }
  const clayCount = runtime.retentionRequests.reduce((count, request) => count + (request.selector.type === "choose" ? request.selector.count : 0), 0);
  const clayCandidates = materials.filter((card) => !autoRetained.has(card.id)).map((card) => card.id);
  if (clayCount > 0 && selectedRetentionIds.length === 0 && runtime.retainedMaterialIds.length === 0 && !runtime.pendingDecision) {
    return {
      ...state,
      status: "retention",
      synthesis: {
        ...state.synthesis,
        runtime: {
          ...runtime,
          pendingDecision: { type: "retain-materials", candidateIds: clayCandidates, count: Math.min(clayCount, clayCandidates.length), preview: null, forced: false },
        },
      },
    };
  }
  const retainedIds = new Set([...autoRetained, ...selectedRetentionIds]);
  const basicMaterials = materials.filter((card) => card.kind === "base" && !retainedIds.has(card.id));
  const treasureMaterials = materials.filter((card) => card.kind === "treasure" && !retainedIds.has(card.id));
  const retainedMaterials = materials.filter((card) => retainedIds.has(card.id));
  const event = state.cauldronExplosions >= 2
    ? state.synthesis.lastEvent
    : `Priority 150：本次合成完成，获得 ${gained.length} 张宝物`;
  let next: GameState = {
    ...state,
    hand: [...state.hand, ...gained, ...retainedMaterials],
    basicDiscard: [...state.basicDiscard, ...basicMaterials],
    treasureDiscard: [...state.treasureDiscard, ...treasureMaterials],
    ownedTreasures: [...state.ownedTreasures, ...gained],
    status: "idle",
    stagePromptVisible: false,
    terminalScore: null,
    synthesis: {
      ...state.synthesis,
      lastEvent: event,
      runtime: { ...runtime, retainedMaterialIds: [...retainedIds], step: "complete", pendingDecision: null },
    },
  };
  if (next.pendingBasicDraws > 0) next = fulfillBasicDraws(next, next.pendingBasicDraws);
  return next;
}

export function runUntilBlocked(state: GameState): GameState {
  let next = state;
  while (next.synthesis && next.status !== "game-over") {
    const runtime = next.synthesis.runtime;
    if (runtime.pendingDecision) return next;
    const entry = runtime.queue[runtime.cursor];
    if (!entry) return finalizeSynthesis(next);

    next = updateRuntime(next, (current) => ({ ...current, cursor: current.cursor + 1 }));
    next = entry.kind === "checkpoint"
      ? executeCheckpoint(next, entry.priority)
      : executeEffect(next, entry.effect);
    if (next.synthesis?.runtime.pendingDecision) return next;
  }
  return next;
}

export function beginSynthesis(state: GameState): GameState {
  if (!canBeginSynthesis(state)) return state;
  const materials = selectedCards(state, state.selectedMaterialIds);
  if (materials.length !== state.selectedMaterialIds.length) return state;
  const effects = createEffectInstances(materials);
  const summary: SynthesisSummary = {
    materials,
    materialColors: [],
    safeQuota: 0,
    riskQuota: 0,
    safeResolved: 0,
    riskResolved: 0,
    riskFailures: 0,
    checkpoints: [],
    score: 0,
    phaseBonus: STAGE_BONUS[state.phase],
    scoreAdjustment: 0,
    materialScores: {},
    scoreMultiplier: 1,
    revealScoreModifiers: [],
    effectiveColors: Object.fromEntries(materials.map((card) => [card.id, card.color === "Special" ? [] : [card.color]])),
    globalColorOverride: null,
    guaranteedAcquisitions: [],
    explosionProtection: 0,
    gained: [],
    failed: [],
    destroyed: [],
    lastEvent: "开始执行材料效果",
    revealPlan: {
      baseSafeQuota: 0,
      baseRiskQuota: 0,
      safeBonus: 0,
      riskBonus: 0,
      safeQuota: 0,
      riskQuota: 0,
      conversion: "none",
      riskForced: false,
      riskOverride: null,
      previewRisk: false,
    },
    runtime: {
      effects,
      queue: buildSchedulerQueue(effects),
      cursor: 0,
      executedEffectIds: [],
      pendingDecision: null,
      retentionRequests: [],
      retainedMaterialIds: [],
      step: "effects",
    },
  };
  const selectedIds = new Set(state.selectedMaterialIds);
  const next: GameState = {
    ...state,
    hand: state.hand.filter((card) => !selectedIds.has(card.id)),
    selectedMaterialIds: [],
    materialLimit: SYNTHESIS_MIN_MATERIALS,
    revealedTreasures: [],
    synthesis: summary,
    status: "resolving",
    cauldronExplosions: 0,
  };
  return runUntilBlocked(next);
}

function resumeAfterRisk(state: GameState): GameState {
  const resumed = updateRuntime(
    { ...state, status: "resolving" },
    (runtime) => ({ ...runtime, step: "effects", pendingDecision: null }),
  );
  return runUntilBlocked(resumed);
}

function showRiskPreview(state: GameState): GameState {
  if (!state.synthesis) return state;
  const card = state.treasureDeck[0];
  if (!card || card.kind === "stage") return state;
  return updateRuntime(state, (runtime) => ({
    ...runtime,
    pendingDecision: {
      type: "risk-reveal",
      preview: card,
      forced: runtime.pendingDecision?.type === "risk-reveal" ? runtime.pendingDecision.forced : false,
    },
  }));
}

export function resolveNextRisk(state: GameState, continueReveal = true): GameState {
  if (
    state.status !== "risk"
    || !state.synthesis
    || state.synthesis.runtime.pendingDecision?.type !== "risk-reveal"
  ) return state;
  const pending = state.synthesis.runtime.pendingDecision;
  const forced = pending.forced;
  if (state.synthesis.revealPlan.previewRisk && pending.preview === null && continueReveal) {
    const previewed = showRiskPreview(state);
    if (previewed !== state) return previewed;
  }
  if ((!continueReveal && !forced) || state.synthesis.riskResolved >= state.synthesis.riskQuota || !state.treasureDeck.length) {
    return resumeAfterRisk(state);
  }

  let next = drawAndResolve(
    state,
    { ...state.synthesis, lastEvent: `风险牌 ${state.synthesis.riskResolved + 1}/${state.synthesis.riskQuota} 已翻开` },
    true,
  );
  if (next.status === "game-over") return next;
  next = updateRuntime(next, (runtime) => ({
    ...runtime,
    pendingDecision: runtime.pendingDecision?.type === "risk-reveal"
      ? { ...runtime.pendingDecision, preview: null }
      : runtime.pendingDecision,
  }));
  if (
    next.cauldronExplosions >= 2
    || (next.synthesis?.riskResolved ?? 0) >= (next.synthesis?.riskQuota ?? 0)
    || next.treasureDeck.length === 0
  ) return resumeAfterRisk(next);
  return next;
}

export type SynthesisDecision =
  | { type: "continue-risk" }
  | { type: "stop-risk" }
  | { type: "accept-preview" }
  | { type: "reject-preview" }
  | { type: "select-retained-materials"; cardIds: string[] };

export function submitSynthesisDecision(state: GameState, decision: SynthesisDecision): GameState {
  if (decision.type === "continue-risk" || decision.type === "accept-preview") return resolveNextRisk(state, true);
  if (decision.type === "stop-risk" || decision.type === "reject-preview") return resolveNextRisk(state, false);
  if (state.status !== "retention" || !state.synthesis || state.synthesis.runtime.pendingDecision?.type !== "retain-materials") return state;
  const pending = state.synthesis.runtime.pendingDecision;
  const uniqueIds = [...new Set(decision.cardIds)];
  if (uniqueIds.length > pending.count || uniqueIds.some((id) => !pending.candidateIds.includes(id))) return state;
  return finalizeSynthesis(state, uniqueIds);
}

export function finishSynthesis(state: GameState): GameState {
  if (!state.synthesis || state.synthesis.runtime.step === "complete") return state;
  return state.synthesis.runtime.pendingDecision?.type === "risk-reveal" ? resumeAfterRisk(state) : runUntilBlocked(state);
}

export function advanceStage(state: GameState): GameState {
  if (!state.stagePromptVisible || state.status !== "finished") return state;
  if (state.phase === 3) {
    return { ...state, stagePromptVisible: false, status: "game-over", terminalScore: calculateTerminalScore(state.ownedTreasures), treasureDeck: state.treasureDeck.filter((card) => card.kind !== "stage") };
  }
  const phase = (state.phase + 1) as Phase;
  return {
    ...state,
    phase,
    stagePromptVisible: false,
    status: "idle",
    synthesis: null,
    revealedTreasures: [],
    treasureDeck: state.treasureDeck,
  };
}

export function calculateTerminalScore(treasures: GameCard[]): number {
  return treasures.filter((card) => card.kind === "rare").reduce((total, card) => {
    const difficulty = card.difficulty ?? 0;
    return total + (difficulty >= 20 ? 5 : difficulty >= 18 ? 4 : difficulty >= 16 ? 3 : 0);
  }, 0);
}
