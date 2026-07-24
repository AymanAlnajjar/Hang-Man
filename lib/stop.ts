import { normalizeArabic } from "@/lib/arabic";

// Categories for اسم/حيوان/نبات/جماد/بلاد.
export const CATEGORIES = ["اسم", "حيوان", "نبات", "جماد", "بلاد"] as const;
export type Category = (typeof CATEGORIES)[number];
export type Answers = Partial<Record<Category, string>>;

export const ROUND_DURATION = 120; // seconds per round

// Letters that are fun/easy to start words with (no ة/ء and no rare letters).
const LETTER_POOL = "ابتجحدرزسشصطعفقكلمنهوي".split("");

export function randomLetter(exclude?: string | null): string {
  const pool = LETTER_POOL.filter((l) => l !== exclude);
  return pool[Math.floor(Math.random() * pool.length)];
}

// Does an answer begin with the round's letter (after normalization)?
export function startsWith(answer: string, letter: string): boolean {
  const w = normalizeArabic(answer || "");
  return w.length > 0 && w[0] === normalizeArabic(letter);
}

// Points for one answer: 0 if empty/wrong letter, 5 if both wrote the same
// valid word, 10 if it's a valid unique word.
export function categoryPoints(mine: string, opp: string, letter: string): number {
  if (!startsWith(mine, letter)) return 0;
  const same =
    startsWith(opp, letter) && normalizeArabic(mine) === normalizeArabic(opp);
  return same ? 5 : 10;
}

export function roundScore(mine: Answers, opp: Answers, letter: string): number {
  let s = 0;
  for (const cat of CATEGORIES) {
    s += categoryPoints(mine[cat] || "", opp[cat] || "", letter);
  }
  return s;
}
