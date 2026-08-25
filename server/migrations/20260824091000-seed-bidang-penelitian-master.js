"use strict";

const BIDANG_PENELITIAN_NAMES = [
  "adaptive web applications",
  "artificial intelligence",
  "artificial neural networks",
  "audit and control",
  "augmented reality",
  "big data",
  "blockchain",
  "business intelligence",
  "business process management",
  "causal modeling",
  "clinical decision support systems",
  "cloud computing",
  "cognitive radio networks",
  "competitive programming",
  "computational thinking",
  "computer networks",
  "computer science",
  "computer science education",
  "computer security",
  "computer vision",
  "cyber law",
  "cybersecurity",
  "data clustering",
  "data mining",
  "data profiling",
  "data science",
  "data visualization",
  "database technology",
  "databases",
  "decision support systems",
  "deep learning",
  "digital evidence",
  "digital forensics",
  "digital transformation",
  "e-government",
  "education",
  "educational technology",
  "egovernment",
  "embedded systems",
  "enterprise architecture",
  "enterprise engineering",
  "enterprise information systems",
  "enterprise systems",
  "eparticipation",
  "ethical hacking",
  "expert systems",
  "game-based learning",
  "gamification",
  "genetic algorithms",
  "geoinformatics",
  "health information systems",
  "human-computer interaction",
  "ict4d",
  "image processing",
  "information extraction",
  "information hiding",
  "information security",
  "information systems",
  "intelligent systems",
  "internet of things",
  "inventive problem solving & innovation",
  "it governance",
  "knowledge acquisition and representation",
  "learning technology",
  "linked data",
  "logic",
  "m-learning",
  "machine learning",
  "medical image processing",
  "medical imaging",
  "medical informatics",
  "mobile applications",
  "multimedia",
  "natural language processing",
  "network coding",
  "network forensics",
  "network security",
  "ontology",
  "open government data",
  "optimization",
  "pattern recognition",
  "probabilistic modeling",
  "programming",
  "psychometrics",
  "public policy",
  "reinforcement learning",
  "requirements engineering",
  "robotics",
  "semantic web",
  "serious games",
  "service computing",
  "soft computing",
  "software engineering",
  "software quality",
  "software testing",
  "sports informatics",
  "steganography",
  "tangible user interfaces",
  "text mining",
  "theoretical informatics",
  "topic modeling",
  "watermarking",
  "web technology",
  "wireless communications",
];

function titleCase(value) {
  return value.replace(/\b\w/g, (character) => character.toUpperCase());
}

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface) {
    await queryInterface.sequelize.transaction(async (transaction) => {
      const [existingRows] = await queryInterface.sequelize.query(
        `SELECT kode, LOWER(TRIM(nama)) AS normalized_name
         FROM "BidangPenelitians"`,
        { transaction }
      );
      const existingCodes = new Set(existingRows.map((row) => String(row.kode || "").trim().toUpperCase()));
      const existingNames = new Set(existingRows.map((row) => String(row.normalized_name || "").trim()));
      const now = new Date();

      const rows = BIDANG_PENELITIAN_NAMES.map((name, index) => {
        const kode = `BP${String(index + 1).padStart(3, "0")}`;
        const normalizedName = name.trim().toLowerCase();
        if (existingNames.has(normalizedName)) return null;
        if (existingCodes.has(kode)) {
          throw new Error(`Kode bidang penelitian ${kode} sudah digunakan oleh data lain.`);
        }
        const displayName = titleCase(name.trim());
        return {
          kode,
          nama: displayName,
          deskripsi: `Bidang penelitian yang berfokus pada ${displayName}.`,
          contoh_kata_kunci: name.trim(),
          createdAt: now,
          updatedAt: now,
        };
      }).filter(Boolean);

      if (rows.length > 0) {
        await queryInterface.bulkInsert("BidangPenelitians", rows, { transaction });
      }
    });
  },

  async down(queryInterface) {
    await queryInterface.sequelize.transaction(async (transaction) => {
      const codes = BIDANG_PENELITIAN_NAMES.map((_, index) => `BP${String(index + 1).padStart(3, "0")}`);
      await queryInterface.sequelize.query(
        `DELETE FROM "BidangPenelitians" AS bidang
         WHERE bidang.kode IN (:codes)
           AND NOT EXISTS (
             SELECT 1 FROM "DosenBidangPenelitians" rel
             WHERE rel.bidang_penelitian_id = bidang.id
           )
           AND NOT EXISTS (
             SELECT 1 FROM "PengajuanBidangPenelitians" rel
             WHERE rel.bidang_penelitian_id = bidang.id
           )
           AND NOT EXISTS (
             SELECT 1 FROM "TopikBidangPenelitians" rel
             WHERE rel.bidang_penelitian_id = bidang.id
           )`,
        { replacements: { codes }, transaction }
      );
    });
  },
};
