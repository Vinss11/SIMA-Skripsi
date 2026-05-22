"use strict";

const STRUKTURAL_POSITIONS = [
  "Ketua Jurusan Informatika",
  "Sekretaris Jurusan Informatika",
  "Ketua Program Studi Informatika - Program Sarjana",
  "Sekretaris Program Studi Informatika - Program Sarjana Reguler",
  "Sekretaris Program Studi Informatika - Program Sarjana International Program",
  "Ketua Program Studi Informatika - Program Sarjana Pendidikan Jarak Jauh",
  "Ketua Program Studi Informatika - Program Magister",
];

function normalizeJabatanStrukturalInput(value) {
  if (value === undefined) return undefined;
  const text = String(value || "").trim();
  if (!text || text === "-") return null;
  return text;
}

function isValidJabatanStruktural(value) {
  if (!value) return true;
  return STRUKTURAL_POSITIONS.includes(value);
}

module.exports = {
  STRUKTURAL_POSITIONS,
  normalizeJabatanStrukturalInput,
  isValidJabatanStruktural,
};

