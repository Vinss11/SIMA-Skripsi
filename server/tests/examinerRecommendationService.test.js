const test = require("node:test");
const assert = require("node:assert/strict");
const {
  buildResearchProfile,
  rankLecturersForStudent,
  scoreExpertise,
} = require("../services/examinerRecommendationService");

test("kecocokan bidang terstruktur menjadi sinyal utama", () => {
  const student = buildResearchProfile({ fieldIds: [1, 2], fieldTexts: ["machine learning", "computer vision"], text: "deteksi citra" });
  const matching = buildResearchProfile({ fieldIds: [1, 2], fieldTexts: ["machine learning", "computer vision"] });
  const unrelated = buildResearchProfile({ fieldIds: [8], fieldTexts: ["audit and control"], text: "audit sistem" });
  assert.ok(scoreExpertise(student, matching).score > scoreExpertise(student, unrelated).score);
  assert.equal(scoreExpertise(student, matching).fieldCoverage, 1);
});

test("beban menjadi tie breaker untuk skor kepakaran yang sama", () => {
  const student = buildResearchProfile({ fieldIds: [1], fieldTexts: ["machine learning"] });
  const researchProfile = buildResearchProfile({ fieldIds: [1], fieldTexts: ["machine learning"] });
  const ranked = rankLecturersForStudent(student, [
    { id: 2, researchProfile },
    { id: 1, researchProfile },
  ], new Map([[1, 4], [2, 1]]));
  assert.equal(ranked[0].id, 2);
});
