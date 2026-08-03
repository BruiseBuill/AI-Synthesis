import { create } from "zustand";
import {
  builtInCatalogVersion,
  countCards,
  defaultTreasureDefinitions,
  getCatalogVersion,
  type TreasureDefinition,
} from "../data/cardData";
import { parseCardDataWorkbook } from "../data/cardDataImport";
import {
  clearCardDataSnapshot,
  isSnapshotCurrent,
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
  fileName: "CardData.xlsm",
  importedAt: null,
};

const browserRandom: RandomSource = () => {
  const value = new Uint32Array(1);
  globalThis.crypto.getRandomValues(value);
  return value[0] / 0x1_0000_0000;
};

const initialSeed = createRandomSeed(browserRandom);

async function persistImport(
  definitions: TreasureDefinition[],
  source: Extract<CardDataSource, { type: "imported" }>,
): Promise<CardDataSource> {
  await saveCardDataSnapshot({ definitions, source });
  return source;
}

async function readBundledCardData(): Promise<TreasureDefinition[]> {
  const response = await fetch(`${import.meta.env.BASE_URL}CardData.xlsm?reload=${Date.now()}`, { cache: "no-store" });
  if (!response.ok) throw new Error("项目中未找到 CardData.xlsm，请使用“选择 Excel 文件”导入");
  return parseCardDataWorkbook(await response.arrayBuffer());
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
    set({ cardDataStatus: "loading", cardDataMessage: null });
    try {
      const snapshot = await loadCardDataSnapshot();
      if (snapshot?.source.type === "imported" && isSnapshotCurrent(snapshot, builtInCatalogVersion)) {
        set((state) => ({
          ...createGame(state.seed, snapshot.definitions),
          cardDefinitions: snapshot.definitions,
          cardDataSource: snapshot.source,
          cardDataStatus: "idle",
          cardDataMessage: null,
        }));
        return;
      }
      if (snapshot) {
        await clearCardDataSnapshot();
      }
      const definitions = await readBundledCardData();
      set((state) => ({
        ...createGame(state.seed, definitions),
        cardDefinitions: definitions,
        cardDataSource: builtInSource,
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
      const definitions = await readBundledCardData();
      await clearCardDataSnapshot();
      const source: CardDataSource = {
        type: "bundled",
        fileName: "CardData.xlsm",
        importedAt: new Date().toISOString(),
        builtInVersion: getCatalogVersion(definitions),
      };
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
      const source = await persistImport(definitions, {
        type: "imported",
        fileName: file.name,
        importedAt: new Date().toISOString(),
      });
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
      const definitions = await readBundledCardData();
      set((state) => ({
        ...createGame(state.seed, definitions),
        cardDefinitions: definitions,
        cardDataSource: builtInSource,
        cardDataStatus: "success",
        cardDataMessage: `已恢复 CardData.xlsm，共 ${countCards(definitions)} 张卡牌`,
      }));
    } catch (error) {
      set({ cardDataStatus: "error", cardDataMessage: errorMessage(error) });
    }
  },
}));
