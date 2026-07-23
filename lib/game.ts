import { wordLetterSet } from "@/lib/arabic";

export const MAX_WRONG = 6; // head, body, 2 arms, 2 legs

// coop    = one player sets a word, the other guesses (take turns)
// versus  = each sets a word for the other; race to solve with fewest mistakes
// together = both solve a random word from a chosen category, as a team
export type GameMode = "coop" | "versus" | "together";
export type GameStatus = "waiting" | "choosing" | "playing" | "finished";
export type GameResult = "won" | "lost" | null;

export type Game = {
  id: string;
  mode: GameMode;
  player_a: string | null;
  player_b: string | null;
  status: GameStatus;
  round: number;

  // --- Co-op & Together modes share these (one shared board) ---
  chooser: string | null; // set only in coop; null in together (both guess)
  word: string | null;
  guessed: string[];
  result: GameResult;
  category: string | null; // shown in together mode

  // --- Versus mode: each player sets a word for the OTHER to guess ---
  // player_a guesses `word_for_a` (chosen by B); player_b guesses `word_for_b`.
  word_for_a: string | null;
  word_for_b: string | null;
  guessed_a: string[];
  guessed_b: string[];
  a_done: boolean;
  b_done: boolean;
};

// A short, human-friendly room code (no easily-confused characters).
export function makeRoomCode(length = 5): string {
  const alphabet = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
  let out = "";
  for (let i = 0; i < length; i++) {
    out += alphabet[Math.floor(Math.random() * alphabet.length)];
  }
  return out;
}

// --- Shared guessing helpers ------------------------------------------------
export function countWrong(word: string, guessed: string[]): number {
  const set = wordLetterSet(word);
  return guessed.filter((l) => !set.has(l)).length;
}

export function isSolved(word: string, guessed: string[]): boolean {
  const set = wordLetterSet(word);
  return [...set].every((l) => guessed.includes(l));
}

export function isDead(word: string, guessed: string[]): boolean {
  return countWrong(word, guessed) >= MAX_WRONG;
}

// A player's round is over once they've solved the word or run out of tries.
export function isDone(word: string, guessed: string[]): boolean {
  return isSolved(word, guessed) || isDead(word, guessed);
}

export type VersusWinner = "a" | "b" | "draw";

// Whoever solves wins; if both solve (or both fail), fewer mistakes wins.
export function versusWinner(g: Game): VersusWinner {
  const wa = g.word_for_a ?? "";
  const wb = g.word_for_b ?? "";
  const solvedA = isSolved(wa, g.guessed_a);
  const solvedB = isSolved(wb, g.guessed_b);
  const wrongA = countWrong(wa, g.guessed_a);
  const wrongB = countWrong(wb, g.guessed_b);

  if (solvedA && !solvedB) return "a";
  if (solvedB && !solvedA) return "b";
  if (wrongA < wrongB) return "a";
  if (wrongB < wrongA) return "b";
  return "draw";
}
