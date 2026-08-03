import { z } from "zod";
import { TreasureCatalogSchema, type TreasureDefinition } from "./cardData";

const DATABASE_NAME = "synthesis-solo";
const DATABASE_VERSION = 1;
const STORE_NAME = "card-data";
const ACTIVE_CATALOG_KEY = "active-catalog";

export interface CardDataSource {
  type: "built-in" | "imported";
  fileName: string;
  importedAt: string | null;
}

export interface CardDataSnapshot {
  definitions: TreasureDefinition[];
  source: CardDataSource;
}

const CardDataSnapshotSchema = z.object({
  definitions: TreasureCatalogSchema,
  source: z.object({
    type: z.literal("imported"),
    fileName: z.string().min(1),
    importedAt: z.string().datetime(),
  }),
});

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DATABASE_NAME, DATABASE_VERSION);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(STORE_NAME)) request.result.createObjectStore(STORE_NAME);
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("无法打开卡牌数据库"));
  });
}

async function runRequest<T>(mode: IDBTransactionMode, action: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const database = await openDatabase();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(STORE_NAME, mode);
    const request = action(transaction.objectStore(STORE_NAME));
    let result: T;
    request.onsuccess = () => { result = request.result; };
    request.onerror = () => reject(request.error ?? new Error("卡牌数据库操作失败"));
    transaction.oncomplete = () => {
      database.close();
      resolve(result);
    };
    transaction.onerror = () => {
      database.close();
      reject(transaction.error ?? new Error("卡牌数据库事务失败"));
    };
  });
}

export async function loadCardDataSnapshot(): Promise<CardDataSnapshot | null> {
  const stored = await runRequest("readonly", (store) => store.get(ACTIVE_CATALOG_KEY));
  if (stored == null) return null;
  const parsed = CardDataSnapshotSchema.safeParse(stored);
  if (!parsed.success) throw new Error("已保存的卡牌数据格式无效，请恢复内置数据");
  return parsed.data;
}

export async function saveCardDataSnapshot(snapshot: CardDataSnapshot): Promise<void> {
  await runRequest("readwrite", (store) => store.put(snapshot, ACTIVE_CATALOG_KEY));
}

export async function clearCardDataSnapshot(): Promise<void> {
  await runRequest("readwrite", (store) => store.delete(ACTIVE_CATALOG_KEY));
}
