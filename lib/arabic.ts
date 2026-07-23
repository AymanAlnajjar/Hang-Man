// The letters shown on the on-screen keyboard (28 base letters + ة + ء).
export const ARABIC_LETTERS: string[] = [
  "ا", "ب", "ت", "ث", "ج", "ح", "خ", "د", "ذ", "ر",
  "ز", "س", "ش", "ص", "ض", "ط", "ظ", "ع", "غ", "ف",
  "ق", "ك", "ل", "م", "ن", "ه", "و", "ي", "ة", "ء",
];

const LETTER_SET = new Set(ARABIC_LETTERS);

// Normalize a word so guessing is fair and consistent:
// - remove tashkeel (diacritics) and tatweel (ـ)
// - unify the alef forms (أ إ آ ٱ) into ا
// - alef maqsura (ى) -> ي
// - hamza on waw/ya (ؤ ئ) -> و / ي
// This means "أحمد" and "احمد" are treated the same, which is what players expect.
export function normalizeArabic(text: string): string {
  return text
    .replace(/[ً-ْٰـ]/g, "") // tashkeel range + superscript alef + tatweel
    .replace(/[أإآٱ]/g, "ا") // أ إ آ ٱ -> ا
    .replace(/ى/g, "ي") // ى -> ي
    .replace(/ؤ/g, "و") // ؤ -> و
    .replace(/ئ/g, "ي") // ئ -> ي
    .replace(/\s+/g, " ")
    .trim();
}

// Every non-space character of the (already normalized) word must be a key
// the guesser can actually press. Returns the first offending character, or null.
export function firstInvalidChar(normalizedWord: string): string | null {
  for (const ch of normalizedWord) {
    if (ch === " ") continue;
    if (!LETTER_SET.has(ch)) return ch;
  }
  return null;
}

// The unique set of letters that make up the word (ignoring spaces).
export function wordLetterSet(normalizedWord: string): Set<string> {
  return new Set(normalizedWord.split("").filter((c) => c !== " "));
}
