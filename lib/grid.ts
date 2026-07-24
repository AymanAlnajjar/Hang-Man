import { normalizeArabic } from "@/lib/arabic";
import { isWord, plantableWords } from "@/lib/dictionary";

export const GRID_SIZE = 5; // 5x5 board
export const CELLS = GRID_SIZE * GRID_SIZE;
export const MIN_WORD = 3;
export const ROUND_DURATION = 120; // seconds per round
export const MAX_ROUNDS = 3;
export const PLANT_TARGET = 9; // how many words to try to plant per grid

// Weighted pool of common Arabic letters used to fill empty cells.
const FILL_POOL = (
  "ااااللللممممنننوووييييرررربببتتتسسعععدددهههقففحكجصطشخ"
).split("");

// --- Geometry ---------------------------------------------------------------
export function rc(i: number): { r: number; c: number } {
  return { r: Math.floor(i / GRID_SIZE), c: i % GRID_SIZE };
}
export function idx(r: number, c: number): number {
  return r * GRID_SIZE + c;
}
export function areAdjacent(a: number, b: number): boolean {
  if (a === b) return false;
  const A = rc(a);
  const B = rc(b);
  return Math.abs(A.r - B.r) <= 1 && Math.abs(A.c - B.c) <= 1;
}
export function neighbors(i: number): number[] {
  const { r, c } = rc(i);
  const out: number[] = [];
  for (let dr = -1; dr <= 1; dr++) {
    for (let dc = -1; dc <= 1; dc++) {
      if (dr === 0 && dc === 0) continue;
      const nr = r + dr;
      const nc = c + dc;
      if (nr >= 0 && nr < GRID_SIZE && nc >= 0 && nc < GRID_SIZE) {
        out.push(idx(nr, nc));
      }
    }
  }
  return out;
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// --- Generation -------------------------------------------------------------
// Plant several real words along adjacent (8-direction) paths, letting words
// cross where letters match, then fill the rest with common letters.
function tryPlant(cells: (string | null)[], letters: string[]): boolean {
  const dfs = (k: number, cell: number, path: number[]): boolean => {
    const occupied = cells[cell];
    if (occupied !== null && occupied !== letters[k]) return false;
    if (path.includes(cell)) return false;
    path.push(cell);
    if (k === letters.length - 1) return true;
    for (const n of shuffle(neighbors(cell))) {
      if (dfs(k + 1, n, path)) return true;
    }
    path.pop();
    return false;
  };

  for (const start of shuffle([...Array(CELLS).keys()])) {
    const path: number[] = [];
    if (dfs(0, start, path)) {
      path.forEach((cell, k) => (cells[cell] = letters[k]));
      return true;
    }
  }
  return false;
}

export function generateGrid(): string[] {
  const cells: (string | null)[] = Array(CELLS).fill(null);
  const words = shuffle(plantableWords());
  let planted = 0;
  for (const w of words) {
    if (planted >= PLANT_TARGET) break;
    const letters = normalizeArabic(w).replace(/ /g, "").split("");
    if (letters.length < 3 || letters.length > 6) continue;
    if (tryPlant(cells, letters)) planted++;
  }
  for (let i = 0; i < CELLS; i++) {
    if (cells[i] === null) {
      cells[i] = FILL_POOL[Math.floor(Math.random() * FILL_POOL.length)];
    }
  }
  return cells as string[];
}

// --- Play helpers -----------------------------------------------------------
export function pathToWord(grid: string[], path: number[]): string {
  return path.map((i) => grid[i]).join("");
}

export function isPathConnected(path: number[]): boolean {
  for (let i = 1; i < path.length; i++) {
    if (!areAdjacent(path[i - 1], path[i])) return false;
  }
  return new Set(path).size === path.length; // no cell reused
}

export type CheckResult = {
  ok: boolean;
  reason?: "short" | "path" | "unknown" | "duplicate";
};

export function checkPath(
  grid: string[],
  path: number[],
  alreadyFound: string[]
): CheckResult {
  if (path.length < MIN_WORD) return { ok: false, reason: "short" };
  if (!isPathConnected(path)) return { ok: false, reason: "path" };
  const word = normalizeArabic(pathToWord(grid, path));
  if (!isWord(word)) return { ok: false, reason: "unknown" };
  if (new Set(alreadyFound.map((w) => normalizeArabic(w))).has(word)) {
    return { ok: false, reason: "duplicate" };
  }
  return { ok: true };
}

// Longer words score more (Ruzzle-like): 3→1, 4→2, 5→4, 6→6, 7+→8 per word...
// kept simple and generous: points = letters, with a bonus for 5+ letters.
export function wordScore(word: string): number {
  const len = normalizeArabic(word).replace(/ /g, "").length;
  if (len >= 7) return len + 5;
  if (len >= 5) return len + 2;
  return len;
}

export function totalScore(words: string[]): number {
  return words.reduce((sum, w) => sum + wordScore(w), 0);
}
