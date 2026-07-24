"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { getPlayerId } from "@/lib/player";
import { normalizeArabic } from "@/lib/arabic";
import Chat from "@/components/Chat";

// A lenient canonical key for matching two words in Mind Meld: on top of the
// usual normalization it drops spaces, treats ة/ه the same, and ignores a
// leading definite article — so "قلب" and "القلب", "قطة" and "قطه" all match.
function meldKey(word: string): string {
  let w = normalizeArabic(word)
    .replace(/\s+/g, "")
    .replace(/ة/g, "ه");
  if (w.startsWith("ال") && w.length > 3) w = w.slice(2);
  return w;
}

type MeldEntry = { round: number; a: string; b: string };
type MeldGame = {
  id: string;
  player_a: string | null;
  player_b: string | null;
  status: "waiting" | "playing";
  round: number;
  word_a: string | null;
  word_b: string | null;
  history: MeldEntry[];
};

type Phase = "loading" | "notfound" | "full" | "ready";

export default function MeldRoom() {
  const params = useParams();
  const router = useRouter();
  const code = String(params.code || "").toUpperCase();

  const [me, setMe] = useState("");
  const [game, setGame] = useState<MeldGame | null>(null);
  const [phase, setPhase] = useState<Phase>("loading");
  const [input, setInput] = useState("");
  const [shareUrl, setShareUrl] = useState("");
  const [copied, setCopied] = useState(false);
  const claimedRef = useRef(false);
  const advancingRef = useRef(false);

  useEffect(() => {
    const pid = getPlayerId();
    setMe(pid);
    setShareUrl(`${window.location.origin}/meld/${code}`);
    let cancelled = false;

    async function init() {
      const { data, error } = await supabase
        .from("meld_games")
        .select("*")
        .eq("id", code)
        .maybeSingle();
      if (cancelled) return;
      if (error || !data) {
        setPhase("notfound");
        return;
      }
      let g = data as MeldGame;

      const isPlayer = g.player_a === pid || g.player_b === pid;
      if (!isPlayer && !claimedRef.current) {
        claimedRef.current = true;
        if (g.player_a && !g.player_b && g.player_a !== pid) {
          const { data: upd } = await supabase
            .from("meld_games")
            .update({ player_b: pid, status: "playing" })
            .eq("id", code)
            .is("player_b", null)
            .select()
            .maybeSingle();
          if (upd) g = upd as MeldGame;
          else {
            const { data: fresh } = await supabase
              .from("meld_games")
              .select("*")
              .eq("id", code)
              .maybeSingle();
            if (fresh) g = fresh as MeldGame;
          }
        } else if (!g.player_a) {
          const { data: upd } = await supabase
            .from("meld_games")
            .update({ player_a: pid })
            .eq("id", code)
            .select()
            .maybeSingle();
          if (upd) g = upd as MeldGame;
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
      .channel(`meld-${code}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "meld_games", filter: `id=eq.${code}` },
        (payload) => setGame(payload.new as MeldGame)
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

  const myWord = (isA ? game?.word_a : game?.word_b) ?? null;
  const oppWord = (isA ? game?.word_b : game?.word_a) ?? null;
  const iSubmitted = !!myWord;
  const bothSubmitted = !!game?.word_a && !!game?.word_b;
  const matched =
    bothSubmitted && meldKey(game!.word_a!) === meldKey(game!.word_b!);

  // ---- Actions -------------------------------------------------------------
  const submitWord = useCallback(async () => {
    if (!game || iSubmitted) return;
    const w = input.trim();
    if (!w) return;
    const patch = isA ? { word_a: w } : { word_b: w };
    setGame({ ...game, ...patch });
    setInput("");
    await supabase.from("meld_games").update(patch).eq("id", code);
  }, [game, iSubmitted, input, isA, code]);

  const nextRound = useCallback(async () => {
    if (!game || !bothSubmitted || matched || advancingRef.current) return;
    advancingRef.current = true;
    const entry: MeldEntry = {
      round: game.round,
      a: game.word_a ?? "",
      b: game.word_b ?? "",
    };
    await supabase
      .from("meld_games")
      .update({
        history: [...game.history, entry],
        word_a: null,
        word_b: null,
        round: game.round + 1,
      })
      .eq("id", code);
    setInput("");
  }, [game, bothSubmitted, matched, code]);

  // Re-enable the advance guard once a fresh round has cleared the words.
  useEffect(() => {
    if (game && !game.word_a && !game.word_b) advancingRef.current = false;
  }, [game?.word_a, game?.word_b]);

  const changeMyWord = useCallback(async () => {
    if (!game || bothSubmitted) return; // can't change once both are in
    const patch = isA ? { word_a: null } : { word_b: null };
    setGame({ ...game, ...patch });
    await supabase.from("meld_games").update(patch).eq("id", code);
  }, [game, bothSubmitted, isA, code]);

  const newGame = useCallback(async () => {
    if (!game) return;
    advancingRef.current = false;
    setInput("");
    await supabase
      .from("meld_games")
      .update({ history: [], word_a: null, word_b: null, round: 1 })
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
      title: "توارد الأفكار",
      text: "تعال نلعب توارد الأفكار! 🧠 اضغط الرابط:",
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

  return (
    <main className="mx-auto flex min-h-dvh max-w-lg flex-col px-4 pt-safe pb-safe">
      {/* Header */}
      <header className="mb-4 flex items-center justify-between">
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
          <div className="text-xs text-white/50">المحاولة {game.round}</div>
          <div className="text-xs font-bold text-fuchsia-300">🧠 توارد</div>
        </div>
      </header>

      {/* Waiting */}
      {!bothPresent && (
        <div className="glass rounded-3xl p-6 text-center">
          <div className="mb-3 text-4xl animate-floaty">🔗</div>
          <h2 className="mb-2 text-xl font-bold">بانتظار شريكك…</h2>
          <p className="mb-5 text-sm text-white/60">
            أرسل الرابط لشريكك ليدخل نفس الغرفة، وتبدآن اللعب.
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

      {bothPresent && (
        <div className="flex flex-col gap-4">
          {/* ---- WIN ---- */}
          {matched && (
            <div className="rounded-3xl bg-emerald-500/15 p-6 text-center text-emerald-100">
              <div className="mb-1 text-5xl">🎉</div>
              <p className="text-2xl font-extrabold">تطابقتما!</p>
              <p className="mt-2 text-lg" dir="rtl">
                الكلمة المشتركة:{" "}
                <span className="font-bold">{game.word_a}</span>
              </p>
              <p className="mt-1 text-sm opacity-80">
                في المحاولة رقم {game.round} 🧠
              </p>
              <button
                onClick={newGame}
                className="btn-primary mt-5 rounded-2xl px-8 py-3 font-bold"
              >
                🔄 لعبة جديدة
              </button>
            </div>
          )}

          {/* ---- REVEAL (no match) ---- */}
          {!matched && bothSubmitted && (
            <div className="glass rounded-3xl p-5 text-center">
              <p className="mb-3 text-sm text-white/60">لم تتطابقا… بعد!</p>
              <div className="mb-4 flex items-stretch justify-center gap-3">
                <RevealCard label="أنت" word={isA ? game.word_a : game.word_b} tone="emerald" />
                <div className="flex items-center text-2xl text-white/30">↔</div>
                <RevealCard label="شريكك" word={isA ? game.word_b : game.word_a} tone="rose" />
              </div>
              <p className="mb-4 text-sm text-white/70">
                اكتبا الآن كلمة <span className="font-bold">تجمع بين الكلمتين</span> —
                وحاولا الوصول إلى الكلمة نفسها!
              </p>
              <button
                onClick={nextRound}
                className="btn-primary w-full rounded-2xl py-3 font-bold"
              >
                المحاولة التالية ▶
              </button>
            </div>
          )}

          {/* ---- INPUT / WAITING ---- */}
          {!matched && !bothSubmitted && (
            <div className="glass rounded-3xl p-6 text-center">
              {!iSubmitted ? (
                <>
                  <div className="mb-1 text-3xl">✍️</div>
                  <h2 className="mb-1 text-xl font-bold">
                    {game.round === 1 ? "اكتب أي كلمة" : "اكتب كلمة تقارب الكلمتين"}
                  </h2>
                  <p className="mb-4 text-sm text-white/60">
                    {game.round === 1
                      ? "أول كلمة تخطر ببالك — لن يراها شريكك حتى ترسلا معًا."
                      : "فكّر في كلمة وسط بين كلمتيكما السابقتين."}
                  </p>
                  <input
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && submitWord()}
                    placeholder="اكتب كلمتك هنا"
                    dir="rtl"
                    enterKeyHint="send"
                    autoFocus
                    className="input-field mb-3 w-full rounded-2xl px-4 py-3 text-center text-2xl font-bold text-white placeholder:text-white/30"
                  />
                  <button
                    onClick={submitWord}
                    disabled={!input.trim()}
                    className="btn-primary w-full rounded-2xl py-3 text-lg font-bold disabled:opacity-40"
                  >
                    إرسال
                  </button>
                </>
              ) : (
                <>
                  <div className="mb-2 text-4xl animate-floaty">⏳</div>
                  <h2 className="text-xl font-bold">أرسلت كلمتك ✓</h2>
                  <p className="mt-2 text-sm text-white/60">
                    بانتظار شريكك ليرسل كلمته…
                  </p>
                  <p className="mt-3 text-xs text-white/40">
                    (كلمتك محفوظة — ستُكشفان معًا)
                  </p>
                  <button
                    onClick={changeMyWord}
                    className="btn-ghost mt-4 rounded-2xl px-5 py-2 text-sm font-bold"
                  >
                    ✎ تغيير كلمتي
                  </button>
                </>
              )}
            </div>
          )}

          {/* ---- History of attempts ---- */}
          {game.history.length > 0 && (
            <div className="glass rounded-3xl p-4">
              <div className="mb-2 text-sm text-white/60">
                المحاولات السابقة ({game.history.length})
              </div>
              <div className="flex flex-col gap-2">
                {game.history
                  .slice()
                  .reverse()
                  .map((h) => (
                    <div
                      key={h.round}
                      className="flex items-center justify-between rounded-xl bg-white/5 px-3 py-2 text-sm"
                    >
                      <span className="text-white/40">#{h.round}</span>
                      <span dir="rtl" className="flex items-center gap-2 font-bold">
                        <span className="text-emerald-200">{isA ? h.a : h.b}</span>
                        <span className="text-white/30">↔</span>
                        <span className="text-rose-200">{isA ? h.b : h.a}</span>
                      </span>
                    </div>
                  ))}
              </div>
            </div>
          )}
        </div>
      )}

      {myRole && <Chat code={code} me={me} role={myRole} />}
    </main>
  );
}

function RevealCard({
  label,
  word,
  tone,
}: {
  label: string;
  word: string | null;
  tone: "emerald" | "rose";
}) {
  return (
    <div
      className={[
        "flex min-w-[110px] flex-col items-center justify-center rounded-2xl px-4 py-3",
        tone === "emerald" ? "bg-emerald-500/15" : "bg-rose-500/15",
      ].join(" ")}
    >
      <div className="text-xs text-white/50">{label}</div>
      <div
        dir="rtl"
        className={[
          "mt-1 text-xl font-extrabold",
          tone === "emerald" ? "text-emerald-200" : "text-rose-200",
        ].join(" ")}
      >
        {word}
      </div>
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
