export const MAX_WRONG = 6; // head, body, 2 arms, 2 legs

export type GameStatus = "waiting" | "choosing" | "playing" | "finished";
export type GameResult = "won" | "lost" | null;

export type Game = {
  id: string;
  player_a: string | null;
  player_b: string | null;
  chooser: string | null; // the player who sets the word this round
  word: string | null; // normalized word, null until chooser submits
  guessed: string[]; // letters the guesser has tried
  status: GameStatus;
  result: GameResult;
  round: number;
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
