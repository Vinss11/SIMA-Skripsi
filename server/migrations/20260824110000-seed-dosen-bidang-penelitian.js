"use strict";

const DOSEN_BIDANG = [
  { nik: "145230403", nama: "Ahmad Fathan Hidayatullah", bidang: ["natural language processing", "data science", "text mining", "artificial intelligence", "machine learning", "deep learning", "topic modeling", "information extraction", "computer vision"] },
  { nik: "125230405", nama: "Ahmad Luthfi", bidang: ["digital forensics", "computer networks", "network security", "open government data", "digital evidence", "cloud computing", "information security", "ontology", "internet of things"] },
  { nik: "115230406", nama: "Aridhanyati Arifin", bidang: ["medical informatics", "decision support systems", "information systems", "human-computer interaction"] },
  { nik: "105230101", nama: "Andhik Budi Cahyono", bidang: ["software engineering", "software testing", "human-computer interaction", "information systems"] },
  { nik: "095230101", nama: "Ari Sujarwo", bidang: ["internet of things", "public policy", "information systems", "ict4d", "enterprise information systems", "information security"] },
  { nik: "155230103", nama: "Arrie Kurniawardhani", bidang: ["machine learning", "computer vision", "image processing", "pattern recognition", "artificial intelligence", "deep learning", "medical imaging", "augmented reality", "game-based learning"] },
  { nik: "085230102", nama: "Beni Suranto", bidang: ["software engineering", "human-computer interaction", "artificial intelligence"] },
  { nik: "135231101", nama: "Chandra Kusuma Dewa", bidang: ["machine learning", "multimedia", "reinforcement learning", "robotics", "deep learning", "natural language processing"] },
  { nik: "115230407", nama: "Chanifah Indah Ratnasari", bidang: ["information extraction", "medical informatics", "natural language processing", "information systems", "human-computer interaction", "machine learning", "game-based learning", "topic modeling", "gamification"] },
  { nik: "085230103", nama: "Dhomas Hatta Fudholi", bidang: ["big data", "deep learning", "natural language processing", "ontology", "data science", "topic modeling", "information extraction", "medical imaging"] },
  { nik: "115230408", nama: "Elyza Gustri Wahyuni", bidang: ["medical informatics", "decision support systems", "intelligent systems", "digital transformation", "expert systems", "soft computing"] },
  { nik: "115230409", nama: "Erika Ramadhani", bidang: ["digital forensics", "computer security", "network security", "computational thinking", "digital evidence"] },
  { nik: "105230102", nama: "Feri Wijayanto", bidang: ["machine learning", "probabilistic modeling", "causal modeling", "psychometrics", "data science", "data mining", "web technology", "deep learning"] },
  { nik: "115230404", nama: "Galang Prihadi Mahardhika", bidang: ["game-based learning", "gamification", "human-computer interaction", "educational technology", "tangible user interfaces", "multimedia"] },
  { nik: "115230402", nama: "Hari Setiaji", bidang: ["software engineering", "information systems", "database technology", "human-computer interaction", "medical informatics"] },
  { nik: "055230503", nama: "Hendrik", bidang: ["business intelligence", "linked data", "semantic web", "information systems", "learning technology", "ontology"] },
  { nik: "985240102", nama: "Izzati Muhimmah", bidang: ["medical informatics", "medical imaging", "computer vision", "image processing", "deep learning", "artificial intelligence", "internet of things", "human-computer interaction", "data mining"] },
  { nik: "074200501", nama: "Kholid Haryono", bidang: ["audit and control", "inventive problem solving & innovation", "it governance", "enterprise information systems", "information systems", "software engineering", "e-government", "business intelligence"] },
  { nik: "145230101", nama: "Kurniawan Dwi Irianto", bidang: ["cognitive radio networks", "internet of things", "wireless communications", "network coding", "network security", "educational technology", "human-computer interaction"] },
  { nik: "945230102", nama: "Sri Kusumadewi", bidang: ["medical informatics", "intelligent systems", "decision support systems", "clinical decision support systems", "soft computing"] },
  { nik: "105230404", nama: "Sheila Nurul Huda", bidang: ["computer science", "educational technology", "gamification", "game-based learning", "data mining"] },
  { nik: "115230101", nama: "Novi Setiani", bidang: ["computer science education", "software testing", "software engineering", "requirements engineering", "data mining", "human-computer interaction"] },
  { nik: "165230101", nama: "Moh. Idris", bidang: ["computer networks", "information systems", "human-computer interaction", "educational technology"] },
  { nik: "055230703", nama: "Syarif Hidayat", bidang: ["data mining", "embedded systems", "artificial intelligence"] },
  { nik: "965240102", nama: "Zainudin Zukhri", bidang: ["artificial intelligence", "optimization", "pattern recognition", "genetic algorithms", "soft computing"] },
  { nik: "945230101", nama: "Yudi Prayudi", bidang: ["digital evidence", "digital forensics", "cyber law", "computer security", "steganography", "watermarking", "network forensics", "information security", "cybersecurity"] },
  { nik: "135230506", nama: "Sri Mulyati", bidang: ["theoretical informatics", "intelligent systems", "data mining", "machine learning", "artificial intelligence", "soft computing"] },
  { nik: "045230101", nama: "Irving Vitra Paputungan", bidang: ["genetic algorithms", "databases", "internet of things", "optimization", "soft computing", "sports informatics", "human-computer interaction", "deep learning", "cloud computing", "natural language processing"] },
  { nik: "125230101", nama: "Hanson Prihantoro Putro", bidang: ["enterprise architecture", "competitive programming", "software testing", "software engineering", "software quality", "artificial intelligence", "machine learning"] },
  { nik: "045230406", nama: "Lizda Iswari", bidang: ["data profiling", "data clustering", "data visualization", "geoinformatics", "data mining", "decision support systems", "data science"] },
  { nik: "125230403", nama: "Fietyata Yudha", bidang: ["ethical hacking", "digital forensics", "network security", "cybersecurity", "artificial intelligence"] },
  { nik: "985230102", nama: "Fathul Wahid", bidang: ["egovernment", "eparticipation", "ict4d", "enterprise systems"] },
  { nik: "035230102", nama: "Mukhammad Andri Setiawan", bidang: ["information security", "business process management", "artificial intelligence", "information systems"] },
  { nik: "175230101", nama: "Fayruz Rahma", bidang: ["network forensics", "computer networks", "cybersecurity", "cloud computing", "artificial intelligence", "network security"] },
  { nik: "045230104", nama: "Nur Wijayaning Rahayu", bidang: ["databases", "education", "information systems", "artificial intelligence", "ontology"] },
  { nik: "985240101", nama: "Raden Teduh Dirgahayu", bidang: ["enterprise engineering", "software engineering", "service computing", "enterprise architecture", "blockchain", "business process management", "information systems", "human-computer interaction"] },
  { nik: "135231103", nama: "Almed Hamzah", bidang: ["adaptive web applications", "human-computer interaction", "m-learning", "learning technology", "information systems", "mobile applications"] },
  { nik: "235230509", nama: "Rahadian Kurniawan", bidang: ["serious games", "medical image processing", "health information systems", "clinical decision support systems", "medical informatics", "decision support systems", "medical imaging", "information systems"] },
  { nik: "195230101", nama: "Rian Adam Rajagede", bidang: ["artificial neural networks", "machine learning", "deep learning", "artificial intelligence"] },
  { nik: "155230104", nama: "Septia Rani", bidang: ["information hiding", "artificial intelligence", "data science", "machine learning", "human-computer interaction", "deep learning", "information extraction"] },
  { nik: "985230101", nama: "Taufiq Hidayat", bidang: ["knowledge acquisition and representation", "logic", "machine learning", "programming", "intelligent systems", "soft computing"] },
];

function normalize(value) {
  return String(value || "").trim().replace(/\s+/g, " ").toLowerCase();
}

async function loadReferences(queryInterface, transaction) {
  const niks = DOSEN_BIDANG.map((item) => item.nik);
  const [dosens] = await queryInterface.sequelize.query(
    `SELECT id, nik, nama FROM "Dosens" WHERE nik IN (:niks)`,
    { replacements: { niks }, transaction }
  );
  const [bidangRows] = await queryInterface.sequelize.query(
    `SELECT id, nama FROM "BidangPenelitians"`,
    { transaction }
  );
  const dosenByNik = new Map(dosens.map((row) => [String(row.nik), row]));
  const bidangByName = new Map(bidangRows.map((row) => [normalize(row.nama), row]));

  const missingFields = [...new Set(
    DOSEN_BIDANG.flatMap((item) => item.bidang).filter((name) => !bidangByName.has(normalize(name)))
  )];
  if (missingFields.length) {
    throw new Error(`Seed bidang penelitian dosen dibatalkan karena bidang tidak ditemukan (${missingFields.join(", ")}).`);
  }

  return { dosenByNik, bidangByName };
}

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface) {
    await queryInterface.sequelize.transaction(async (transaction) => {
      const { dosenByNik, bidangByName } = await loadReferences(queryInterface, transaction);
      const now = new Date();
      const rows = DOSEN_BIDANG
        .filter((item) => dosenByNik.has(item.nik))
        .flatMap((item) => item.bidang.map((namaBidang) => ({
          dosen_id: dosenByNik.get(item.nik).id,
          bidang_penelitian_id: bidangByName.get(normalize(namaBidang)).id,
          createdAt: now,
          updatedAt: now,
        })));

      if (rows.length > 0) {
        await queryInterface.bulkInsert("DosenBidangPenelitians", rows, {
          transaction,
          ignoreDuplicates: true,
        });
      }
    });
  },

  async down(queryInterface) {
    await queryInterface.sequelize.transaction(async (transaction) => {
      const { dosenByNik, bidangByName } = await loadReferences(queryInterface, transaction);
      for (const item of DOSEN_BIDANG) {
        if (!dosenByNik.has(item.nik)) continue;
        const bidangIds = item.bidang.map((name) => bidangByName.get(normalize(name)).id);
        await queryInterface.bulkDelete(
          "DosenBidangPenelitians",
          {
            dosen_id: dosenByNik.get(item.nik).id,
            bidang_penelitian_id: bidangIds,
          },
          { transaction }
        );
      }
    });
  },
};
