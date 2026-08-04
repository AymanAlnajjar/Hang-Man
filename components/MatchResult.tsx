"use client";

import { useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";
import { getPlayerId } from "@/lib/player";
import { recordWinOnce, fetchHeadToHead, type H2H } from "@/lib/scores";

// Shown on a competitive game's final screen: records the win once and shows the
// running head-to-head tally with your opponent (by account). Only meaningful
// when both players are signed in (seats = account ids).
export default function MatchResult({
  matchKey,
  winner,
  playerA,
  playerB,
}: {
  matchKey: string;
  winner: "a" | "b" | "draw";
  playerA: string | null;
  playerB: string | null;
}) {
  const [h2h, setH2h] = useState<H2H | null>(null);
  const [names, setNames] = useState<{ me: string; opp: string }>({
    me: "أنت",
    opp: "خصمك",
  });
  const recordedKeyRef = useRef<string | null>(null);
  const me = getPlayerId();

  useEffect(() => {
    if (!playerA || !playerB) return;
    const oppSeat = me === playerA ? playerB : playerA;
    let active = true;

    async function run() {
      if (winner !== "draw" && recordedKeyRef.current !== matchKey) {
        recordedKeyRef.current = matchKey;
        const winnerSeat = winner === "a" ? playerA : playerB;
        const loserSeat = winner === "a" ? playerB : playerA;
        await recordWinOnce(matchKey, winnerSeat!, loserSeat!);
      }
      const res = await fetchHeadToHead(playerA!, playerB!, me);
      if (!active) return;
      setH2h(res);
      const { data } = await supabase
        .from("profiles")
        .select("id, username")
        .in("id", [me, oppSeat]);
      if (!active) return;
      const map: Record<string, string> = {};
      (data as { id: string; username: string }[] | null)?.forEach(
        (p) => (map[p.id] = p.username)
      );
      setNames({
        me: map[me] ? `@${map[me]}` : "أنت",
        opp: map[oppSeat] ? `@${map[oppSeat]}` : "خصمك",
      });
    }
    run();

    const ch = supabase
      .channel(`h2h-${matchKey}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "head2head" },
        () => {
          fetchHeadToHead(playerA!, playerB!, me).then((r) => active && setH2h(r));
        }
      )
      .subscribe();
    return () => {
      active = false;
      supabase.removeChannel(ch);
    };
  }, [matchKey, winner, playerA, playerB, me]);

  if (!h2h) return null;
  return (
    <div className="card bg-surface p-4 text-center">
      <div className="mb-1 text-xs font-bold text-ink-soft">🏆 سجلّ المواجهات بينكما</div>
      <div className="flex items-center justify-center gap-3 text-lg font-extrabold">
        <span className="text-primary-dark">
          {names.me} {h2h.mine}
        </span>
        <span className="text-ink-soft">—</span>
        <span className="text-coral">
          {h2h.theirs} {names.opp}
        </span>
      </div>
    </div>
  );
}
