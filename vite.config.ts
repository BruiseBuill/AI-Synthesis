import { readFileSync } from "node:fs";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig(({ command, isPreview }) => ({
  base: command === "build" || isPreview ? "/AI-Synthesis/" : "/",
  plugins: [
    react(),
    {
      name: "bundle-card-data-workbook",
      apply: "build",
      generateBundle() {
        this.emitFile({
          type: "asset",
          fileName: "CardData.xlsm",
          source: readFileSync(new URL("./CardData.xlsm", import.meta.url)),
        });
      },
    },
  ],
}));
