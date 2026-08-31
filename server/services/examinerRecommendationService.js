const STOP_WORDS = new Set([
  "yang", "dan", "atau", "dengan", "untuk", "pada", "dari", "dalam", "ke", "di",
  "berbasis", "menggunakan", "sebagai", "oleh", "sebuah", "suatu", "the", "of", "and",
  "for", "in", "to", "a", "an", "based", "using",
]);

function normalizeText(value) {
  return String(value || "")
    .normalize("NFKD")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tokenize(value) {
  const normalized = normalizeText(value);
  if (!normalized) return new Set();
  return new Set(normalized.split(" ").filter((token) => token.length > 1 && !STOP_WORDS.has(token)));
}

function cosineLikeSimilarity(leftTokens, rightTokens) {
  if (!leftTokens?.size || !rightTokens?.size) return 0;
  let intersection = 0;
  const smaller = leftTokens.size <= rightTokens.size ? leftTokens : rightTokens;
  const larger = smaller === leftTokens ? rightTokens : leftTokens;
  smaller.forEach((token) => {
    if (larger.has(token)) intersection += 1;
  });
  return intersection / Math.sqrt(leftTokens.size * rightTokens.size);
}

function buildResearchProfile({ fieldIds = [], fieldTexts = [], text = "" } = {}) {
  const normalizedFieldIds = new Set((fieldIds || []).map(Number).filter(Boolean));
  const fieldLabels = (fieldTexts || []).map((item) => String(item || "").trim()).filter(Boolean);
  const normalizedFieldTexts = fieldLabels.map(normalizeText).filter(Boolean);
  return {
    fieldIds: normalizedFieldIds,
    fieldTexts: normalizedFieldTexts,
    fieldLabels,
    tokens: tokenize(`${text || ""} ${normalizedFieldTexts.join(" ")}`),
  };
}

function scoreExpertise(studentProfile, lecturerProfile) {
  const studentFields = studentProfile?.fieldIds || new Set();
  const lecturerFields = lecturerProfile?.fieldIds || new Set();
  let overlap = 0;
  studentFields.forEach((fieldId) => {
    if (lecturerFields.has(fieldId)) overlap += 1;
  });

  const fieldCoverage = studentFields.size > 0 ? overlap / studentFields.size : 0;
  const semanticSimilarity = cosineLikeSimilarity(studentProfile?.tokens, lecturerProfile?.tokens);
  // Bidang terstruktur menjadi bukti utama; kemiripan istilah membantu ketika bidang belum lengkap.
  const score = Math.round(Math.min(100, (fieldCoverage * 80) + (semanticSimilarity * 20)) * 10) / 10;
  const lecturerFieldTexts = new Set(lecturerProfile?.fieldTexts || []);
  const matchedFields = (studentProfile?.fieldTexts || []).reduce((result, fieldText, index) => {
    if (lecturerFieldTexts.has(fieldText)) result.push(studentProfile?.fieldLabels?.[index] || fieldText);
    return result;
  }, []);

  return {
    score,
    fieldCoverage,
    semanticSimilarity,
    matchedFields,
  };
}

function rankLecturersForStudent(studentProfile, lecturers, loadByLecturerId = new Map()) {
  return lecturers
    .map((lecturer) => {
      const expertise = scoreExpertise(studentProfile, lecturer.researchProfile);
      return {
        ...lecturer,
        expertise,
        load: Number(loadByLecturerId.get(Number(lecturer.id)) || 0),
      };
    })
    .sort((left, right) => {
      if (right.expertise.score !== left.expertise.score) return right.expertise.score - left.expertise.score;
      if (left.load !== right.load) return left.load - right.load;
      return Number(left.id) - Number(right.id);
    });
}

module.exports = {
  buildResearchProfile,
  cosineLikeSimilarity,
  normalizeText,
  rankLecturersForStudent,
  scoreExpertise,
  tokenize,
};
