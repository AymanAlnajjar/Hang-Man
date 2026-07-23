"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { getPlayerId } from "@/lib/player";
import {
  MAX_WRONG,
  type Game,
} from "@/lib/game";
import {
  normalizeArabic,
  firstInvalidChar,
  wordLetterSet,
} from "@/lib/arabic";
import Hangman from "@/components/Hangman";
import WordDisplay from "@/components/WordDisplay";
import Keyboard from "@/components/Keyboard";

type Phase = "loading" | "notfound" | "full" | "ready";

export default function GameRoom() {
  const params = useParams();
  const router = useRouter();
  const code = String(params.code || "").toUpperCase();

  const [me, setMe] = useState("");
  const [game, setGame] = useState<Game | null>(null);
  const [phase, setPhase] = useState<Phase>("loading");
  const [wordInput, setWordInput] = useState("");
  const [wordError, setWordError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [shareUrl, setShareUrl] = useState("");
  const claimedRef = useRef(false);

  // ---- Initial load + slot claim -------------------------------------------
  useEffect(() => {
    const pid = getPlayerId();
    setMe(pid);
    setShareUrl(`${window.location.origin}/game/${code}`);

    let cancelled = false;

    async function init() {
      const { data, error } = await supabase
        .from("games")
        .select("*")
        .eq("id", code)
        .maybeSingle();

      if (cancelled) return;

      if (error || !data) {
        setPhase("notfound");
        return;
      }

      let g = data as Game;

      const isPlayer = g.player_a === pid || g.player_b === pid;
      if (!isPlayer && !claimedRef.current) {
        claimedRef.current = true;
        if (g.player_a && !g.player_b && g.player_a !== pid) {
          // Second player joins. This client (and only this one) decides who
          // sets the word first — randomly — and moves the game to "choosing".
          const chooser = Math.random() < 0.5 ? g.player_a : pid;
          const { data: upd } = await supabase
            .from("games")
            .update({ player_b: pid, chooser, status: "choosing" })
            .eq("id", code)
            .is("player_b", null) // guard against a race with the other tab
            .select()
            .maybeSingle();
          if (upd) g = upd as Game;
          else {
            // Someone else grabbed the seat first — re-fetch the truth.
            const { data: fresh } = await supabase
              .from("games")
              .select("*")
              .eq("id", code)
              .maybeSingle();
            if (fresh) g = fresh as Game;
          }
        } else if (!g.player_a) {
          const { data: upd } = await supabase
            .from("games")
            .update({ player_a: pid })
            .eq("id", code)
            .select()
            .maybeSingle();
          if (upd) g = upd as Game;
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

  // ---- Realtime subscription -----------------------------------------------
  useEffect(() => {
    if (!code) return;
    const channel = supabase
      .channel(`game-${code}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "games",
          filter: `id=eq.${code}`,
        },
        (payload) => setGame(payload.new as Game)
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [code]);

  // ---- Derived state --------------------------------------------------------
  const iAmChooser = !!game && !!me && game.chooser === me;
  const bothPresent = !!game?.player_a && !!game?.player_b;
  const letters = useMemo(
    () => (game?.word ? wordLetterSet(game.word) : new Set<string>()),
    [game?.word]
  );
  const wrongCount = useMemo(() => {
    if (!game?.word) return 0;
    return game.guessed.filter((l) => !letters.has(l)).length;
  }, [game?.guessed, game?.word, letters]);
  const wrongLetters = useMemo(
    () => (game ? game.guessed.filter((l) => !letters.has(l)) : []),
    [game, letters]
  );

  // ---- Actions --------------------------------------------------------------
  const submitWord = useCallback(async () => {
    setWordError(null);
    const w = normalizeArabic(wordInput);
    const lettersOnly = w.replace(/ /g, "");
    if (lettersOnly.length < 2) {
      setWordError("اكتب كلمة من حرفين على الأقل.");
      return;
    }
    if (lettersOnly.length > 24) {
      setWordError("الكلمة طويلة جدًا (٢٤ حرفًا كحد أقصى).");
      return;
    }
    const bad = firstInvalidChar(w);
    if (bad) {
      setWordError(`الحرف «${bad}» غير مدعوم. استخدم حروفًا عربية فقط.`);
      return;
    }
    await supabase
      .from("games")
      .update({ word: w, guessed: [], status: "playing", result: null })
      .eq("id", code);
    setWordInput("");
  }, [wordInput, code]);

  const guess = useCallback(
    async (letter: string) => {
      if (!game || game.status !== "playing" || !game.word) return;
      if (iAmChooser) return; // the chooser only watches
      if (game.guessed.includes(letter)) return;

      const guessed = [...game.guessed, letter];
      const wordSet = wordLetterSet(game.word);
      const wrong = guessed.filter((l) => !wordSet.has(l)).length;
      const allRevealed = [...wordSet].every((l) => guessed.includes(l));

      let status: Game["status"] = "playing";
      let result: Game["result"] = null;
      if (allRevealed) {
        status = "finished";
        result = "won";
      } else if (wrong >= MAX_WRONG) {
        status = "finished";
        result = "lost";
      }

      // Optimistic local update so the guesser sees instant feedback.
      setGame({ ...game, guessed, status, result });
      await supabase
        .from("games")
        .update({ guessed, status, result })
        .eq("id", code);
    },
    [game, iAmChooser, code]
  );

  const playAgain = useCallback(async () => {
    if (!game) return;
    const nextChooser =
      game.chooser === game.player_a ? game.player_b : game.player_a;
    await supabase
      .from("games")
      .update({
        chooser: nextChooser,
        word: null,
        guessed: [],
        status: "choosing",
        result: null,
        round: game.round + 1,
      })
      .eq("id", code);
  }, [game, code]);

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      /* clipboard may be blocked; the code is visible on screen anyway */
    }
  }

  // On phones this opens the native share sheet (WhatsApp, Messages, …).
  // Falls back to copying the link on desktop or if sharing is unavailable.
  async function shareGame() {
    const payload = {
      title: "لعبة المشنقة",
      text: "تعال نلعب المشنقة معًا! 🎯 اضغط الرابط للدخول:",
      url: shareUrl,
    };
    if (typeof navigator !== "undefined" && navigator.share) {
      try {
        await navigator.share(payload);
        return;
      } catch {
        /* user dismissed the share sheet — do nothing */
        return;
      }
    }
    copyLink();
  }

  // ---- Screens --------------------------------------------------------------
  if (phase === "loading") {
    return <Centered>جارٍ التحميل…</Centered>;
  }

  if (phase === "notfound") {
    return (
      <Centered>
        <p className="mb-4 text-lg">لا توجد غرفة بهذا الرمز.</p>
        <button
          onClick={() => router.push("/")}
          className="btn-ghost rounded-2xl px-6 py-3 font-bold"
        >
          العودة للصفحة الرئيسية
        </button>
      </Centered>
    );
  }

  if (phase === "full") {
    return (
      <Centered>
        <p className="mb-4 text-lg">هذه الغرفة ممتلئة (لاعبان بالفعل).</p>
        <button
          onClick={() => router.push("/")}
          className="btn-ghost rounded-2xl px-6 py-3 font-bold"
        >
          إنشاء لعبة جديدة
        </button>
      </Centered>
    );
  }

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
        <div className="text-xs text-white/50">الجولة {game.round}</div>
      </header>

      {/* Waiting for partner */}
      {!bothPresent && (
        <div className="glass rounded-3xl p-6 text-center">
          <div className="mb-3 text-4xl animate-floaty">🔗</div>
          <h2 className="mb-2 text-xl font-bold">بانتظار شريكك…</h2>
          <p className="mb-5 text-sm text-white/60">
            أرسل هذا الرابط لشريكك ليدخل نفس الغرفة.
          </p>
          <button
            onClick={shareGame}
            className="btn-primary mb-3 w-full rounded-2xl py-3.5 text-base font-bold"
          >
            📲 مشاركة الرابط
          </button>
          <div className="mb-3 flex items-center gap-2">
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
          <p className="text-xs text-white/40">
            أو شارك الرمز: <span className="font-bold text-white/70">{code}</span>
          </p>
        </div>
      )}

      {/* Choosing a word */}
      {bothPresent && game.status === "choosing" && (
        <>
          {iAmChooser ? (
            <div className="glass rounded-3xl p-6">
              <div className="mb-1 text-center text-3xl">✍️</div>
              <h2 className="mb-1 text-center text-xl font-bold">دورك لاختيار الكلمة</h2>
              <p className="mb-5 text-center text-sm text-white/60">
                اكتب كلمة عربية، وسيحاول شريكك تخمينها حرفًا حرفًا.
              </p>
              <input
                value={wordInput}
                onChange={(e) => setWordInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && submitWord()}
                placeholder="اكتب الكلمة هنا"
                dir="rtl"
                className="input-field mb-1 w-full rounded-2xl px-4 py-3 text-center text-2xl font-bold text-white placeholder:text-white/30"
                autoFocus
              />
              <p className="mb-4 text-center text-xs text-white/40">
                شريكك لن يرى الكلمة — فقط عدد الحروف.
              </p>
              {wordError && (
                <p className="mb-3 rounded-xl bg-rose-500/15 px-4 py-2 text-center text-sm text-rose-200">
                  {wordError}
                </p>
              )}
              <button
                onClick={submitWord}
                className="btn-primary w-full rounded-2xl py-3 text-lg font-bold"
              >
                ابدأ اللعبة
              </button>
            </div>
          ) : (
            <div className="glass rounded-3xl p-8 text-center">
              <div className="mb-3 text-4xl animate-floaty">⏳</div>
              <h2 className="text-xl font-bold">شريكك يختار كلمة…</h2>
              <p className="mt-2 text-sm text-white/60">استعد للتخمين!</p>
            </div>
          )}
        </>
      )}

      {/* Playing / Finished */}
      {bothPresent &&
        (game.status === "playing" || game.status === "finished") &&
        game.word && (
          <div className="flex flex-col gap-4">
            {/* Role banner */}
            <div className="glass rounded-2xl px-4 py-2 text-center text-sm">
              {iAmChooser ? (
                <span className="text-white/70">
                  👀 أنت المُختار — شريكك يخمّن كلمتك
                </span>
              ) : (
                <span className="text-white/70">🧠 خمّن الكلمة!</span>
              )}
            </div>

            {/* Hangman + lives */}
            <div className="glass rounded-3xl p-5">
              <Hangman wrong={wrongCount} />
              <div className="mt-3 text-center text-sm text-white/60">
                المحاولات المتبقية:{" "}
                <span className="font-bold text-white">
                  {Math.max(0, MAX_WRONG - wrongCount)}
                </span>{" "}
                / {MAX_WRONG}
              </div>
              {wrongLetters.length > 0 && (
                <div className="mt-2 text-center text-sm text-rose-300" dir="rtl">
                  حروف خاطئة: {wrongLetters.join(" · ")}
                </div>
              )}
            </div>

            {/* The word */}
            <div className="glass rounded-3xl p-5">
              <WordDisplay
                word={game.word}
                guessed={game.guessed}
                // Chooser always sees the word; guesser only on game over.
                reveal={iAmChooser || game.status === "finished"}
              />
            </div>

            {/* Result banner */}
            {game.status === "finished" && (
              <div
                className={[
                  "rounded-3xl p-5 text-center",
                  game.result === "won"
                    ? "bg-emerald-500/15 text-emerald-200"
                    : "bg-rose-500/15 text-rose-200",
                ].join(" ")}
              >
                <div className="mb-1 text-4xl">
                  {game.result === "won" ? "🎉" : "💔"}
                </div>
                <p className="text-lg font-bold">
                  {game.result === "won"
                    ? iAmChooser
                      ? "خمّن شريكك الكلمة!"
                      : "أحسنت! خمّنت الكلمة"
                    : iAmChooser
                    ? "لم يخمّن شريكك الكلمة"
                    : "انتهت المحاولات!"}
                </p>
                <p className="mt-1 text-sm opacity-80" dir="rtl">
                  الكلمة كانت: <span className="font-bold">{game.word}</span>
                </p>
                <button
                  onClick={playAgain}
                  className="btn-primary mt-4 rounded-2xl px-6 py-3 font-bold"
                >
                  🔄 جولة جديدة (تبديل الأدوار)
                </button>
              </div>
            )}

            {/* Keyboard (guesser only, while playing) */}
            {game.status === "playing" && !iAmChooser && (
              <div className="glass rounded-3xl p-4">
                <Keyboard
                  guessed={game.guessed}
                  wordLetters={letters}
                  onGuess={guess}
                  disabled={false}
                />
              </div>
            )}

            {game.status === "playing" && iAmChooser && (
              <p className="text-center text-sm text-white/50">
                انتظر بينما يخمّن شريكك…
              </p>
            )}
          </div>
        )}
    </main>
  );
}

function Centered({ children }: { children: React.ReactNode }) {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center px-6 text-center text-white/80">
      {children}
    </main>
  );
}
