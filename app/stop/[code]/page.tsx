"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { getPlayerId } from "@/lib/player";
import {
  CATEGORIES,
  ROUND_DURATION,
  categoryPoints,
  randomLetter,
  roundScore,
  type Answers,
} from "@/lib/stop";
import Chat from "@/components/Chat";

type StopGame = {
  id: string;
  player_a: string | null;
  player_b: string | null;
  status: "waiting" | "playing" | "reveal";
  letter: string | null;
  round: number;
  answers_a: Answers;
  answers_b: Answers;
  stopper: string | null;
  started_at: string | null;
  duration: number;
  score_a: number;
  score_b: number;
};

type Phase = "loading" | "notfound" | "full" | "ready";

export default function StopRoom() {
  const params = useParams();
  const router = useRouter();
  const code = String(params.code || "").toUpperCase();

  const [me, setMe] = useState("");
  const [game, setGame] = useState<StopGame | null>(null);
  const [phase, setPhase] = useState<Phase>("loading");
  const [answers, setAnswers] = useState<Answers>({});
  const [shareUrl, setShareUrl] = useState("");
  const [copied, setCopied] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const answersRef = useRef<Answers>({});
  const claimedRef = useRef(false);
  const syncTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const advancingRef = useRef(false);

  useEffect(() => {
    answersRef.current = answers;
  }, [answers]);

  // ---- Load + claim --------------------------------------------------------
  useEffect(() => {
    const pid = getPlayerId();
    setMe(pid);
    setShareUrl(`${window.location.origin}/stop/${code}`);
    let cancelled = false;

    async function init() {
      const { data, error } = await supabase
        .from("stop_games")
        .select("*")
        .eq("id", code)
        .maybeSingle();
      if (cancelled) return;
      if (error || !data) {
        setPhase("notfound");
        return;
      }
      let g = data as StopGame;

      const isPlayer = g.player_a === pid || g.player_b === pid;
      if (!isPlayer && !claimedRef.current) {
        claimedRef.current = true;
        if (g.player_a && !g.player_b && g.player_a !== pid) {
          const { data: upd } = await supabase
            .from("stop_games")
            .update({
              player_b: pid,
              status: "playing",
              letter: randomLetter(),
              started_at: new Date().toISOString(),
              answers_a: {},
              answers_b: {},
              stopper: null,
            })
            .eq("id", code)
            .is("player_b", null)
            .select()
            .maybeSingle();
          if (upd) g = upd as StopGame;
          else {
            const { data: fresh } = await supabase
              .from("stop_games")
              .select("*")
              .eq("id", code)
              .maybeSingle();
            if (fresh) g = fresh as StopGame;
          }
        } else if (!g.player_a) {
          const { data: upd } = await supabase
            .from("stop_games")
            .update({ player_a: pid })
            .eq("id", code)
            .select()
            .maybeSingle();
          if (upd) g = upd as StopGame;
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
      .channel(`stop-${code}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "stop_games", filter: `id=eq.${code}` },
        (payload) => setGame(payload.new as StopGame)
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [code]);

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 300);
    return () => clearInterval(t);
  }, []);

  // ---- Derived -------------------------------------------------------------
  const isA = !!game && me === game.player_a;
  const isB = !!game && me === game.player_b;
  const myRole: "a" | "b" | null = isA ? "a" : isB ? "b" : null;
  const bothPresent = !!game?.player_a && !!game?.player_b;
  const letter = game?.letter ?? "";

  const myScore = (isA ? game?.score_a : game?.score_b) ?? 0;
  const oppScore = (isA ? game?.score_b : game?.score_a) ?? 0;
  const iStopped = !!game && game.stopper === me;

  const endTime =
    game?.started_at != null
      ? new Date(game.started_at).getTime() + (game.duration ?? ROUND_DURATION) * 1000
      : null;
  const remainingSec = endTime ? Math.max(0, Math.ceil((endTime - now) / 1000)) : game?.duration ?? ROUND_DURATION;
  const timeUp = endTime != null && now >= endTime;

  // New round → reset my local answers.
  useEffect(() => {
    if (game?.status === "playing") {
      setAnswers({});
      if (syncTimerRef.current) clearTimeout(syncTimerRef.current);
    }
  }, [game?.round]);

  useEffect(() => {
    if (game?.status === "playing") advancingRef.current = false;
  }, [game?.status]);

  // Time's up → reveal (answers are already live-synced, see below).
  useEffect(() => {
    if (!game) return;
    if (game.status === "playing" && timeUp) {
      if (syncTimerRef.current) clearTimeout(syncTimerRef.current);
      const patch = isA
        ? { answers_a: answersRef.current }
        : { answers_b: answersRef.current };
      supabase
        .from("stop_games")
        .update({ ...patch, status: "reveal", stopper: game.stopper ?? "time" })
        .eq("id", code);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timeUp, game?.status]);

  // ---- Actions -------------------------------------------------------------
  // Answers are saved to the DB as you type (debounced), so pressing "قف" can
  // reveal instantly — no waiting on the other player's app to react.
  const syncAnswers = useCallback(
    async (ans: Answers) => {
      const patch = isA ? { answers_a: ans } : { answers_b: ans };
      await supabase.from("stop_games").update(patch).eq("id", code);
    },
    [isA, code]
  );

  const setAnswer = (cat: string, val: string) => {
    setAnswers((a) => {
      const next = { ...a, [cat]: val };
      answersRef.current = next;
      if (syncTimerRef.current) clearTimeout(syncTimerRef.current);
      syncTimerRef.current = setTimeout(() => syncAnswers(next), 350);
      return next;
    });
  };

  const pressStop = useCallback(async () => {
    if (!game || game.status !== "playing" || iStopped) return;
    if (syncTimerRef.current) clearTimeout(syncTimerRef.current);
    // Reveal immediately; both players' answers are already in the DB.
    const patch = isA
      ? { answers_a: answersRef.current, stopper: me, status: "reveal" as const }
      : { answers_b: answersRef.current, stopper: me, status: "reveal" as const };
    setGame({ ...game, ...patch });
    await supabase.from("stop_games").update(patch).eq("id", code);
  }, [game, iStopped, isA, me, code]);

  const nextRound = useCallback(async () => {
    if (!game || game.status !== "reveal" || advancingRef.current) return;
    advancingRef.current = true;
    const rpA = roundScore(game.answers_a, game.answers_b, game.letter ?? "");
    const rpB = roundScore(game.answers_b, game.answers_a, game.letter ?? "");
    await supabase
      .from("stop_games")
      .update({
        score_a: game.score_a + rpA,
        score_b: game.score_b + rpB,
        letter: randomLetter(game.letter),
        answers_a: {},
        answers_b: {},
        stopper: null,
        started_at: new Date().toISOString(),
        status: "playing",
        round: game.round + 1,
      })
      .eq("id", code);
  }, [game, code]);

  const newGame = useCallback(async () => {
    if (!game) return;
    advancingRef.current = false;
    await supabase
      .from("stop_games")
      .update({
        score_a: 0,
        score_b: 0,
        round: 1,
        letter: randomLetter(game.letter),
        answers_a: {},
        answers_b: {},
        stopper: null,
        started_at: new Date().toISOString(),
        status: "playing",
      })
      .eq("id", code);
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
      title: "اسم حيوان جماد",
      text: "تعال نلعب اسم حيوان جماد بلاد! 🅰️ اضغط الرابط:",
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

  const reveal = game.status === "reveal";
  const myAns = isA ? game.answers_a : game.answers_b;
  const oppAns = isA ? game.answers_b : game.answers_a;
  const rpMine = reveal ? roundScore(myAns, oppAns, letter) : 0;
  const rpOpp = reveal ? roundScore(oppAns, myAns, letter) : 0;
  const totMine = myScore + rpMine;
  const totOpp = oppScore + rpOpp;

  return (
    <main className="mx-auto flex min-h-dvh max-w-lg flex-col px-4 pt-safe pb-safe">
      {/* Header */}
      <header className="mb-3 flex items-center justify-between">
        <button onClick={() => router.push("/")} className="text-white/50 hover:text-white" aria-label="خروج">
          ✕
        </button>
        <div className="flex items-center gap-4">
          <Pill label="أنت" score={totMine} color="emerald" />
          <span className="text-xs text-white/40">مقابل</span>
          <Pill label="خصمك" score={totOpp} color="rose" />
        </div>
        <div dir="ltr" className="text-xs font-bold tracking-widest text-white/50">
          {code}
        </div>
      </header>

      {/* Waiting */}
      {!bothPresent && (
        <div className="glass mt-4 rounded-3xl p-6 text-center">
          <div className="mb-3 text-4xl animate-floaty">🔗</div>
          <h2 className="mb-2 text-xl font-bold">بانتظار شريكك…</h2>
          <p className="mb-5 text-sm text-white/60">
            أرسل الرابط لشريكك ليدخل نفس الغرفة، وتبدأ المنافسة.
          </p>
          <button onClick={shareGame} className="btn-primary mb-3 w-full rounded-2xl py-3.5 text-base font-bold">
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
            <button onClick={copyLink} className="btn-ghost shrink-0 rounded-xl px-4 py-2.5 text-sm font-bold">
              {copied ? "✓ تم" : "نسخ"}
            </button>
          </div>
        </div>
      )}

      {/* Round header: letter + timer */}
      {bothPresent && (
        <div className="mb-3 flex items-center justify-between rounded-2xl glass px-4 py-3">
          <div className="text-sm text-white/60">الجولة {game.round}</div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-white/50">الحرف</span>
            <span className="grid h-11 w-11 place-items-center rounded-xl bg-fuchsia-500/25 text-2xl font-extrabold text-fuchsia-100">
              {letter}
            </span>
          </div>
          <div
            className={[
              "text-lg font-extrabold tabular-nums",
              !reveal && remainingSec <= 15 ? "text-rose-400" : "text-white/80",
            ].join(" ")}
          >
            {reveal ? "⏹" : `${remainingSec}ث`}
          </div>
        </div>
      )}

      {/* Playing */}
      {bothPresent && !reveal && (
        <div className="flex flex-col gap-2">
          {iStopped ? (
            <div className="glass rounded-3xl p-8 text-center">
              <div className="mb-2 text-4xl">✋</div>
              <h2 className="text-xl font-bold">قف! أرسلت إجاباتك</h2>
              <p className="mt-2 text-sm text-white/60">بانتظار كشف النتيجة…</p>
            </div>
          ) : (
            <>
              {CATEGORIES.map((cat) => (
                <div key={cat} className="glass flex items-center gap-3 rounded-2xl p-3">
                  <span className="w-16 shrink-0 text-sm font-bold text-white/70">{cat}</span>
                  <input
                    value={answers[cat] ?? ""}
                    onChange={(e) => setAnswer(cat, e.target.value)}
                    placeholder={`${cat} بحرف ${letter}`}
                    dir="rtl"
                    className="input-field w-full rounded-xl px-3 py-2.5 text-base text-white placeholder:text-white/25"
                  />
                </div>
              ))}
              <button
                onClick={pressStop}
                className="btn-primary mt-2 w-full rounded-2xl py-4 text-xl font-extrabold"
              >
                قف! ✋
              </button>
              <p className="text-center text-xs text-white/40">
                اضغط «قف» عندما تنتهي — سيوقف الجولة لكليكما.
              </p>
            </>
          )}
        </div>
      )}

      {/* Reveal */}
      {bothPresent && reveal && (
        <div className="flex flex-col gap-3">
          <div className="glass rounded-3xl p-4">
            <div className="mb-2 grid grid-cols-[1fr_auto_1fr] items-center gap-2 text-center text-xs text-white/50">
              <span>أنت</span>
              <span>التصنيف</span>
              <span>خصمك</span>
            </div>
            {CATEGORIES.map((cat) => {
              const mine = myAns[cat] || "";
              const opp = oppAns[cat] || "";
              const pMine = categoryPoints(mine, opp, letter);
              const pOpp = categoryPoints(opp, mine, letter);
              return (
                <div key={cat} className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 border-t border-white/5 py-2 text-sm" dir="rtl">
                  <AnswerCell word={mine} points={pMine} />
                  <span className="text-center text-xs font-bold text-white/50">{cat}</span>
                  <AnswerCell word={opp} points={pOpp} />
                </div>
              );
            })}
            <div className="mt-2 grid grid-cols-[1fr_auto_1fr] items-center gap-2 border-t border-white/10 pt-2 text-center font-bold">
              <span className="text-emerald-300">+{rpMine}</span>
              <span className="text-xs text-white/50">هذه الجولة</span>
              <span className="text-rose-300">+{rpOpp}</span>
            </div>
          </div>

          <div className="flex gap-2">
            <button onClick={newGame} className="btn-ghost flex-1 rounded-2xl py-3 font-bold">
              لعبة جديدة
            </button>
            <button onClick={nextRound} className="btn-primary flex-[2] rounded-2xl py-3 font-bold">
              الجولة التالية ▶
            </button>
          </div>
        </div>
      )}

      {myRole && <Chat code={code} me={me} role={myRole} />}
    </main>
  );
}

function AnswerCell({ word, points }: { word: string; points: number }) {
  const color =
    points === 10 ? "text-emerald-200" : points === 5 ? "text-amber-200" : "text-white/30";
  return (
    <div className="flex items-center justify-between gap-1 rounded-lg bg-white/5 px-2 py-1">
      <span className={["truncate font-bold", color].join(" ")}>{word || "—"}</span>
      <span className="shrink-0 text-[11px] text-white/40">{points}</span>
    </div>
  );
}

function Pill({ label, score, color }: { label: string; score: number; color: "emerald" | "rose" }) {
  return (
    <div className="text-center">
      <div className="text-[11px] text-white/50">{label}</div>
      <div className={["text-lg font-extrabold tabular-nums", color === "emerald" ? "text-emerald-300" : "text-rose-300"].join(" ")}>
        {score}
      </div>
    </div>
  );
}

function BackHome({ router }: { router: ReturnType<typeof useRouter> }) {
  return (
    <button onClick={() => router.push("/")} className="btn-ghost rounded-2xl px-6 py-3 font-bold">
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
