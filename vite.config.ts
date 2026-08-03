import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig(({ command, isPreview }) => {
  const workbookPath = resolve("CardData.xlsm");

  return {
    base: command === "build" || isPreview ? "/AI-Synthesis/" : "/",
    plugins: [
      react(),
      {
        name: "card-data-workbook",
        configureServer(server) {
          server.watcher.add(workbookPath);
          server.watcher.on("change", (changedPath) => {
            if (resolve(changedPath) === workbookPath) server.ws.send({ type: "full-reload" });
          });
        },
        generateBundle() {
          this.emitFile({
            type: "asset",
            fileName: "CardData.xlsm",
            source: readFileSync(workbookPath),
          });
        },
      },
    ],
  };
});
