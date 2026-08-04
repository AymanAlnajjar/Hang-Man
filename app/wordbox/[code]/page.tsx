"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { getPlayerId } from "@/lib/player";
import { saveRecentRoom } from "@/lib/recent";
import { normalizeArabic } from "@/lib/arabic";
import {
  CELLS,
  GRID_SIZE,
  MIN_WORD,
  PLAY_SECS,
  REVEAL_SECS,
  MAX_ROUNDS,
  areAdjacent,
  checkPath,
  generateGrid,
  pathToWord,
  rc,
  totalScore,
  wordScore,
} from "@/lib/grid";
import { loadFullDictionary } from "@/lib/dictionary";
import Chat from "@/components/Chat";
import MatchResult from "@/components/MatchResult";

type Grid = string[];
type BoxesGame = {
  id: string;
  player_a: string | null;
  player_b: string | null;
  status: "waiting" | "playing";
  started_at: string | null;
  max_rounds: number;
  play_secs: number;
  reveal_secs: number;
  grids: Grid[] | null;
  rounds_a: string[][];
  rounds_b: string[][];
};

type Phase = "loading" | "notfound" | "full" | "ready";

const emptyRounds = (n: number): string[][] =>
  Array.from({ length: n }, () => []);

export default function WordGridRoom() {
  const params = useParams();
  const router = useRouter();
  const code = String(params.code || "").toUpperCase();

  const [me, setMe] = useState("");
  const [game, setGame] = useState<BoxesGame | null>(null);
  const [phase, setPhase] = useState<Phase>("loading");
  const [shareUrl, setShareUrl] = useState("");
  const [copied, setCopied] = useState(false);
  const [selection, setSelection] = useState<number[]>([]);
  const [dragging, setDragging] = useState(false);
  const [flash, setFlash] = useState<{ msg: string; ok: boolean } | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [boardW, setBoardW] = useState(320);
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const boardRef = useRef<HTMLDivElement | null>(null);
  const selectionRef = useRef<number[]>([]);
  const claimedRef = useRef(false);

  useEffect(() => {
    selectionRef.current = selection;
  }, [selection]);

  // ---- Load + claim --------------------------------------------------------
  useEffect(() => {
    const pid = getPlayerId();
    setMe(pid);
    setShareUrl(`${window.location.origin}/wordbox/${code}`);
    saveRecentRoom("wordbox", code);
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
      await loadFullDictionary();
      if (cancelled) return;

      const isPlayer = g.player_a === pid || g.player_b === pid;
      if (!isPlayer && !claimedRef.current) {
        claimedRef.current = true;
        if (g.player_a && !g.player_b && g.player_a !== pid) {
          const maxR = g.max_rounds ?? MAX_ROUNDS;
          const { data: upd } = await supabase
            .from("boxes_games")
            .update({
              player_b: pid,
              status: "playing",
              grids: Array.from({ length: maxR }, () => generateGrid()),
              rounds_a: emptyRounds(maxR),
              rounds_b: emptyRounds(maxR),
              started_at: new Date().toISOString(),
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

  // ---- Realtime + clock ----------------------------------------------------
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

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    const onResize = () => {
      if (wrapRef.current) setBoardW(Math.min(wrapRef.current.clientWidth, 400));
    };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  // ---- Roles + timeline ----------------------------------------------------
  const isA = !!game && me === game.player_a;
  const isB = !!game && me === game.player_b;
  const myRole: "a" | "b" | null = isA ? "a" : isB ? "b" : null;
  const bothPresent = !!game?.player_a && !!game?.player_b;

  const maxR = game?.max_rounds ?? MAX_ROUNDS;
  const playS = game?.play_secs ?? PLAY_SECS;
  const revealS = game?.reveal_secs ?? REVEAL_SECS;
  const span = playS + revealS;

  const startMs = game?.started_at ? new Date(game.started_at).getTime() : null;
  const elapsed = startMs != null ? (now - startMs) / 1000 : 0;
  const matchTotal = maxR * span;
  const started = startMs != null && bothPresent;
  const finished = started && elapsed >= matchTotal;
  const roundIdx = finished ? maxR - 1 : Math.max(0, Math.floor(elapsed / span));
  const within = elapsed - roundIdx * span;
  const inPlay = started && !finished && within < playS;
  const inReveal = started && !finished && within >= playS;
  const playRemaining = Math.max(0, Math.ceil(playS - within));
  const revealRemaining = Math.max(0, Math.ceil(span - within));

  const grid: Grid | null = game?.grids?.[roundIdx] ?? null;
  const myRounds = (isA ? game?.rounds_a : game?.rounds_b) ?? [];
  const oppRounds = (isA ? game?.rounds_b : game?.rounds_a) ?? [];
  const myWords = myRounds[roundIdx] ?? [];
  const oppWords = oppRounds[roundIdx] ?? [];

  // Stars: a round is decided once its play time is over.
  const { myStars, oppStars } = useMemo(() => {
    let m = 0;
    let o = 0;
    for (let r = 0; r < maxR; r++) {
      const decided = finished || r < roundIdx || (r === roundIdx && inReveal);
      if (!decided) continue;
      const ms = totalScore(myRounds[r] ?? []);
      const os = totalScore(oppRounds[r] ?? []);
      if (ms > os) m++;
      else if (os > ms) o++;
    }
    return { myStars: m, oppStars: o };
  }, [maxR, finished, roundIdx, inReveal, myRounds, oppRounds]);

  // ---- Board geometry ------------------------------------------------------
  const gap = boardW * 0.04;
  const cell = (boardW - gap * (GRID_SIZE - 1)) / GRID_SIZE;
  const step = cell + gap;
  const center = (i: number) => {
    const { r, c } = rc(i);
    return { x: c * step + cell / 2, y: r * step + cell / 2 };
  };

  useEffect(() => {
    if (inPlay && wrapRef.current) {
      setBoardW(Math.min(wrapRef.current.clientWidth, 400));
    }
  }, [inPlay, roundIdx]);

  // Clear the current trace when the round changes.
  useEffect(() => {
    setSelection([]);
  }, [roundIdx, inPlay]);

  // ---- Swipe tracing -------------------------------------------------------
  const tileAtPointer = (e: ReactPointerEvent): number | null => {
    const el = boardRef.current;
    if (!el) return null;
    const r = el.getBoundingClientRect();
    const x = e.clientX - r.left;
    const y = e.clientY - r.top;
    const rad = cell * 0.52;
    for (let i = 0; i < CELLS; i++) {
      const c = center(i);
      const dx = x - c.x;
      const dy = y - c.y;
      if (dx * dx + dy * dy <= rad * rad) return i;
    }
    return null;
  };

  const commitWord = useCallback(
    async (path: number[]) => {
      if (!game || !grid || !inPlay || path.length < MIN_WORD) return;
      const res = checkPath(grid, path, myWords);
      if (!res.ok) {
        setFlash({
          msg:
            res.reason === "duplicate"
              ? "وجدتها من قبل"
              : res.reason === "short"
              ? `أقل شيء ${MIN_WORD} أحرف`
              : "ليست كلمة",
          ok: false,
        });
        return;
      }
      const word = normalizeArabic(pathToWord(grid, path));
      const nextRounds = (isA ? game.rounds_a : game.rounds_b).map((r) => [...r]);
      while (nextRounds.length < maxR) nextRounds.push([]);
      nextRounds[roundIdx] = [...(nextRounds[roundIdx] ?? []), word];
      setFlash({ msg: `✓ ${word} +${wordScore(word)}`, ok: true });
      setGame({ ...game, ...(isA ? { rounds_a: nextRounds } : { rounds_b: nextRounds }) });
      await supabase
        .from("boxes_games")
        .update(isA ? { rounds_a: nextRounds } : { rounds_b: nextRounds })
        .eq("id", code);
    },
    [game, grid, inPlay, myWords, isA, roundIdx, maxR, code]
  );

  useEffect(() => {
    if (!flash) return;
    const t = setTimeout(() => setFlash(null), 1300);
    return () => clearTimeout(t);
  }, [flash]);

  const onPointerDown = (e: ReactPointerEvent) => {
    if (!inPlay) return;
    const i = tileAtPointer(e);
    if (i == null) return;
    e.currentTarget.setPointerCapture?.(e.pointerId);
    setDragging(true);
    setSelection([i]);
  };
  const onPointerMove = (e: ReactPointerEvent) => {
    if (!dragging || !inPlay) return;
    const i = tileAtPointer(e);
    if (i == null) return;
    setSelection((sel) => {
      if (sel.length === 0) return [i];
      const last = sel[sel.length - 1];
      if (i === last) return sel;
      if (sel.length >= 2 && i === sel[sel.length - 2]) return sel.slice(0, -1);
      if (sel.includes(i)) return sel;
      if (areAdjacent(last, i)) return [...sel, i];
      return sel;
    });
  };
  const onPointerUp = () => {
    if (!dragging) return;
    setDragging(false);
    const path = selectionRef.current;
    setSelection([]);
    commitWord(path);
  };

  // ---- New match -----------------------------------------------------------
  const newMatch = useCallback(async () => {
    if (!game) return;
    await supabase
      .from("boxes_games")
      .update({
        grids: Array.from({ length: maxR }, () => generateGrid()),
        rounds_a: emptyRounds(maxR),
        rounds_b: emptyRounds(maxR),
        started_at: new Date().toISOString(),
        status: "playing",
      })
      .eq("id", code);
    setSelection([]);
  }, [game, maxR, code]);

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
    const payload = { title: "تكوين الكلمات", text: "تعال نلعب تكوين الكلمات! 🔤 اضغط الرابط:", url: shareUrl };
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

  const myRoundScore = totalScore(myWords);
  const oppRoundScore = totalScore(oppWords);
  const timePct = inPlay ? (playRemaining / playS) * 100 : 0;

  return (
    <main className="mx-auto flex min-h-dvh max-w-[480px] flex-col px-4 pt-safe pb-safe">
      {/* Header: stars */}
      <header className="mb-2 flex items-center justify-between">
        <button
          onClick={() => router.push("/")}
          className="grid h-10 w-10 place-items-center rounded-md border-2 border-ink bg-surface-strong text-ink"
          aria-label="خروج"
        >
          ✕
        </button>
        <div className="flex items-center gap-4">
          <Stars label="أنت" count={myStars} total={maxR} color="primary" />
          <span className="text-xs text-ink-soft">مقابل</span>
          <Stars label="خصمك" count={oppStars} total={maxR} color="coral" />
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
            أرسل الرابط لشريكك، وتبدأ المباراة تلقائيًا حين يدخل.
          </p>
          <button onClick={shareGame} className="btn btn-primary mb-3 w-full text-base">
            📲 مشاركة الرابط
          </button>
          <div className="flex items-center gap-2">
            <input readOnly value={shareUrl} dir="ltr" onFocus={(e) => e.currentTarget.select()} className="input-field w-full truncate px-3 py-2.5 text-sm text-ink-soft" />
            <button onClick={copyLink} className="btn btn-ghost shrink-0 px-4 text-sm">
              {copied ? "✓ تم" : "نسخ"}
            </button>
          </div>
        </div>
      )}

      {/* Round header */}
      {bothPresent && !finished && (
        <div className="mb-2">
          <div className="mb-1 flex items-center justify-between text-sm">
            <span className="font-bold text-ink">الجولة {roundIdx + 1}/{maxR}</span>
            <span className="tabular-nums font-extrabold text-ink">
              {inPlay ? (
                <span className={playRemaining <= 15 ? "text-danger" : ""}>{playRemaining}ث</span>
              ) : (
                <span className="text-primary-dark">الجولة التالية بعد {revealRemaining}ث</span>
              )}
            </span>
          </div>
          <div className="h-3 w-full overflow-hidden rounded-pill border-2 border-ink bg-surface-strong">
            <div className="h-full rounded-pill bg-primary transition-[width] duration-200" style={{ width: `${timePct}%` }} />
          </div>
        </div>
      )}

      {/* Board (play) */}
      {bothPresent && inPlay && grid && (
        <>
          <div className="card mb-2 flex items-center justify-between bg-surface px-4 py-2 text-sm">
            <span className="font-bold text-primary-dark">نقاطك: {myRoundScore}</span>
            <span className="font-bold text-coral">خصمك: {oppRoundScore}</span>
          </div>
          <div ref={wrapRef} className="flex justify-center">
            <div
              ref={boardRef}
              className="relative touch-none select-none"
              style={{ width: boardW, height: boardW }}
              onPointerDown={onPointerDown}
              onPointerMove={onPointerMove}
              onPointerUp={onPointerUp}
              onPointerCancel={onPointerUp}
            >
              <svg className="pointer-events-none absolute inset-0" width={boardW} height={boardW}>
                {selection.length > 1 && (
                  <polyline
                    points={selection.map((i) => { const p = center(i); return `${p.x},${p.y}`; }).join(" ")}
                    fill="none"
                    stroke="#ff806c"
                    strokeWidth={Math.max(4, cell * 0.12)}
                    strokeLinejoin="round"
                    strokeLinecap="round"
                    opacity={0.9}
                  />
                )}
                {selection.map((i) => { const p = center(i); return <circle key={i} cx={p.x} cy={p.y} r={cell * 0.12} fill="#ff806c" />; })}
              </svg>
              {grid.map((ch, i) => {
                const p = center(i);
                const sel = selection.includes(i);
                const isLast = selection[selection.length - 1] === i;
                return (
                  <div
                    key={i}
                    className="absolute grid place-items-center rounded-full font-extrabold transition-colors"
                    style={{
                      width: cell, height: cell, left: p.x, top: p.y,
                      transform: `translate(-50%, -50%)${sel ? " scale(1.06)" : ""}`,
                      fontSize: cell * 0.42,
                      background: sel ? "#5267e8" : "#fffaf1",
                      color: sel ? "#ffffff" : "#20243d",
                      border: "2px solid #20243d",
                      zIndex: sel ? 2 : 1,
                      pointerEvents: "none",
                      outline: isLast && sel ? "3px solid #ffd369" : "none",
                    }}
                  >
                    {ch}
                  </div>
                );
              })}
            </div>
          </div>
          <div className="mt-2 h-5 text-center text-sm">
            {flash && <span className={flash.ok ? "font-bold text-success" : "font-bold text-danger"}>{flash.msg}</span>}
          </div>
          <div className="card mt-1 bg-surface p-3">
            <div className="mb-1 text-xs text-ink-soft">كلماتك ({myWords.length})</div>
            <WordChips words={myWords} tone="primary" />
          </div>
        </>
      )}

      {/* Round reveal */}
      {bothPresent && inReveal && (
        <div className="flex flex-col gap-3">
          <div className="card bg-surface p-5 text-center">
            <div className="mb-1 text-3xl">
              {myRoundScore > oppRoundScore ? "🌟" : oppRoundScore > myRoundScore ? "🙁" : "🤝"}
            </div>
            <h2 className="text-lg font-extrabold">
              {myRoundScore > oppRoundScore
                ? `فزت بالجولة ${roundIdx + 1}!`
                : oppRoundScore > myRoundScore
                ? `فاز خصمك بالجولة ${roundIdx + 1}`
                : `تعادل في الجولة ${roundIdx + 1}`}
            </h2>
            <p className="mt-1 text-sm text-ink-soft">
              أنت {myRoundScore} — خصمك {oppRoundScore}
            </p>
            <p className="mt-2 text-xs text-primary-dark">الجولة التالية بعد {revealRemaining}ث…</p>
          </div>
          <BothWords myWords={myWords} oppWords={oppWords} />
        </div>
      )}

      {/* Final */}
      {bothPresent && finished && (
        <div className="flex flex-col gap-3">
          <div
            className={[
              "card p-6 text-center",
              myStars === oppStars ? "bg-surface" : myStars > oppStars ? "bg-success-soft" : "bg-danger-soft",
            ].join(" ")}
          >
            <div className="mb-1 animate-stamp text-5xl">{myStars === oppStars ? "🤝" : myStars > oppStars ? "🏆" : "😅"}</div>
            <p className="text-2xl font-extrabold">
              {myStars === oppStars ? "تعادل!" : myStars > oppStars ? "فزت بالمباراة! 🎉" : "فاز خصمك"}
            </p>
            <p className="mt-2 text-lg font-bold">
              ⭐ {myStars} — {oppStars} ⭐
            </p>
            <button onClick={newMatch} className="btn btn-primary mt-5 px-8">
              🔄 مباراة جديدة
            </button>
          </div>
          <MatchResult
            matchKey={`wb:${code}:${game.started_at ?? ""}`}
            winner={myStars > oppStars ? (isA ? "a" : "b") : oppStars > myStars ? (isA ? "b" : "a") : "draw"}
            playerA={game.player_a}
            playerB={game.player_b}
          />
          {Array.from({ length: maxR }).map((_, r) => {
            const mw = myRounds[r] ?? [];
            const ow = oppRounds[r] ?? [];
            const ms = totalScore(mw);
            const os = totalScore(ow);
            return (
              <div key={r} className="card bg-surface p-4">
                <div className="mb-2 flex items-center justify-between text-sm font-bold">
                  <span className="text-ink-soft">الجولة {r + 1}</span>
                  <span>
                    <span className="text-primary-dark">{ms}</span>
                    <span className="text-ink-soft"> — </span>
                    <span className="text-coral">{os}</span>
                    {ms > os ? " 🌟" : os > ms ? " (خصمك 🌟)" : ""}
                  </span>
                </div>
                <BothWords myWords={mw} oppWords={ow} compact />
              </div>
            );
          })}
        </div>
      )}

      {myRole && <Chat code={code} me={me} role={myRole} />}
    </main>
  );
}

/* -------------------------------- Pieces -------------------------------- */

function WordChips({ words, tone }: { words: string[]; tone: "primary" | "coral" }) {
  if (words.length === 0) return <p className="text-sm text-ink-soft">لا شيء</p>;
  const cls = tone === "primary" ? "bg-primary-soft text-primary-dark" : "bg-coral-soft text-coral";
  return (
    <div dir="rtl" className="flex flex-wrap gap-2">
      {words.map((w) => (
        <span key={w} className={["rounded-md border-2 border-ink px-2.5 py-1 text-sm font-bold", cls].join(" ")}>
          {w} <span className="opacity-70">+{wordScore(w)}</span>
        </span>
      ))}
    </div>
  );
}

function BothWords({
  myWords,
  oppWords,
  compact,
}: {
  myWords: string[];
  oppWords: string[];
  compact?: boolean;
}) {
  return (
    <div className={compact ? "flex flex-col gap-2" : "card flex flex-col gap-3 bg-surface p-4"}>
      <div>
        <div className="mb-1 text-xs text-ink-soft">كلماتك ({myWords.length})</div>
        <WordChips words={myWords} tone="primary" />
      </div>
      <div>
        <div className="mb-1 text-xs text-ink-soft">كلمات خصمك ({oppWords.length})</div>
        <WordChips words={oppWords} tone="coral" />
      </div>
    </div>
  );
}

function Stars({ label, count, total, color }: { label: string; count: number; total: number; color: "primary" | "coral" }) {
  return (
    <div className="text-center">
      <div className="text-[11px] text-ink-soft">{label}</div>
      <div className={["text-sm font-bold", color === "primary" ? "text-primary-dark" : "text-coral"].join(" ")}>
        {"⭐".repeat(count)}
        <span className="text-muted">{"·".repeat(Math.max(0, total - count))}</span>
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
