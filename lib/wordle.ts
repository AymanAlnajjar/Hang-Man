import { normalizeArabic } from "@/lib/arabic";

export const WORD_LENGTH = 5;
export const MAX_GUESSES = 6;

// A safe fallback target in case the dictionary hasn't produced a 5-letter word.
export const FALLBACK_TARGETS = ["مدرسة", "قهوة", "سلام", "كتاب", "وردة"].map(
  (w) => normalizeArabic(w)
);

export type Mark = "correct" | "present" | "absent";

// Standard Wordle marking with correct duplicate handling.
export function scoreGuess(guess: string, target: string): Mark[] {
  const g = [...guess];
  const t = [...target];
  const n = g.length;
  const res: Mark[] = Array(n).fill("absent");
  const used: boolean[] = Array(t.length).fill(false);

  for (let i = 0; i < n; i++) {
    if (g[i] === t[i]) {
      res[i] = "correct";
      used[i] = true;
    }
  }
  for (let i = 0; i < n; i++) {
    if (res[i] === "correct") continue;
    for (let j = 0; j < t.length; j++) {
      if (!used[j] && g[i] === t[j]) {
        res[i] = "present";
        used[j] = true;
        break;
      }
    }
  }
  return res;
}

// Best-known state of each letter across all guesses (for the keyboard).
export function keyStates(
  guesses: string[],
  target: string
): Record<string, Mark> {
  const rank: Record<Mark, number> = { absent: 0, present: 1, correct: 2 };
  const out: Record<string, Mark> = {};
  for (const guess of guesses) {
    const marks = scoreGuess(guess, target);
    [...guess].forEach((ch, i) => {
      const m = marks[i];
      if (!out[ch] || rank[m] > rank[out[ch]]) out[ch] = m;
    });
  }
  return out;
}

export function isSolved(guesses: string[], target: string): boolean {
  return guesses.some((g) => g === target);
}

export function isDone(guesses: string[], target: string): boolean {
  return isSolved(guesses, target) || guesses.length >= MAX_GUESSES;
}

export type Winner = "a" | "b" | "draw";

// Solver beats non-solver; if both solve, fewer guesses wins.
export function wordleWinner(
  guessesA: string[],
  guessesB: string[],
  target: string
): Winner {
  const sa = isSolved(guessesA, target);
  const sb = isSolved(guessesB, target);
  if (sa && !sb) return "a";
  if (sb && !sa) return "b";
  if (sa && sb) {
    if (guessesA.length < guessesB.length) return "a";
    if (guessesB.length < guessesA.length) return "b";
  }
  return "draw";
}
