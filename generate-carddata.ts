import { readSheet } from "read-excel-file/node";
import { resolve } from "node:path";
import { parseCardDataRows } from "./src/data/cardDataImport";

(async () => {
  const workbookPath = resolve("CardData.xlsm");
  const rows = await readSheet(workbookPath, "Sheet4");
  const definitions = parseCardDataRows(rows as any);
  const fs = require("fs");
  fs.writeFileSync("src/data/cardData.generated.json", JSON.stringify(definitions, null, 2));
  console.log("Generated with", definitions.length, "definitions");
})();
