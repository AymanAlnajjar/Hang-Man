import { supabase } from "@/lib/supabase";
import { makeRoomCode } from "@/lib/game";

// Metadata for every game on the platform: label, icon, and how to route to a
// room. Used by the friends/invites flow to create + open rooms generically.
export const GAME_META = {
  hangman: { name: "المشنقة", emoji: "🎯", route: (c: string) => `/game/${c}` },
  wordbox: { name: "تكوين الكلمات", emoji: "🔤", route: (c: string) => `/wordbox/${c}` },
  meld: { name: "توارد الأفكار", emoji: "🧠", route: (c: string) => `/meld/${c}` },
  stop: { name: "اسم حيوان جماد", emoji: "🅰️", route: (c: string) => `/stop/${c}` },
  wordle: { name: "وردل", emoji: "🟩", route: (c: string) => `/wordle/${c}` },
} as const;

export type GameType = keyof typeof GAME_META;

// The row shape each game's table needs on creation (mirrors the create pages).
function insertRow(type: GameType, code: string, me: string) {
  switch (type) {
    case "hangman":
      return supabase.from("games").insert({
        id: code,
        player_a: me,
        mode: "together",
        guessed: [],
        status: "waiting",
        round: 1,
      });
    case "wordbox":
      return supabase.from("boxes_games").insert({
        id: code,
        player_a: me,
        status: "waiting",
        max_rounds: 3,
      });
    case "meld":
      return supabase.from("meld_games").insert({
        id: code,
        player_a: me,
        status: "waiting",
        round: 1,
      });
    case "stop":
      return supabase.from("stop_games").insert({
        id: code,
        player_a: me,
        status: "waiting",
        duration: 120,
        round: 1,
      });
    case "wordle":
      return supabase.from("wordle_games").insert({
        id: code,
        player_a: me,
        status: "waiting",
        word_len: 5,
        max_guesses: 6,
        round: 1,
      });
  }
}

// Create a room of the given game type and return its code (or null on failure).
export async function createRoom(type: GameType, me: string): Promise<string | null> {
  for (let attempt = 0; attempt < 5; attempt++) {
    const code = makeRoomCode();
    const { error } = await insertRow(type, code, me);
    if (!error) return code;
  }
  return null;
}
