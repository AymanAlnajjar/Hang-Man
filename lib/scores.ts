import { supabase } from "@/lib/supabase";

// Record a competitive match's winner exactly once (deduped by match_key across
// all clients), then increment the head-to-head tally between the two accounts.
export async function recordWinOnce(
  matchKey: string,
  winner: string,
  loser: string
): Promise<void> {
  if (!winner || !loser || winner === loser) return;
  const { data, error } = await supabase
    .from("recorded_matches")
    .insert({ match_key: matchKey })
    .select("match_key");
  if (error) return; // already recorded (unique) or write failed
  if (data && data.length > 0) {
    await supabase.rpc("record_win", { winner, loser });
  }
}

export type H2H = { mine: number; theirs: number };

export async function fetchHeadToHead(
  a: string,
  b: string,
  meSeat: string
): Promise<H2H> {
  const lo = a < b ? a : b;
  const hi = a < b ? b : a;
  const { data } = await supabase
    .from("head2head")
    .select("user_low, wins_low, wins_high")
    .eq("user_low", lo)
    .eq("user_high", hi)
    .maybeSingle();
  const row = data as { user_low: string; wins_low: number; wins_high: number } | null;
  if (!row) return { mine: 0, theirs: 0 };
  const meLow = meSeat === lo;
  return {
    mine: meLow ? row.wins_low : row.wins_high,
    theirs: meLow ? row.wins_high : row.wins_low,
  };
}
