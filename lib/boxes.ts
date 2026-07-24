import { normalizeArabic } from "@/lib/arabic";

// A "تكوين" puzzle: a box of letter tiles, and every valid word that can be
// formed from them. Using a fixed answer list per puzzle means we never need a
// full Arabic dictionary — the puzzle IS the dictionary. All answer words are
// buildable from the tile multiset below.
export type Puzzle = {
  id: string;
  letters: string[]; // the tiles shown (duplicates allowed)
  words: string[]; // all accepted words
};

export const BOX_DURATION = 90; // seconds per round

export const PUZZLES: Puzzle[] = [
  {
    id: "muallim",
    letters: ["م", "ع", "ل", "ا", "م"],
    words: ["علم", "عمل", "عالم", "معلم", "لمع", "مال", "عام"],
  },
  {
    id: "madrasa",
    letters: ["م", "د", "ر", "س", "ة"],
    words: ["درس", "رسم", "سمر", "مدرس", "مدرسة"],
  },
  {
    id: "qalb",
    letters: ["ق", "ل", "ب", "ا"],
    words: ["قلب", "قبل", "بقل", "لقب", "قالب"],
  },
  {
    id: "salam",
    letters: ["س", "ل", "ا", "م"],
    words: ["سلم", "سلام", "مال", "سال", "لام"],
  },
  {
    id: "nahr",
    letters: ["ن", "ه", "ر", "ا"],
    words: ["نهر", "نار", "نهار", "رهن", "هان"],
  },
  {
    id: "kitab",
    letters: ["ك", "ت", "ا", "ب"],
    words: ["كتب", "تاب", "كتاب"],
  },
  {
    id: "warda",
    letters: ["و", "ر", "د", "ة"],
    words: ["ورد", "وردة", "دور"],
  },
  {
    id: "jabal",
    letters: ["ج", "ب", "ل", "ا"],
    words: ["جبل", "جلب", "جبال"],
  },
  {
    id: "bahr",
    letters: ["ب", "ح", "ر"],
    words: ["بحر", "رحب", "حبر"],
  },
];

export function getPuzzle(id: string | null | undefined): Puzzle | undefined {
  if (!id) return undefined;
  return PUZZLES.find((p) => p.id === id);
}

export function randomPuzzleId(exclude?: string | null): string {
  const pool = PUZZLES.filter((p) => p.id !== exclude);
  const list = pool.length ? pool : PUZZLES;
  return list[Math.floor(Math.random() * list.length)].id;
}

const normSet = (words: string[]) => new Set(words.map((w) => normalizeArabic(w)));

// Is `word` an accepted (and not-yet-found) answer for this puzzle?
export function checkWord(
  puzzle: Puzzle,
  word: string,
  alreadyFound: string[]
): { ok: boolean; reason?: "short" | "unknown" | "duplicate" } {
  const w = normalizeArabic(word);
  if (w.replace(/ /g, "").length < 2) return { ok: false, reason: "short" };
  if (!normSet(puzzle.words).has(w)) return { ok: false, reason: "unknown" };
  if (normSet(alreadyFound).has(w)) return { ok: false, reason: "duplicate" };
  return { ok: true };
}

// Longer words are worth more (points = number of letters).
export function wordScore(word: string): number {
  return normalizeArabic(word).replace(/ /g, "").length;
}

export function totalScore(words: string[]): number {
  return words.reduce((sum, w) => sum + wordScore(w), 0);
}
