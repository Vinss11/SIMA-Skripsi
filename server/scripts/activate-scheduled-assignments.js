"use strict";

require("dotenv").config();
const { sequelize } = require("../models");
const { activateScheduledAssignments } = require("../services/semesterAssignmentService");

async function main() {
  const limitArg = process.argv.find((item) => item.startsWith("--limit="));
  const limit = Number(limitArg?.split("=")[1] || 50);
  const result = await activateScheduledAssignments({ limit });
  console.log(JSON.stringify(result, null, 2));
  if (result.failed.length) process.exitCode = 2;
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => sequelize.close());
