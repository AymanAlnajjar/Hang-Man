"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { getPlayerId } from "@/lib/player";
import { saveRecentRoom } from "@/lib/recent";
import { normalizeArabic } from "@/lib/arabic";
import {
  loadFullDictionary,
  isWord,
  randomWordOfLength,
} from "@/lib/dictionary";
import {
  WORD_LENGTH,
  MAX_GUESSES,
  FALLBACK_TARGETS,
  scoreGuess,
  keyStates,
  isSolved,
  wordleWinner,
  type Mark,
} from "@/lib/wordle";
import Chat from "@/components/Chat";
import MatchResult from "@/components/MatchResult";

type WordleGame = {
  id: string;
  player_a: string | null;
  player_b: string | null;
  status: "waiting" | "playing";
  target: string | null;
  word_len: number;
  max_guesses: number;
  guesses_a: string[];
  guesses_b: string[];
  done_a: boolean;
  done_b: boolean;
  wins_a: number;
  wins_b: number;
  round: number;
};

type Phase = "loading" | "notfound" | "full" | "ready";

const KEY_ROWS = [
  ["ض", "ص", "ث", "ق", "ف", "غ", "ع", "ه", "خ", "ح", "ج", "د"],
  ["ش", "س", "ي", "ب", "ل", "ا", "ت", "ن", "م", "ك", "ط", "ذ"],
  ["ظ", "ز", "و", "ة", "ء", "ر"],
];

function newTarget(len: number): string {
  return (
    randomWordOfLength(len) ??
    FALLBACK_TARGETS[Math.floor(Math.random() * FALLBACK_TARGETS.length)]
  );
}

// Wordle tiles keep clear, high-contrast states within the editorial palette.
const MARK_COLORS: Record<Mark, { bg: string; fg: string; label: string }> = {
  correct: { bg: "#4f9d6b", fg: "#ffffff", label: "بمكانه" },
  present: { bg: "#ffd369", fg: "#20243d", label: "بمكان خاطئ" },
  absent: { bg: "#a8a49b", fg: "#20243d", label: "غير موجود" },
};
const markBg = (m: Mark | null): string => (m ? MARK_COLORS[m].bg : "#fffaf1");
const markFg = (m: Mark | null): string => (m ? MARK_COLORS[m].fg : "#20243d");
const TILE = 52; // fixed tile size so rows never resize (fits narrow phones)

export default function WordleRoom() {
  const params = useParams();
  const router = useRouter();
  const code = String(params.code || "").toUpperCase();

  const [me, setMe] = useState("");
  const [game, setGame] = useState<WordleGame | null>(null);
  const [phase, setPhase] = useState<Phase>("loading");
  const [current, setCurrent] = useState("");
  const [flash, setFlash] = useState<string | null>(null);
  const [badGuess, setBadGuess] = useState(0); // bumps to remount+replay the shake
  const [shaking, setShaking] = useState(false);
  const [shareUrl, setShareUrl] = useState("");
  const [copied, setCopied] = useState(false);
  const claimedRef = useRef(false);
  const advancingRef = useRef(false);

  useEffect(() => {
    const pid = getPlayerId();
    setMe(pid);
    setShareUrl(`${window.location.origin}/wordle/${code}`);
    saveRecentRoom("wordle", code);
    let cancelled = false;

    async function init() {
      const { data, error } = await supabase
        .from("wordle_games")
        .select("*")
        .eq("id", code)
        .maybeSingle();
      if (cancelled) return;
      if (error || !data) {
        setPhase("notfound");
        return;
      }
      let g = data as WordleGame;
      await loadFullDictionary();
      if (cancelled) return;

      const isPlayer = g.player_a === pid || g.player_b === pid;
      if (!isPlayer && !claimedRef.current) {
        claimedRef.current = true;
        if (g.player_a && !g.player_b && g.player_a !== pid) {
          const { data: upd } = await supabase
            .from("wordle_games")
            .update({
              player_b: pid,
              status: "playing",
              target: newTarget(g.word_len ?? WORD_LENGTH),
              guesses_a: [],
              guesses_b: [],
              done_a: false,
              done_b: false,
            })
            .eq("id", code)
            .is("player_b", null)
            .select()
            .maybeSingle();
          if (upd) g = upd as WordleGame;
          else {
            const { data: fresh } = await supabase
              .from("wordle_games")
              .select("*")
              .eq("id", code)
              .maybeSingle();
            if (fresh) g = fresh as WordleGame;
          }
        } else if (!g.player_a) {
          const { data: upd } = await supabase
            .from("wordle_games")
            .update({ player_a: pid })
            .eq("id", code)
            .select()
            .maybeSingle();
          if (upd) g = upd as WordleGame;
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

  useEffect(() => {
    if (!code) return;
    const channel = supabase
      .channel(`wordle-${code}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "wordle_games", filter: `id=eq.${code}` },
        (payload) => setGame(payload.new as WordleGame)
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [code]);

  // ---- Derived -------------------------------------------------------------
  const isA = !!game && me === game.player_a;
  const isB = !!game && me === game.player_b;
  const myRole: "a" | "b" | null = isA ? "a" : isB ? "b" : null;
  const bothPresent = !!game?.player_a && !!game?.player_b;
  const target = game?.target ?? "";
  const wordLen = game?.word_len ?? WORD_LENGTH;
  const maxGuesses = game?.max_guesses ?? MAX_GUESSES;

  const myGuesses = (isA ? game?.guesses_a : game?.guesses_b) ?? [];
  const oppGuesses = (isA ? game?.guesses_b : game?.guesses_a) ?? [];
  const iDone = !!(isA ? game?.done_a : game?.done_b);
  const bothDone = !!game?.done_a && !!game?.done_b;
  const iSolved = isSolved(myGuesses, target);

  // Reset the typed row on a new word.
  useEffect(() => {
    setCurrent("");
    advancingRef.current = false;
  }, [game?.round]);

  useEffect(() => {
    if (!flash) return;
    const t = setTimeout(() => setFlash(null), 1300);
    return () => clearTimeout(t);
  }, [flash]);

  // ---- Actions -------------------------------------------------------------
  const addLetter = (ch: string) => {
    if (iDone || bothDone) return;
    setCurrent((c) => (c.length >= wordLen ? c : c + ch));
  };
  const del = () => setCurrent((c) => c.slice(0, -1));

  // Remount the active row (badGuess) and shake it briefly, then stop so the
  // shake doesn't replay when the row advances after a later valid guess.
  const triggerShake = useCallback(() => {
    setBadGuess((n) => n + 1);
    setShaking(true);
    setTimeout(() => setShaking(false), 350);
  }, []);

  const submitGuess = useCallback(async () => {
    if (!game || iDone || bothDone || !target) return;
    const guess = normalizeArabic(current);
    if (guess.length !== wordLen) {
      setFlash(`الكلمة ${wordLen} أحرف`);
      triggerShake();
      return;
    }
    if (!isWord(guess)) {
      setFlash("لم نعثر على هذه الكلمة");
      triggerShake();
      return;
    }
    const nextGuesses = [...myGuesses, guess];
    const done = guess === target || nextGuesses.length >= maxGuesses;
    const patch = isA
      ? { guesses_a: nextGuesses, done_a: done }
      : { guesses_b: nextGuesses, done_b: done };
    setGame({ ...game, ...patch });
    setCurrent("");
    await supabase.from("wordle_games").update(patch).eq("id", code);
  }, [game, iDone, bothDone, target, current, wordLen, maxGuesses, myGuesses, isA, code, triggerShake]);

  const nextWord = useCallback(async () => {
    if (!game || !bothDone || advancingRef.current) return;
    advancingRef.current = true;
    const winner = wordleWinner(game.guesses_a, game.guesses_b, game.target ?? "");
    const wins_a = game.wins_a + (winner === "a" ? 1 : 0);
    const wins_b = game.wins_b + (winner === "b" ? 1 : 0);
    await supabase
      .from("wordle_games")
      .update({
        target: newTarget(wordLen),
        guesses_a: [],
        guesses_b: [],
        done_a: false,
        done_b: false,
        wins_a,
        wins_b,
        round: game.round + 1,
      })
      .eq("id", code);
  }, [game, bothDone, wordLen, code]);

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
    const payload = { title: "وردل", text: "تعال نلعب وردل! 🟩 اضغط الرابط:", url: shareUrl };
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

  const kbStates = keyStates(myGuesses, target);
  const winner = bothDone ? wordleWinner(game.guesses_a, game.guesses_b, target) : null;
  const iWon = (winner === "a" && isA) || (winner === "b" && !isA);
  const myWins = isA ? game.wins_a : game.wins_b;
  const oppWins = isA ? game.wins_b : game.wins_a;

  return (
    <main className="mx-auto flex min-h-dvh max-w-[480px] flex-col px-4 pt-safe pb-safe">
      {/* Header */}
      <header className="mb-2 flex items-center justify-between">
        <button
          onClick={() => router.push("/")}
          className="grid h-10 w-10 place-items-center rounded-md border-2 border-ink bg-surface-strong text-ink"
          aria-label="خروج"
        >
          ✕
        </button>
        <div className="flex items-center gap-4">
          <Pill label="أنت" score={myWins} color="primary" />
          <span className="text-xs text-ink-soft">الفوز</span>
          <Pill label="خصمك" score={oppWins} color="coral" />
        </div>
        <div dir="ltr" className="text-xs font-bold tracking-widest text-ink-soft">
          {code}
        </div>
      </header>

      {/* Waiting */}
      {!bothPresent && (
        <div className="card mt-4 bg-surface p-6 text-center">
          <div className="mb-3 text-4xl animate-floaty">🔗</div>
          <h2 className="mb-2 text-xl font-extrabold">بانتظار شريكك…</h2>
          <p className="mb-5 text-sm text-ink-soft">
            أرسل الرابط لشريكك ليدخل نفس الغرفة، وتحصلان على نفس الكلمة.
          </p>
          <button onClick={shareGame} className="btn btn-primary mb-3 w-full text-base">
            📲 مشاركة الرابط
          </button>
          <div className="flex items-center gap-2">
            <input
              readOnly
              value={shareUrl}
              dir="ltr"
              onFocus={(e) => e.currentTarget.select()}
              className="input-field w-full truncate px-3 py-2.5 text-sm text-ink-soft"
            />
            <button onClick={copyLink} className="btn btn-ghost shrink-0 px-4 text-sm">
              {copied ? "✓ تم" : "نسخ"}
            </button>
          </div>
        </div>
      )}

      {bothPresent && (
        <>
          {/* Opponent progress — count only (never the colours, to avoid leaking
              the shared answer) */}
          <div className="card mb-2 flex items-center justify-between bg-surface px-4 py-2 text-sm">
            <span className="text-ink-soft">تقدّم خصمك</span>
            <span className="font-bold text-ink">
              {isSolved(oppGuesses, target)
                ? `✅ حلّها في ${oppGuesses.length}`
                : iDone || bothDone
                ? oppGuesses.length >= maxGuesses
                  ? "لم يحلّها"
                  : `${oppGuesses.length}/${maxGuesses}`
                : `${oppGuesses.length}/${maxGuesses} محاولات`}
            </span>
          </div>

          {/* Guess grid */}
          <div className="mx-auto flex flex-col gap-1.5 py-2" aria-live="polite">
            {Array.from({ length: maxGuesses }).map((_, row) => {
              const submitted = row < myGuesses.length;
              const isCurrent = !iDone && row === myGuesses.length;
              const rowWord = submitted ? myGuesses[row] : isCurrent ? current : "";
              const marks = submitted ? scoreGuess(myGuesses[row], target) : null;
              return (
                <div
                  // Remount the active row on a bad guess so the shake replays.
                  key={isCurrent ? `cur-${badGuess}` : row}
                  dir="rtl"
                  className={[
                    "flex justify-center gap-1.5",
                    isCurrent && shaking ? "animate-shake" : "",
                  ].join(" ")}
                >
                  {Array.from({ length: wordLen }).map((_, col) => {
                    const ch = rowWord[col] || "";
                    const mark = marks ? marks[col] : null;
                    const filledEmpty = isCurrent && !!ch;
                    return (
                      <div
                        key={col}
                        aria-label={
                          mark ? `${ch} — ${MARK_COLORS[mark].label}` : ch || "فارغ"
                        }
                        className={[
                          "grid place-items-center rounded-md border-2 border-ink text-3xl font-extrabold",
                          submitted ? "animate-flip" : "",
                        ].join(" ")}
                        style={{
                          width: TILE,
                          height: TILE,
                          background: markBg(mark),
                          color: markFg(mark),
                          outline: filledEmpty ? "2px solid #5267e8" : "none",
                          outlineOffset: "-4px",
                        }}
                      >
                        {ch}
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>

          {!bothDone && (
            <div className="mx-auto mt-1 flex items-center justify-center gap-3 text-[11px] text-ink-soft">
              <span className="flex items-center gap-1">
                <i className="inline-block h-3 w-3 rounded-sm border border-ink" style={{ background: "#4f9d6b" }} />
                بمكانه
              </span>
              <span className="flex items-center gap-1">
                <i className="inline-block h-3 w-3 rounded-sm border border-ink" style={{ background: "#ffd369" }} />
                بمكان خاطئ
              </span>
              <span className="flex items-center gap-1">
                <i className="inline-block h-3 w-3 rounded-sm border border-ink" style={{ background: "#a8a49b" }} />
                غير موجود
              </span>
            </div>
          )}

          <div className="h-5 text-center text-sm font-bold text-danger" aria-live="assertive">
            {flash}
          </div>

          {/* Finished */}
          {bothDone ? (
            <div
              className={[
                "card mt-2 p-5 text-center",
                winner === "draw" ? "bg-surface" : iWon ? "bg-success-soft" : "bg-danger-soft",
              ].join(" ")}
            >
              <div className="mb-1 animate-stamp text-4xl">{winner === "draw" ? "🤝" : iWon ? "🏆" : "😅"}</div>
              <p className="text-xl font-extrabold">
                {winner === "draw" ? "تعادل!" : iWon ? "فزت! 🎉" : "فاز خصمك"}
              </p>
              <p className="mt-2 text-sm text-ink-soft" dir="rtl">
                الكلمة: <span className="font-bold text-ink">{target}</span>
              </p>
              <p className="mt-1 text-xs text-ink-soft">
                {iSolved ? `حللتها في ${myGuesses.length}` : "لم تحلّها"} · خصمك:{" "}
                {isSolved(oppGuesses, target) ? `${oppGuesses.length}` : "لم يحلّها"}
              </p>
              <button onClick={nextWord} className="btn btn-primary mt-4 px-8">
                🔄 كلمة جديدة
              </button>
              <div className="mt-3">
                <MatchResult
                  matchKey={`wl:${code}:${game.round}`}
                  winner={winner ?? "draw"}
                  playerA={game.player_a}
                  playerB={game.player_b}
                />
              </div>
            </div>
          ) : iDone ? (
            <p className="mt-2 text-center text-sm text-ink-soft">
              {iSolved ? "🎉 حللتها! بانتظار خصمك…" : "انتهت محاولاتك. بانتظار خصمك…"}
            </p>
          ) : (
            /* Keyboard */
            <div className="mt-2 flex flex-col gap-1.5" dir="rtl">
              {KEY_ROWS.map((rowKeys, r) => (
                <div key={r} className="flex justify-center gap-1">
                  {r === KEY_ROWS.length - 1 && (
                    <button
                      onClick={submitGuess}
                      className="rounded-md border-2 border-ink bg-primary px-3 text-sm font-bold text-white"
                    >
                      تحقّق
                    </button>
                  )}
                  {rowKeys.map((k) => (
                    <button
                      key={k}
                      onClick={() => addLetter(k)}
                      className="h-12 min-w-[28px] flex-1 rounded-md border-2 border-ink text-lg font-bold"
                      style={{
                        maxWidth: 36,
                        background: kbStates[k] ? markBg(kbStates[k]) : "#fffaf1",
                        color: kbStates[k] ? markFg(kbStates[k]) : "#20243d",
                      }}
                    >
                      {k}
                    </button>
                  ))}
                  {r === KEY_ROWS.length - 1 && (
                    <button
                      onClick={del}
                      className="rounded-md border-2 border-ink bg-surface-strong px-3 text-lg font-bold text-ink"
                    >
                      ⌫
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {myRole && <Chat code={code} me={me} role={myRole} />}
    </main>
  );
}

function Pill({ label, score, color }: { label: string; score: number; color: "primary" | "coral" }) {
  return (
    <div className="text-center">
      <div className="text-[11px] text-ink-soft">{label}</div>
      <div
        className={[
          "text-lg font-extrabold tabular-nums",
          color === "primary" ? "text-primary-dark" : "text-coral",
        ].join(" ")}
      >
        {score}
      </div>
    </div>
  );
}

function BackHome({ router }: { router: ReturnType<typeof useRouter> }) {
  return (
    <button onClick={() => router.push("/")} className="btn btn-ghost px-6">
      كل الألعاب
    </button>
  );
}

function Centered({ children }: { children: React.ReactNode }) {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center px-6 text-center text-ink-soft">
      {children}
    </main>
  );
}
