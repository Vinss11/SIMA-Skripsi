const DOSEN_NAME_MAX_LENGTH = 150;
const DOSEN_TITLE_MAX_LENGTH = 150;
const PREFIX_TITLE_WORDS = new Set(["prof", "dr", "ir", "drs", "dra", "h", "hj"]);

function normalizeWhitespace(value) {
  return String(value || "").trim().replace(/\s+/g, " ");
}

function validateDosenName(value) {
  const normalized = normalizeWhitespace(value);
  if (!normalized) {
    return { isValid: false, message: "Nama dosen wajib diisi.", normalized: "" };
  }
  if (normalized.length > DOSEN_NAME_MAX_LENGTH) {
    return { isValid: false, message: `Nama dosen maksimal ${DOSEN_NAME_MAX_LENGTH} karakter.`, normalized };
  }
  if (!/^[\p{L}\s]+$/u.test(normalized)) {
    return {
      isValid: false,
      message: "Nama dosen hanya boleh berisi huruf dan spasi, tanpa angka atau karakter khusus.",
      normalized,
    };
  }
  return { isValid: true, normalized };
}

function normalizeDosenTitle(value) {
  return normalizeWhitespace(value).replace(/\s*,\s*/g, ", ");
}

function validateDosenTitle(value, { required = true } = {}) {
  const normalized = normalizeDosenTitle(value);
  if (!normalized) {
    return required
      ? { isValid: false, message: "Gelar wajib diisi.", normalized: "" }
      : { isValid: true, normalized: "" };
  }
  if (normalized.length > DOSEN_TITLE_MAX_LENGTH) {
    return { isValid: false, message: `Gelar maksimal ${DOSEN_TITLE_MAX_LENGTH} karakter.`, normalized };
  }
  const invalidCharacters = [...new Set(normalized.match(/[^\p{L}.,()'\s-]/gu) || [])];
  if (invalidCharacters.length > 0) {
    return {
      isValid: false,
      message: `Gelar mengandung karakter yang tidak diizinkan: ${invalidCharacters.join(" ")}.`,
      normalized,
    };
  }
  if (!/\p{L}/u.test(normalized)) {
    return { isValid: false, message: "Gelar tidak boleh hanya berisi simbol.", normalized };
  }
  if (/([.,()'-])(?:\s*\1)+/.test(normalized)) {
    return { isValid: false, message: "Gelar tidak boleh mengandung simbol berulang seperti ..., ,,, atau --.", normalized };
  }
  const openParentheses = (normalized.match(/\(/g) || []).length;
  const closeParentheses = (normalized.match(/\)/g) || []).length;
  if (openParentheses !== closeParentheses) {
    return { isValid: false, message: "Tanda kurung pada gelar harus berpasangan.", normalized };
  }
  return { isValid: true, normalized };
}

function isPrefixTitle(titlePart) {
  const words = normalizeWhitespace(titlePart).split(" ").filter(Boolean);
  return words.length > 0 && words.every((word) => PREFIX_TITLE_WORDS.has(word.replace(/\./g, "").toLowerCase()));
}

function formatDosenFullName(name, title) {
  const normalizedName = normalizeWhitespace(name);
  const normalizedTitle = normalizeDosenTitle(title);
  if (!normalizedName) return normalizedTitle;
  if (!normalizedTitle) return normalizedName;

  const titleParts = normalizedTitle.split(",").map((item) => item.trim()).filter(Boolean);
  const prefixParts = [];
  while (titleParts.length > 0 && isPrefixTitle(titleParts[0])) {
    prefixParts.push(titleParts.shift());
  }
  const prefix = prefixParts.join(" ");
  const suffix = titleParts.join(", ");
  const lowerName = normalizedName.toLowerCase();
  const hasPrefix = !prefix || lowerName.startsWith(prefix.toLowerCase());
  const hasSuffix = !suffix || lowerName.endsWith(suffix.toLowerCase());
  if (hasPrefix && hasSuffix) return normalizedName;
  return `${prefix && !hasPrefix ? `${prefix} ` : ""}${normalizedName}${suffix && !hasSuffix ? `, ${suffix}` : ""}`;
}

module.exports = {
  DOSEN_NAME_MAX_LENGTH,
  DOSEN_TITLE_MAX_LENGTH,
  normalizeDosenTitle,
  validateDosenName,
  validateDosenTitle,
  formatDosenFullName,
};
