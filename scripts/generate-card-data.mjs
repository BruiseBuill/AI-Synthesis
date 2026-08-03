import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { readSheet } from "read-excel-file/node";
import { createServer } from "vite";

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const outputPath = resolve(repositoryRoot, "src/data/cardData.generated.json");
const vite = await createServer({
  root: repositoryRoot,
  appType: "custom",
  logLevel: "error",
  server: { middlewareMode: true },
});

try {
  const { parseCardDataRows } = await vite.ssrLoadModule("/src/data/cardDataImport.ts");
  const rows = await readSheet(resolve(repositoryRoot, "CardData.xlsm"), "Sheet4");
  const definitions = parseCardDataRows(rows);
  const serialized = `${JSON.stringify(definitions, null, 2)}\n`;

  await mkdir(dirname(outputPath), { recursive: true });
  await writeFile(outputPath, serialized, "utf8");
  console.log(`Generated ${definitions.length} card definitions in ${outputPath}`);
} finally {
  await vite.close();
}
