/// <reference types="vite/client" />

import type { useGameStore } from "./store/gameStore";

declare global {
  interface Window {
    __SYNTHESIS_SOLO_STORE__?: typeof useGameStore;
  }
}
