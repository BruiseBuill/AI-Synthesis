"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const node_1 = require("read-excel-file/node");
const node_path_1 = require("node:path");
const cardDataImport_1 = require("./src/data/cardDataImport");
(async () => {
    const workbookPath = (0, node_path_1.resolve)("CardData.xlsm");
    const rows = await (0, node_1.readSheet)(workbookPath, "Sheet4");
    const definitions = (0, cardDataImport_1.parseCardDataRows)(rows);
    const fs = require("fs");
    fs.writeFileSync("src/data/cardData.generated.json", JSON.stringify(definitions, null, 2));
    console.log("Generated with", definitions.length, "definitions");
})();
