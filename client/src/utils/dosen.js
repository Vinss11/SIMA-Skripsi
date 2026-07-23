const DOSEN_PREFIX_TITLE_WORDS = new Set(["prof", "dr", "ir", "drs", "dra", "h", "hj"]);

export function formatDosenFullName(namaValue, gelarValue) {
  const nama = String(namaValue || "").trim().replace(/\s+/g, " ");
  const gelar = String(gelarValue || "").trim().replace(/\s+/g, " ").replace(/\s*,\s*/g, ", ");
  if (!nama) return gelar;
  if (!gelar) return nama;

  const titleParts = gelar.split(",").map((item) => item.trim()).filter(Boolean);
  const prefixes = [];
  while (
    titleParts.length > 0
    && titleParts[0].split(" ").filter(Boolean).every(
      (word) => DOSEN_PREFIX_TITLE_WORDS.has(word.replace(/\./g, "").toLowerCase())
    )
  ) {
    prefixes.push(titleParts.shift());
  }

  const prefix = prefixes.join(" ");
  const suffix = titleParts.join(", ");
  const lowerName = nama.toLowerCase();
  const hasPrefix = !prefix || lowerName.startsWith(prefix.toLowerCase());
  const hasSuffix = !suffix || lowerName.endsWith(suffix.toLowerCase());
  if (hasPrefix && hasSuffix) return nama;
  return `${prefix && !hasPrefix ? `${prefix} ` : ""}${nama}${suffix && !hasSuffix ? `, ${suffix}` : ""}`;
}
