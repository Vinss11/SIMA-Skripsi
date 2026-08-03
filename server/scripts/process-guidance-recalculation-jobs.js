"use strict";

process.env.NODE_ENV = process.env.NODE_ENV || "development";
require("dotenv").config();
const db = require("../models");
const { processProgressRecalculationJobOnce } = require("../services/guidanceProgressRecalculationService");

async function main() {
  const once = process.argv.includes("--once");
  do {
    let result;
    do { result = await processProgressRecalculationJobOnce(); } while (result);
    if (once) break;
    await new Promise((resolve) => setTimeout(resolve, 2000));
  } while (true);
}

if (require.main === module) main().catch((error) => { console.error(error); process.exitCode = 1; }).finally(() => db.sequelize.close());
