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
import { normalizeArabic } from "@/lib/arabic";
import {
  CELLS,
  GRID_SIZE,
  MIN_WORD,
  ROUND_DURATION,
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

type BoxesGame = {
  id: string;
  player_a: string | null;
  player_b: string | null;
  status: "waiting" | "playing" | "roundover" | "finished";
  grid: string | null;
  duration: number;
  started_at: string | null;
  found_a: string[];
  found_b: string[];
  score_a: number;
  score_b: number;
  round: number;
  max_rounds: number;
};

type Phase = "loading" | "notfound" | "full" | "ready";

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
  const roundEndedRef = useRef(false);
  const advancingRef = useRef(false);

  // ---- Load + claim --------------------------------------------------------
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

      // Make sure the full word list is loaded before we generate a grid or
      // validate words — so both players judge words by the same dictionary.
      await loadFullDictionary();
      if (cancelled) return;

      const isPlayer = g.player_a === pid || g.player_b === pid;
      if (!isPlayer && !claimedRef.current) {
        claimedRef.current = true;
        if (g.player_a && !g.player_b && g.player_a !== pid) {
          const { data: upd } = await supabase
            .from("boxes_games")
            .update({
              player_b: pid,
              status: "playing",
              grid: JSON.stringify(generateGrid()),
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
    const t = setInterval(() => setNow(Date.now()), 300);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    const onResize = () => {
      if (wrapRef.current) setBoardW(Math.min(wrapRef.current.clientWidth, 400));
    };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  // ---- Derived -------------------------------------------------------------
  const isA = !!game && me === game.player_a;
  const isB = !!game && me === game.player_b;
  const myRole: "a" | "b" | null = isA ? "a" : isB ? "b" : null;
  const bothPresent = !!game?.player_a && !!game?.player_b;

  const grid: string[] | null = useMemo(() => {
    if (!game?.grid) return null;
    try {
      return JSON.parse(game.grid) as string[];
    } catch {
      return null;
    }
  }, [game?.grid]);

  const myFound = (isA ? game?.found_a : game?.found_b) ?? [];
  const oppFound = (isA ? game?.found_b : game?.found_a) ?? [];
  const cumMine = (isA ? game?.score_a : game?.score_b) ?? 0;
  const cumOpp = (isA ? game?.score_b : game?.score_a) ?? 0;

  const endTime =
    game?.started_at != null
      ? new Date(game.started_at).getTime() + (game.duration ?? ROUND_DURATION) * 1000
      : null;
  const remainingMs = endTime ? Math.max(0, endTime - now) : (game?.duration ?? ROUND_DURATION) * 1000;
  const remainingSec = Math.ceil(remainingMs / 1000);
  const timeUp = endTime != null && now >= endTime;

  const status = game?.status;
  const roundOver = status === "roundover" || (status === "playing" && timeUp);
  const finished = status === "finished";
  const active = status === "playing" && !timeUp;

  // Persist round end once the clock runs out.
  useEffect(() => {
    if (!game || roundEndedRef.current) return;
    if (game.status === "playing" && timeUp && (isA || isB)) {
      roundEndedRef.current = true;
      supabase.from("boxes_games").update({ status: "roundover" }).eq("id", code);
    }
  }, [game, timeUp, isA, isB, code]);

  // Measure the board when it appears (and once per active round).
  useEffect(() => {
    if (active && wrapRef.current) {
      setBoardW(Math.min(wrapRef.current.clientWidth, 400));
    }
  }, [active]);

  // Re-enable the advance button only once a fresh round is actually playing.
  useEffect(() => {
    if (game?.status === "playing") advancingRef.current = false;
  }, [game?.status]);

  // ---- Board geometry ------------------------------------------------------
  const gap = boardW * 0.04;
  const cell = (boardW - gap * (GRID_SIZE - 1)) / GRID_SIZE;
  const step = cell + gap;
  const center = (i: number) => {
    const { r, c } = rc(i);
    return { x: c * step + cell / 2, y: r * step + cell / 2 };
  };

  // Keep a ref in sync so the pointer-up handler reads the final path reliably.
  useEffect(() => {
    selectionRef.current = selection;
  }, [selection]);

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
      if (!game || !grid || !active || path.length < MIN_WORD) return;
      const res = checkPath(grid, path, myFound);
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
      const next = [...myFound, word];
      setFlash({ msg: `✓ ${word} +${wordScore(word)}`, ok: true });
      setGame({ ...game, ...(isA ? { found_a: next } : { found_b: next }) });
      await supabase
        .from("boxes_games")
        .update(isA ? { found_a: next } : { found_b: next })
        .eq("id", code);
    },
    [game, grid, active, myFound, isA, code]
  );

  const onPointerDown = (e: ReactPointerEvent) => {
    if (!active) return;
    const i = tileAtPointer(e);
    if (i == null) return;
    e.currentTarget.setPointerCapture?.(e.pointerId);
    setDragging(true);
    setSelection([i]);
  };

  const onPointerMove = (e: ReactPointerEvent) => {
    if (!dragging || !active) return;
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

  useEffect(() => {
    if (!flash) return;
    const t = setTimeout(() => setFlash(null), 1300);
    return () => clearTimeout(t);
  }, [flash]);

  // Move from a finished round to the next round (or to the final result).
  const advance = useCallback(async () => {
    if (!game || game.status !== "roundover" || advancingRef.current) return;
    advancingRef.current = true;
    roundEndedRef.current = false;
    const newA = game.score_a + totalScore(game.found_a);
    const newB = game.score_b + totalScore(game.found_b);
    setSelection([]);
    if (game.round < game.max_rounds) {
      await supabase
        .from("boxes_games")
        .update({
          score_a: newA,
          score_b: newB,
          round: game.round + 1,
          grid: JSON.stringify(generateGrid()),
          started_at: new Date().toISOString(),
          found_a: [],
          found_b: [],
          status: "playing",
        })
        .eq("id", code);
    } else {
      await supabase
        .from("boxes_games")
        .update({ score_a: newA, score_b: newB, status: "finished" })
        .eq("id", code);
    }
  }, [game, code]);

  // Fresh match from the final screen.
  const newMatch = useCallback(async () => {
    if (!game || advancingRef.current) return;
    advancingRef.current = true;
    roundEndedRef.current = false;
    setSelection([]);
    await supabase
      .from("boxes_games")
      .update({
        status: "playing",
        round: 1,
        score_a: 0,
        score_b: 0,
        grid: JSON.stringify(generateGrid()),
        started_at: new Date().toISOString(),
        found_a: [],
        found_b: [],
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

  const currentWord = grid ? selection.map((i) => grid[i]).join("") : "";
  const roundMine = totalScore(myFound);
  const roundOpp = totalScore(oppFound);
  // Once finished, the cumulative scores already include the last round; while a
  // round is still open/ending, add the in-progress round points as a preview.
  const finalMine = finished ? cumMine : cumMine + roundMine;
  const finalOpp = finished ? cumOpp : cumOpp + roundOpp;
  const iLead = finalMine > finalOpp;
  const tie = finalMine === finalOpp;
  const timePct = Math.max(0, Math.min(100, (remainingMs / ((game.duration || ROUND_DURATION) * 1000)) * 100));

  return (
    <main className="mx-auto flex min-h-dvh max-w-lg flex-col px-4 pt-safe pb-safe">
      {/* Header: two players + cumulative scores */}
      <header className="mb-2 flex items-center justify-between">
        <button
          onClick={() => router.push("/")}
          className="text-white/50 hover:text-white"
          aria-label="خروج"
        >
          ✕
        </button>
        <div className="flex items-center gap-4">
          <PlayerPill label="أنت" score={finalMine} color="emerald" />
          <span className="text-xs text-white/40">مقابل</span>
          <PlayerPill label="خصمك" score={finalOpp} color="rose" />
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
            أرسل الرابط لشريكك ليدخل نفس الغرفة، وتبدأ المنافسة على نفس الشبكة.
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

      {/* Round header + timer */}
      {bothPresent && !finished && (
        <div className="mb-2 mt-1">
          <div className="mb-1 flex items-center justify-between text-sm">
            <span className="font-bold text-white/80">
              الجولة {game.round}/{game.max_rounds}
            </span>
            <span
              className={[
                "font-extrabold tabular-nums",
                remainingSec <= 15 && active ? "text-rose-400" : "text-white",
              ].join(" ")}
            >
              {roundOver ? "انتهى الوقت" : `${remainingSec}ث`}
            </span>
          </div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-white/10">
            <div
              className="h-full rounded-full bg-gradient-to-l from-fuchsia-500 to-violet-500 transition-[width] duration-300"
              style={{ width: `${timePct}%` }}
            />
          </div>
        </div>
      )}

      {/* The board */}
      {bothPresent && grid && active && (
        <div ref={wrapRef} className="mt-2 flex justify-center">
          <div
            ref={boardRef}
            className="relative touch-none select-none"
            style={{ width: boardW, height: boardW }}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerUp}
          >
            {/* connectors */}
            <svg
              className="pointer-events-none absolute inset-0"
              width={boardW}
              height={boardW}
            >
              {selection.length > 1 && (
                <polyline
                  points={selection.map((i) => {
                    const p = center(i);
                    return `${p.x},${p.y}`;
                  }).join(" ")}
                  fill="none"
                  stroke="#2dd4bf"
                  strokeWidth={Math.max(4, cell * 0.12)}
                  strokeLinejoin="round"
                  strokeLinecap="round"
                  opacity={0.9}
                />
              )}
              {selection.map((i) => {
                const p = center(i);
                return (
                  <circle key={i} cx={p.x} cy={p.y} r={cell * 0.12} fill="#2dd4bf" />
                );
              })}
            </svg>

            {/* tiles (visual only — the board handles pointer tracing) */}
            {grid.map((ch, i) => {
              const p = center(i);
              const sel = selection.includes(i);
              const isLast = selection[selection.length - 1] === i;
              return (
                <div
                  key={i}
                  className="absolute grid place-items-center rounded-full font-bold shadow-md transition-colors"
                  style={{
                    width: cell,
                    height: cell,
                    left: p.x,
                    top: p.y,
                    transform: `translate(-50%, -50%)${sel ? " scale(1.06)" : ""}`,
                    fontSize: cell * 0.42,
                    background: sel ? "#14b8a6" : "#f8fafc",
                    color: sel ? "#ffffff" : "#1e1b2e",
                    zIndex: sel ? 2 : 1,
                    pointerEvents: "none",
                    outline: isLast && sel ? "3px solid #99f6e4" : "none",
                  }}
                >
                  {ch}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Current word (updates live as you swipe) */}
      {bothPresent && active && (
        <div className="mt-3">
          <div
            dir="rtl"
            className={[
              "mb-1 flex min-h-14 items-center justify-center rounded-2xl px-3 text-3xl font-bold transition-colors",
              dragging ? "bg-teal-500/20 text-teal-100" : "bg-black/25",
            ].join(" ")}
          >
            {currentWord || (
              <span className="text-sm font-normal text-white/30">
                مرّر إصبعك على الحروف المتجاورة، وارفعه للتأكيد ({MIN_WORD}+)
              </span>
            )}
          </div>
          <div className="h-5 text-center text-sm">
            {flash && (
              <span className={flash.ok ? "text-emerald-300" : "text-rose-300"}>
                {flash.msg}
              </span>
            )}
          </div>
          <div className="mt-1 text-center text-xs text-white/50">
            كلماتك هذه الجولة: {myFound.length} ({roundMine} نقطة) · خصمك:{" "}
            {oppFound.length} ({roundOpp})
          </div>
        </div>
      )}

      {/* Round-over interstitial */}
      {bothPresent && roundOver && !finished && (
        <div className="mt-4 flex flex-col gap-3">
          <div className="glass rounded-3xl p-5 text-center">
            <div className="mb-1 text-3xl">⏱</div>
            <h2 className="text-xl font-bold">انتهت الجولة {game.round}</h2>
            <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
              <div className="rounded-xl bg-emerald-500/15 p-3">
                <div className="text-white/60">أنت</div>
                <div className="text-lg font-bold text-emerald-200">
                  +{roundMine}
                </div>
                <div className="text-white/50">المجموع {finalMine}</div>
              </div>
              <div className="rounded-xl bg-rose-500/15 p-3">
                <div className="text-white/60">خصمك</div>
                <div className="text-lg font-bold text-rose-200">+{roundOpp}</div>
                <div className="text-white/50">المجموع {finalOpp}</div>
              </div>
            </div>
            <button
              onClick={advance}
              className="btn-primary mt-4 w-full rounded-2xl py-3 font-bold"
            >
              {game.round < game.max_rounds ? "الجولة التالية ▶" : "النتيجة النهائية 🏁"}
            </button>
          </div>
          {grid && <MissedWords grid={grid} myFound={myFound} />}
        </div>
      )}

      {/* Final result */}
      {bothPresent && finished && (
        <div className="mt-6 flex flex-col gap-3">
          <div
            className={[
              "rounded-3xl p-6 text-center",
              tie
                ? "bg-white/10 text-white"
                : iLead
                ? "bg-emerald-500/15 text-emerald-200"
                : "bg-rose-500/15 text-rose-200",
            ].join(" ")}
          >
            <div className="mb-1 text-5xl">{tie ? "🤝" : iLead ? "🏆" : "😅"}</div>
            <p className="text-2xl font-extrabold">
              {tie ? "تعادل!" : iLead ? "فزت! 🎉" : "فاز خصمك"}
            </p>
            <p className="mt-2 text-lg font-bold">
              أنت {finalMine} — خصمك {finalOpp}
            </p>
            <button
              onClick={newMatch}
              className="btn-primary mt-5 rounded-2xl px-8 py-3 font-bold"
            >
              🔄 مباراة جديدة
            </button>
          </div>
        </div>
      )}

      {myRole && <Chat code={code} me={me} role={myRole} />}
    </main>
  );
}

/* -------------------------------- Pieces -------------------------------- */

function PlayerPill({
  label,
  score,
  color,
}: {
  label: string;
  score: number;
  color: "emerald" | "rose";
}) {
  return (
    <div className="text-center">
      <div className="text-[11px] text-white/50">{label}</div>
      <div
        className={[
          "text-lg font-extrabold tabular-nums",
          color === "emerald" ? "text-emerald-300" : "text-rose-300",
        ].join(" ")}
      >
        {score}
      </div>
    </div>
  );
}

// At round end, show which planted words you missed (a gentle hint of what was
// possible). We only reveal your own found words vs. the words hidden in the grid.
function MissedWords({
  grid,
  myFound,
}: {
  grid: string[];
  myFound: string[];
}) {
  return (
    <div className="glass rounded-3xl p-4">
      <div className="mb-2 text-sm text-white/60">كلماتك ({myFound.length})</div>
      {myFound.length === 0 ? (
        <p className="text-sm text-white/30">لم تجد أي كلمة هذه الجولة.</p>
      ) : (
        <div dir="rtl" className="flex flex-wrap gap-2">
          {myFound.map((w) => (
            <span
              key={w}
              className="rounded-lg bg-emerald-500/15 px-2.5 py-1 text-sm font-bold text-emerald-200"
            >
              {w} <span className="text-emerald-300/70">+{wordScore(w)}</span>
            </span>
          ))}
        </div>
      )}
    </div>
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
