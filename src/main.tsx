import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import "./styles.css";
import { useGameStore } from "./store/gameStore";

if (import.meta.env.DEV) {
  window.__SYNTHESIS_SOLO_STORE__ = useGameStore;
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
