const { Op } = require("sequelize");

const MINIMUM_NUMBER_WIDTH = 2;
const MAX_GENERATION_ATTEMPTS = 20;
const POSTGRES_GENERATION_LOCK_KEY = "sima-topik-code-generation";

function buildNextTopicCode(clusterCode, existingCodes = []) {
  const prefix = String(clusterCode || "").trim().toUpperCase();
  if (!prefix) {
    throw new Error("Prefix cluster wajib tersedia untuk membuat kode topik.");
  }

  const codePattern = new RegExp(`^${prefix}(\\d+)$`);
  let highestNumber = 0;

  for (const value of existingCodes) {
    const code = String(value || "").trim().toUpperCase();
    const match = code.match(codePattern);
    if (!match) continue;

    const number = Number(match[1]);
    if (Number.isSafeInteger(number) && number > highestNumber) {
      highestNumber = number;
    }
  }

  const nextNumber = highestNumber + 1;
  return `${prefix}${String(nextNumber).padStart(MINIMUM_NUMBER_WIDTH, "0")}`;
}

async function getNextTopicCode(Topik, clusterCode, transaction = null) {
  const prefix = String(clusterCode || "").trim().toUpperCase();
  const rows = await Topik.findAll({
    attributes: ["kode"],
    where: { kode: { [Op.like]: `${prefix}%` } },
    raw: true,
    transaction: transaction || undefined,
  });

  return buildNextTopicCode(prefix, rows.map((row) => row.kode));
}

async function createTopicWithGeneratedCode({ Topik, clusterCode, values, transaction = null }) {
  if (transaction && Topik.sequelize?.getDialect?.() === "postgres") {
    await Topik.sequelize.query(
      "SELECT pg_advisory_xact_lock(hashtext(:lockKey))",
      {
        replacements: { lockKey: POSTGRES_GENERATION_LOCK_KEY },
        transaction,
      }
    );
  }

  for (let attempt = 0; attempt < MAX_GENERATION_ATTEMPTS; attempt += 1) {
    const kode = await getNextTopicCode(Topik, clusterCode, transaction);
    try {
      return await Topik.create({ ...values, kode }, { transaction: transaction || undefined });
    } catch (error) {
      if (error?.name !== "SequelizeUniqueConstraintError") throw error;
    }
  }

  const error = new Error("Kode topik unik gagal dibuat. Silakan coba kembali.");
  error.statusCode = 409;
  throw error;
}

module.exports = {
  buildNextTopicCode,
  createTopicWithGeneratedCode,
};
