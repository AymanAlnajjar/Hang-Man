"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { getPlayerId } from "@/lib/player";
import { normalizeArabic } from "@/lib/arabic";
import {
  BOX_DURATION,
  checkWord,
  getPuzzle,
  randomPuzzleId,
  totalScore,
  wordScore,
  type Puzzle,
} from "@/lib/boxes";
import Chat from "@/components/Chat";

type BoxesGame = {
  id: string;
  player_a: string | null;
  player_b: string | null;
  status: "waiting" | "playing" | "finished";
  puzzle_id: string | null;
  duration: number;
  started_at: string | null;
  found_a: string[];
  found_b: string[];
  round: number;
};

type Phase = "loading" | "notfound" | "full" | "ready";

export default function WordBoxRoom() {
  const params = useParams();
  const router = useRouter();
  const code = String(params.code || "").toUpperCase();

  const [me, setMe] = useState("");
  const [game, setGame] = useState<BoxesGame | null>(null);
  const [phase, setPhase] = useState<Phase>("loading");
  const [shareUrl, setShareUrl] = useState("");
  const [copied, setCopied] = useState(false);
  const [selection, setSelection] = useState<number[]>([]);
  const [flash, setFlash] = useState<{ msg: string; ok: boolean } | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const claimedRef = useRef(false);
  const finishedRef = useRef(false);

  // ---- Load + claim a seat -------------------------------------------------
  useEffect(() => {
    const pid = getPlayerId();
    setMe(pid);
    setShareUrl(`${window.location.origin}/wordbox/${code}`);
    let cancelled = false;

    async function init() {
      const { data, error } = await supabase
        .from("boxes_games")
        .select("*")
        .eq("id", code)
        .maybeSingle();
      if (cancelled) return;
      if (error || !data) {
        setPhase("notfound");
        return;
      }
      let g = data as BoxesGame;

      const isPlayer = g.player_a === pid || g.player_b === pid;
      if (!isPlayer && !claimedRef.current) {
        claimedRef.current = true;
        if (g.player_a && !g.player_b && g.player_a !== pid) {
          // Second player joins → start the round with a random puzzle + clock.
          const { data: upd } = await supabase
            .from("boxes_games")
            .update({
              player_b: pid,
              status: "playing",
              puzzle_id: randomPuzzleId(),
              started_at: new Date().toISOString(),
              found_a: [],
              found_b: [],
            })
            .eq("id", code)
            .is("player_b", null)
            .select()
            .maybeSingle();
          if (upd) g = upd as BoxesGame;
          else {
            const { data: fresh } = await supabase
              .from("boxes_games")
              .select("*")
              .eq("id", code)
              .maybeSingle();
            if (fresh) g = fresh as BoxesGame;
          }
        } else if (!g.player_a) {
          const { data: upd } = await supabase
            .from("boxes_games")
            .update({ player_a: pid })
            .eq("id", code)
            .select()
            .maybeSingle();
          if (upd) g = upd as BoxesGame;
        }
      }

      if (cancelled) return;
      const nowPlayer = g.player_a === pid || g.player_b === pid;
      if (!nowPlayer && g.player_a && g.player_b) {
        setPhase("full");
        setGame(g);
        return;
      }
      setGame(g);
      setPhase("ready");
    }

    init();
    return () => {
      cancelled = true;
    };
  }, [code]);

  // ---- Realtime ------------------------------------------------------------
  useEffect(() => {
    if (!code) return;
    const channel = supabase
      .channel(`boxes-${code}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "boxes_games", filter: `id=eq.${code}` },
        (payload) => setGame(payload.new as BoxesGame)
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [code]);

  // ---- Clock ---------------------------------------------------------------
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 300);
    return () => clearInterval(t);
  }, []);

  // ---- Derived -------------------------------------------------------------
  const isA = !!game && me === game.player_a;
  const isB = !!game && me === game.player_b;
  const myRole: "a" | "b" | null = isA ? "a" : isB ? "b" : null;
  const bothPresent = !!game?.player_a && !!game?.player_b;
  const puzzle: Puzzle | undefined = getPuzzle(game?.puzzle_id);

  const myFound = (isA ? game?.found_a : game?.found_b) ?? [];
  const oppFound = (isA ? game?.found_b : game?.found_a) ?? [];

  const endTime =
    game?.started_at != null
      ? new Date(game.started_at).getTime() + (game.duration ?? BOX_DURATION) * 1000
      : null;
  const remainingMs = endTime ? Math.max(0, endTime - now) : (game?.duration ?? BOX_DURATION) * 1000;
  const remainingSec = Math.ceil(remainingMs / 1000);
  const timeUp = endTime != null && now >= endTime;

  const bothFoundAll =
    !!puzzle &&
    (game?.found_a.length ?? 0) >= puzzle.words.length &&
    (game?.found_b.length ?? 0) >= puzzle.words.length;

  const roundOver =
    game?.status === "finished" || (game?.status === "playing" && (timeUp || bothFoundAll));

  // When time's up (or both cleared the board), persist the finished status once.
  useEffect(() => {
    if (!game || finishedRef.current) return;
    if (game.status === "playing" && (timeUp || bothFoundAll) && (isA || isB)) {
      finishedRef.current = true;
      supabase.from("boxes_games").update({ status: "finished" }).eq("id", code);
    }
  }, [game, timeUp, bothFoundAll, isA, isB, code]);

  // ---- Actions -------------------------------------------------------------
  const tapTile = (i: number) => {
    if (roundOver) return;
    setSelection((sel) => (sel.includes(i) ? sel : [...sel, i]));
  };
  const backspace = () => setSelection((sel) => sel.slice(0, -1));
  const clearSel = () => setSelection([]);

  const submit = useCallback(async () => {
    if (!game || !puzzle || roundOver) return;
    const word = selection.map((i) => puzzle.letters[i]).join("");
    const res = checkWord(puzzle, word, myFound);
    if (!res.ok) {
      setFlash({
        msg:
          res.reason === "duplicate"
            ? "وجدتها من قبل!"
            : res.reason === "short"
            ? "كلمة قصيرة جدًا"
            : "ليست كلمة صحيحة",
        ok: false,
      });
      setSelection([]);
      return;
    }
    const normalized = normalizeArabic(word);
    const nextFound = [...myFound, normalized];
    setFlash({ msg: `✓ ${normalized} (+${wordScore(normalized)})`, ok: true });
    setSelection([]);
    // Optimistic + persist to my own column (no conflict with opponent's).
    setGame({ ...game, ...(isA ? { found_a: nextFound } : { found_b: nextFound }) });
    await supabase
      .from("boxes_games")
      .update(isA ? { found_a: nextFound } : { found_b: nextFound })
      .eq("id", code);
  }, [game, puzzle, roundOver, selection, myFound, isA, code]);

  // Clear the flash message shortly after it appears.
  useEffect(() => {
    if (!flash) return;
    const t = setTimeout(() => setFlash(null), 1400);
    return () => clearTimeout(t);
  }, [flash]);

  const playAgain = useCallback(async () => {
    if (!game) return;
    finishedRef.current = false;
    await supabase
      .from("boxes_games")
      .update({
        status: "playing",
        puzzle_id: randomPuzzleId(game.puzzle_id),
        started_at: new Date().toISOString(),
        found_a: [],
        found_b: [],
        round: game.round + 1,
      })
      .eq("id", code);
    setSelection([]);
  }, [game, code]);

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      /* ignore */
    }
  }
  async function shareGame() {
    const payload = {
      title: "تكوين الكلمات",
      text: "تعال نلعب تكوين الكلمات! 🔤 اضغط الرابط:",
      url: shareUrl,
    };
    if (typeof navigator !== "undefined" && navigator.share) {
      try {
        await navigator.share(payload);
      } catch {
        /* dismissed */
      }
      return;
    }
    copyLink();
  }

  // ---- Screens -------------------------------------------------------------
  if (phase === "loading") return <Centered>جارٍ التحميل…</Centered>;
  if (phase === "notfound")
    return (
      <Centered>
        <p className="mb-4 text-lg">لا توجد غرفة بهذا الرمز.</p>
        <BackHome router={router} />
      </Centered>
    );
  if (phase === "full")
    return (
      <Centered>
        <p className="mb-4 text-lg">هذه الغرفة ممتلئة (لاعبان بالفعل).</p>
        <BackHome router={router} />
      </Centered>
    );
  if (!game) return <Centered>…</Centered>;

  const myScore = totalScore(myFound);
  const oppScore = totalScore(oppFound);
  const winner = myScore > oppScore ? "me" : oppScore > myScore ? "opp" : "draw";
  const currentWord = puzzle ? selection.map((i) => puzzle.letters[i]).join("") : "";

  return (
    <main className="mx-auto flex min-h-dvh max-w-lg flex-col px-4 pt-safe pb-safe">
      {/* Header */}
      <header className="mb-3 flex items-center justify-between">
        <button
          onClick={() => router.push("/")}
          className="text-white/50 hover:text-white"
          aria-label="خروج"
        >
          ✕
        </button>
        <div className="text-center">
          <div className="text-xs text-white/50">رمز الغرفة</div>
          <div dir="ltr" className="text-lg font-bold tracking-widest">
            {code}
          </div>
        </div>
        <div className="text-left">
          <div className="text-xs text-white/50">الجولة {game.round}</div>
          <div className="text-xs font-bold text-fuchsia-300">🔤 تكوين</div>
        </div>
      </header>

      {/* Waiting */}
      {!bothPresent && (
        <div className="glass rounded-3xl p-6 text-center">
          <div className="mb-3 text-4xl animate-floaty">🔗</div>
          <h2 className="mb-2 text-xl font-bold">بانتظار شريكك…</h2>
          <p className="mb-5 text-sm text-white/60">
            أرسل هذا الرابط لشريكك ليدخل نفس الغرفة، وتبدأ المنافسة.
          </p>
          <button
            onClick={shareGame}
            className="btn-primary mb-3 w-full rounded-2xl py-3.5 text-base font-bold"
          >
            📲 مشاركة الرابط
          </button>
          <div className="flex items-center gap-2">
            <input
              readOnly
              value={shareUrl}
              dir="ltr"
              onFocus={(e) => e.currentTarget.select()}
              className="input-field w-full truncate rounded-xl px-3 py-2.5 text-sm text-white/80"
            />
            <button
              onClick={copyLink}
              className="btn-ghost shrink-0 rounded-xl px-4 py-2.5 text-sm font-bold"
            >
              {copied ? "✓ تم" : "نسخ"}
            </button>
          </div>
        </div>
      )}

      {/* Game */}
      {bothPresent && puzzle && (
        <div className="flex flex-col gap-3">
          {/* Timer + scores */}
          <div className="glass flex items-center justify-between rounded-2xl px-4 py-3">
            <div className="text-center">
              <div className="text-xs text-white/50">أنت</div>
              <div className="text-xl font-bold text-emerald-300">{myScore}</div>
            </div>
            <div className="text-center">
              <div
                className={[
                  "text-2xl font-extrabold tabular-nums",
                  remainingSec <= 10 && !roundOver ? "text-rose-400" : "text-white",
                ].join(" ")}
              >
                {roundOver ? "⏱" : `${remainingSec}ث`}
              </div>
              <div className="text-[11px] text-white/40">
                {myFound.length}/{puzzle.words.length} كلمات
              </div>
            </div>
            <div className="text-center">
              <div className="text-xs text-white/50">خصمك</div>
              <div className="text-xl font-bold text-rose-300">{oppScore}</div>
            </div>
          </div>

          {!roundOver ? (
            <>
              {/* Current word + controls */}
              <div className="glass rounded-3xl p-4">
                <div
                  dir="rtl"
                  className="mb-3 flex min-h-14 items-center justify-center rounded-2xl bg-black/25 px-3 text-3xl font-bold tracking-wide"
                >
                  {currentWord || (
                    <span className="text-base font-normal text-white/30">
                      اضغط الحروف لتكوين كلمة
                    </span>
                  )}
                </div>

                {/* Letter tiles */}
                <div dir="rtl" className="flex flex-wrap justify-center gap-2">
                  {puzzle.letters.map((ch, i) => {
                    const used = selection.includes(i);
                    return (
                      <button
                        key={i}
                        onClick={() => tapTile(i)}
                        disabled={used}
                        className={[
                          "h-14 w-14 rounded-2xl text-2xl font-bold transition-all",
                          used
                            ? "bg-fuchsia-500/25 text-white/40"
                            : "bg-white/10 text-white hover:-translate-y-0.5 hover:bg-fuchsia-500/40 active:translate-y-0",
                        ].join(" ")}
                      >
                        {ch}
                      </button>
                    );
                  })}
                </div>

                <div className="mt-3 flex gap-2">
                  <button
                    onClick={backspace}
                    disabled={selection.length === 0}
                    className="btn-ghost flex-1 rounded-2xl py-3 font-bold disabled:opacity-40"
                  >
                    ⌫ حذف
                  </button>
                  <button
                    onClick={clearSel}
                    disabled={selection.length === 0}
                    className="btn-ghost flex-1 rounded-2xl py-3 font-bold disabled:opacity-40"
                  >
                    مسح
                  </button>
                  <button
                    onClick={submit}
                    disabled={selection.length < 2}
                    className="btn-primary flex-[2] rounded-2xl py-3 font-bold disabled:opacity-40"
                  >
                    تأكيد
                  </button>
                </div>

                <div className="mt-2 h-5 text-center text-sm">
                  {flash && (
                    <span className={flash.ok ? "text-emerald-300" : "text-rose-300"}>
                      {flash.msg}
                    </span>
                  )}
                </div>
              </div>

              {/* My found words */}
              <div className="glass rounded-3xl p-4">
                <div className="mb-2 text-sm text-white/60">
                  كلماتك ({myFound.length})
                </div>
                {myFound.length === 0 ? (
                  <p className="text-sm text-white/30">لم تكوّن أي كلمة بعد…</p>
                ) : (
                  <div dir="rtl" className="flex flex-wrap gap-2">
                    {myFound.map((w) => (
                      <span
                        key={w}
                        className="rounded-lg bg-emerald-500/15 px-2.5 py-1 text-sm font-bold text-emerald-200"
                      >
                        {w}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </>
          ) : (
            /* ----- Finished ----- */
            <div className="flex flex-col gap-3">
              <div
                className={[
                  "rounded-3xl p-5 text-center",
                  winner === "draw"
                    ? "bg-white/10 text-white"
                    : winner === "me"
                    ? "bg-emerald-500/15 text-emerald-200"
                    : "bg-rose-500/15 text-rose-200",
                ].join(" ")}
              >
                <div className="mb-1 text-4xl">
                  {winner === "draw" ? "🤝" : winner === "me" ? "🏆" : "😅"}
                </div>
                <p className="text-xl font-bold">
                  {winner === "draw"
                    ? "تعادل!"
                    : winner === "me"
                    ? "فزت! 🎉"
                    : "فاز خصمك"}
                </p>
                <p className="mt-1 text-sm opacity-80">
                  أنت {myScore} — خصمك {oppScore}
                </p>
                <button
                  onClick={playAgain}
                  className="btn-primary mt-4 rounded-2xl px-6 py-3 font-bold"
                >
                  🔄 جولة جديدة
                </button>
              </div>

              {/* All words revealed */}
              <div className="glass rounded-3xl p-4">
                <div className="mb-2 text-sm text-white/60">
                  كل الكلمات ({puzzle.words.length})
                </div>
                <div dir="rtl" className="flex flex-wrap gap-2">
                  {puzzle.words.map((w) => {
                    const mine = myFound.includes(normalizeArabic(w));
                    return (
                      <span
                        key={w}
                        className={[
                          "rounded-lg px-2.5 py-1 text-sm font-bold",
                          mine
                            ? "bg-emerald-500/20 text-emerald-200"
                            : "bg-white/5 text-white/40",
                        ].join(" ")}
                      >
                        {w}
                      </span>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {myRole && <Chat code={code} me={me} role={myRole} />}
    </main>
  );
}

function BackHome({ router }: { router: ReturnType<typeof useRouter> }) {
  return (
    <button
      onClick={() => router.push("/")}
      className="btn-ghost rounded-2xl px-6 py-3 font-bold"
    >
      كل الألعاب
    </button>
  );
}

function Centered({ children }: { children: React.ReactNode }) {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center px-6 text-center text-white/80">
      {children}
    </main>
  );
}
