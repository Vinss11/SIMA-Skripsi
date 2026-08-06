"use strict";

const ALLOWED_GRADES = Object.freeze(["A", "B+", "B", "B-", "B/C", "C+", "C", "C-", "C/D", "D+", "D", "D-", "D/F", "F"]);
const GRADE_POINTS = Object.freeze({ A: 4, "B+": 3.5, B: 3, "B-": 2.75, "B/C": 2.5, "C+": 2.25, C: 2, "C-": 1.75, "C/D": 1.5, "D+": 1.25, D: 1, "D-": 0.75, "D/F": 0.5, F: 0 });
const configuredMinimum = String(process.env.PENJALURAN_MINIMUM_PASSING_GRADE || "C").trim().toUpperCase();
const MINIMUM_PASSING_GRADE = ALLOWED_GRADES.includes(configuredMinimum) ? configuredMinimum : "C";

function normalizeGrade(value) { return String(value ?? "").trim().toUpperCase(); }
function isAllowedGrade(value) { return ALLOWED_GRADES.includes(normalizeGrade(value)); }
function isPassingGrade(value) {
  const grade = normalizeGrade(value);
  return isAllowedGrade(grade) && GRADE_POINTS[grade] >= GRADE_POINTS[MINIMUM_PASSING_GRADE];
}

module.exports = { ALLOWED_GRADES, GRADE_POINTS, MINIMUM_PASSING_GRADE, normalizeGrade, isAllowedGrade, isPassingGrade };
