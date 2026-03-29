const TRANSLITERATION_REPLACEMENTS: Array<[RegExp, string]> = [
  [/ß/g, "ss"],
  [/æ/g, "ae"],
  [/œ/g, "oe"],
  [/ø/g, "o"],
  [/ð/g, "d"],
  [/þ/g, "th"],
  [/ł/g, "l"],
  [/đ/g, "d"],
  [/ħ/g, "h"],
  [/ı/g, "i"],
  [/ĳ/g, "ij"],

  [/щ/g, "sht"],
  [/ш/g, "sh"],
  [/ч/g, "ch"],
  [/ц/g, "ts"],
  [/ж/g, "zh"],
  [/ю/g, "yu"],
  [/я/g, "ya"],
  [/х/g, "h"],
  [/й/g, "y"],
  [/ъ/g, "a"],
  [/ь/g, "y"],
  [/ы/g, "y"],
  [/э/g, "e"],
  [/ё/g, "yo"],
  [/а/g, "a"],
  [/б/g, "b"],
  [/в/g, "v"],
  [/г/g, "g"],
  [/д/g, "d"],
  [/е/g, "e"],
  [/з/g, "z"],
  [/и/g, "i"],
  [/к/g, "k"],
  [/л/g, "l"],
  [/м/g, "m"],
  [/н/g, "n"],
  [/о/g, "o"],
  [/п/g, "p"],
  [/р/g, "r"],
  [/с/g, "s"],
  [/т/g, "t"],
  [/у/g, "u"],
  [/ф/g, "f"],
  [/ї/g, "yi"],
  [/є/g, "ye"],
  [/і/g, "i"],
  [/ґ/g, "g"],
  [/ў/g, "u"],

  [/θ/g, "th"],
  [/χ/g, "ch"],
  [/ψ/g, "ps"],
  [/ξ/g, "x"],
  [/φ/g, "f"],
  [/ω/g, "o"],
  [/η/g, "i"],
  [/γ/g, "g"],
  [/δ/g, "d"],
  [/β/g, "v"],
  [/α/g, "a"],
  [/ε/g, "e"],
  [/ζ/g, "z"],
  [/ι/g, "i"],
  [/κ/g, "k"],
  [/λ/g, "l"],
  [/μ/g, "m"],
  [/ν/g, "n"],
  [/ο/g, "o"],
  [/π/g, "p"],
  [/ρ/g, "r"],
  [/σ/g, "s"],
  [/ς/g, "s"],
  [/τ/g, "t"],
  [/υ/g, "y"],
];

function transliterateToAscii(input: string): string {
  let result = input;
  for (const [pattern, replacement] of TRANSLITERATION_REPLACEMENTS) {
    result = result.replace(pattern, replacement);
  }
  return result;
}

function hashSlugSeed(input: string): string {
  let hash = 2166136261;
  for (const char of input) {
    hash ^= char.codePointAt(0) ?? 0;
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36).slice(0, 8);
}

export function slugifySegment(value: unknown): string {
  const input =
    typeof value === "string"
      ? value
      : typeof value === "number" || typeof value === "boolean"
        ? String(value)
        : "";
  const trimmedInput = input.trim();

  const transliterated = transliterateToAscii(trimmedInput.toLowerCase());
  const normalized = transliterated
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-");

  if (normalized) return normalized;
  if (!trimmedInput) return "item";
  return `item-${hashSlugSeed(trimmedInput)}`;
}
