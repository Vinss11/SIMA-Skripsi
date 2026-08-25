const TOPIK_TITLE_FORBIDDEN_CHARACTERS = new Set([
  "+", "=", "_", "{", "}", "[", "]", "<", ">", "/", "?", "\\", "|", ":", ";", "'", '"',
]);

function getTopikTitleValidationError(value) {
  const text = String(value || "");
  const containsForbiddenCharacter = text.includes("--")
    || Array.from(text).some((character) => TOPIK_TITLE_FORBIDDEN_CHARACTERS.has(character));

  return containsForbiddenCharacter
    ? "Judul topik tidak boleh mengandung karakter { } [ ] < > ? + = _ / \\ | : ; ' \", atau pola -- (komentar SQL)."
    : "";
}

module.exports = { getTopikTitleValidationError };
