import { create } from "zustand";
import { countCards, defaultTreasureDefinitions, type TreasureDefinition } from "../data/cardData";
import { parseCardDataWorkbook } from "../data/cardDataImport";
import {
  clearCardDataSnapshot,
  loadCardDataSnapshot,
  saveCardDataSnapshot,
  type CardDataSource,
} from "../data/cardDataRepository";
import {
  advanceStage,
  beginSynthesis,
  canBeginSynthesis,
  createGame,
  resolveNextRisk,
  submitSynthesisDecision,
  toggleMaterial,
  type GameState,
} from "../game-core/game";
import { createRandomSeed, type RandomSource } from "../game-core/random";

type CardDataStatus = "idle" | "loading" | "success" | "error";

interface GameActions {
  startGame: (seed: string) => void;
  toggleMaterial: (cardId: string) => void;
  beginSynthesis: () => void;
  canSynthesize: () => boolean;
  resolveRisk: (continueReveal: boolean) => void;
  selectRetainedMaterials: (cardIds: string[]) => void;
  advanceStage: () => void;
  hydrateCardData: () => Promise<void>;
  reloadBundledCardData: () => Promise<void>;
  importCardDataFile: (file: File) => Promise<void>;
  restoreBuiltInCardData: () => Promise<void>;
}

interface CardDataState {
  cardDefinitions: TreasureDefinition[];
  cardDataSource: CardDataSource;
  cardDataStatus: CardDataStatus;
  cardDataMessage: string | null;
}

type GameStore = GameState & GameActions & CardDataState;

const builtInSource: CardDataSource = {
  type: "built-in",
  fileName: "内置卡牌数据",
  importedAt: null,
};

const browserRandom: RandomSource = () => {
  const value = new Uint32Array(1);
  globalThis.crypto.getRandomValues(value);
  return value[0] / 0x1_0000_0000;
};

const initialSeed = createRandomSeed(browserRandom);

async function persistImport(definitions: TreasureDefinition[], fileName: string): Promise<CardDataSource> {
  const source: CardDataSource = {
    type: "imported",
    fileName,
    importedAt: new Date().toISOString(),
  };
  await saveCardDataSnapshot({ definitions, source });
  return source;
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "卡牌数据重载失败";
}

export const useGameStore = create<GameStore>((set, get) => ({
  ...createGame(initialSeed, defaultTreasureDefinitions),
  cardDefinitions: defaultTreasureDefinitions,
  cardDataSource: builtInSource,
  cardDataStatus: "idle",
  cardDataMessage: null,
  startGame: (seed) => set((state) => createGame(seed, state.cardDefinitions)),
  toggleMaterial: (cardId) => set((state) => toggleMaterial(state, cardId)),
  beginSynthesis: () => set((state) => beginSynthesis(state)),
  canSynthesize: () => canBeginSynthesis(get()),
  resolveRisk: (continueReveal) => set((state) => resolveNextRisk(state, continueReveal)),
  selectRetainedMaterials: (cardIds) => set((state) => submitSynthesisDecision(state, { type: "select-retained-materials", cardIds })),
  advanceStage: () => set((state) => advanceStage(state)),
  hydrateCardData: async () => {
    try {
      const snapshot = await loadCardDataSnapshot();
      if (!snapshot) return;
      set((state) => ({
        ...createGame(state.seed, snapshot.definitions),
        cardDefinitions: snapshot.definitions,
        cardDataSource: snapshot.source,
        cardDataStatus: "idle",
        cardDataMessage: null,
      }));
    } catch (error) {
      set({ cardDataStatus: "error", cardDataMessage: errorMessage(error) });
    }
  },
  reloadBundledCardData: async () => {
    set({ cardDataStatus: "loading", cardDataMessage: "正在读取 CardData.xlsm…" });
    try {
      const response = await fetch(`${import.meta.env.BASE_URL}CardData.xlsm?reload=${Date.now()}`, { cache: "no-store" });
      if (!response.ok) throw new Error("项目中未找到 CardData.xlsm，请使用“选择 Excel 文件”导入");
      const definitions = await parseCardDataWorkbook(await response.arrayBuffer());
      const source = await persistImport(definitions, "CardData.xlsm");
      set((state) => ({
        ...createGame(state.seed, definitions),
        cardDefinitions: definitions,
        cardDataSource: source,
        cardDataStatus: "success",
        cardDataMessage: `已重载 ${definitions.length} 条定义，共 ${countCards(definitions)} 张卡牌`,
      }));
    } catch (error) {
      set({ cardDataStatus: "error", cardDataMessage: errorMessage(error) });
    }
  },
  importCardDataFile: async (file) => {
    set({ cardDataStatus: "loading", cardDataMessage: `正在读取 ${file.name}…` });
    try {
      const definitions = await parseCardDataWorkbook(await file.arrayBuffer());
      const source = await persistImport(definitions, file.name);
      set((state) => ({
        ...createGame(state.seed, definitions),
        cardDefinitions: definitions,
        cardDataSource: source,
        cardDataStatus: "success",
        cardDataMessage: `已导入 ${definitions.length} 条定义，共 ${countCards(definitions)} 张卡牌`,
      }));
    } catch (error) {
      set({ cardDataStatus: "error", cardDataMessage: errorMessage(error) });
    }
  },
  restoreBuiltInCardData: async () => {
    set({ cardDataStatus: "loading", cardDataMessage: "正在恢复内置数据…" });
    try {
      await clearCardDataSnapshot();
      const seed = get().seed;
      set({
        ...createGame(seed, defaultTreasureDefinitions),
        cardDefinitions: defaultTreasureDefinitions,
        cardDataSource: builtInSource,
        cardDataStatus: "success",
        cardDataMessage: `已恢复内置数据，共 ${countCards(defaultTreasureDefinitions)} 张卡牌`,
      });
    } catch (error) {
      set({ cardDataStatus: "error", cardDataMessage: errorMessage(error) });
    }
  },
}));
