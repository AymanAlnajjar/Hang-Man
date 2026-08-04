// Remembers the last room the player opened, so the home screen can offer a real
// "resume" card. Stored locally per device — no backend change.
import type { GameKey } from "@/lib/games";

const KEY = "recent_room";

export type RecentRoom = { game: GameKey; code: string; at: number };

export function saveRecentRoom(game: GameKey, code: string): void {
  if (typeof window === "undefined" || !code) return;
  try {
    const payload: RecentRoom = { game, code, at: Date.now() };
    window.localStorage.setItem(KEY, JSON.stringify(payload));
  } catch {
    /* storage may be unavailable (private mode) — ignore */
  }
}

export function getRecentRoom(): RecentRoom | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as RecentRoom;
    if (!parsed?.game || !parsed?.code) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function clearRecentRoom(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
}
