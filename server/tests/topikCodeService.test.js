const test = require("node:test");
const assert = require("node:assert/strict");

const {
  buildNextTopicCode,
  createTopicWithGeneratedCode,
} = require("../services/topikCodeService");

test("buildNextTopicCode memakai prefix cluster dan nomor urut dua digit", () => {
  assert.equal(buildNextTopicCode("ITSC", []), "ITSC01");
  assert.equal(buildNextTopicCode("ITSC", ["ITSC01", "ITSC09", "SIBER99"]), "ITSC10");
  assert.equal(buildNextTopicCode("ITSC", ["ITSC101"]), "ITSC102");
});

test("buildNextTopicCode mengabaikan kode dengan suffix yang bukan angka", () => {
  assert.equal(buildNextTopicCode("MVK", ["MVK-LAMA", "MVK02", "MVK2A"]), "MVK03");
});

test("createTopicWithGeneratedCode mencoba nomor berikutnya saat terjadi bentrok", async () => {
  const storedCodes = ["ITSC01"];
  let createAttempts = 0;
  const Topik = {
    async findAll() {
      return storedCodes.map((kode) => ({ kode }));
    },
    async create(values) {
      createAttempts += 1;
      if (createAttempts === 1) {
        storedCodes.push(values.kode);
        const error = new Error("duplicate");
        error.name = "SequelizeUniqueConstraintError";
        throw error;
      }
      return values;
    },
  };

  const topic = await createTopicWithGeneratedCode({
    Topik,
    clusterCode: "ITSC",
    values: { judul: "Topik baru" },
  });

  assert.equal(topic.kode, "ITSC03");
  assert.equal(createAttempts, 2);
});

test("createTopicWithGeneratedCode mengunci generator saat memakai transaksi PostgreSQL", async () => {
  const calls = [];
  const transaction = { id: "transaction-1" };
  const Topik = {
    sequelize: {
      getDialect: () => "postgres",
      async query(sql, options) {
        calls.push({ sql, options });
      },
    },
    async findAll() {
      return [];
    },
    async create(values) {
      return values;
    },
  };

  const topic = await createTopicWithGeneratedCode({
    Topik,
    clusterCode: "SIBER",
    values: { judul: "Topik keamanan" },
    transaction,
  });

  assert.equal(topic.kode, "SIBER01");
  assert.equal(calls.length, 1);
  assert.match(calls[0].sql, /pg_advisory_xact_lock/);
  assert.equal(calls[0].options.transaction, transaction);
});
