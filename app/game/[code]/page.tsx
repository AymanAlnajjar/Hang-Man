"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { getPlayerId } from "@/lib/player";
import {
  MAX_WRONG,
  countWrong,
  isDone,
  isSolved,
  versusWinner,
  type Game,
} from "@/lib/game";
import {
  normalizeArabic,
  firstInvalidChar,
  wordLetterSet,
} from "@/lib/arabic";
import { CATEGORIES, randomWord, type Category } from "@/lib/words";
import Hangman from "@/components/Hangman";
import WordDisplay from "@/components/WordDisplay";
import Keyboard from "@/components/Keyboard";
import Chat from "@/components/Chat";

type Phase = "loading" | "notfound" | "full" | "ready";

function validateWord(raw: string): { word?: string; error?: string } {
  const w = normalizeArabic(raw);
  const lettersOnly = w.replace(/ /g, "");
  if (lettersOnly.length < 2) return { error: "اكتب كلمة من حرفين على الأقل." };
  if (lettersOnly.length > 24)
    return { error: "الكلمة طويلة جدًا (٢٤ حرفًا كحد أقصى)." };
  const bad = firstInvalidChar(w);
  if (bad) return { error: `الحرف «${bad}» غير مدعوم. استخدم حروفًا عربية فقط.` };
  return { word: w };
}

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
          // Second player joins → move the game to "choosing".
          // In co-op mode we also randomly pick who sets the word first.
          const patch: Partial<Game> = { player_b: pid, status: "choosing" };
          if (g.mode === "coop") {
            patch.chooser = Math.random() < 0.5 ? g.player_a : pid;
          }
          const { data: upd } = await supabase
            .from("games")
            .update(patch)
            .eq("id", code)
            .is("player_b", null) // guard against a race with the other tab
            .select()
            .maybeSingle();
          if (upd) g = upd as Game;
          else {
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
        { event: "UPDATE", schema: "public", table: "games", filter: `id=eq.${code}` },
        (payload) => setGame(payload.new as Game)
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [code]);

  // ---- Roles ---------------------------------------------------------------
  const isA = !!game && me === game.player_a;
  const isB = !!game && me === game.player_b;
  const myRole: "a" | "b" | null = isA ? "a" : isB ? "b" : null;
  const bothPresent = !!game?.player_a && !!game?.player_b;
  const isVersus = game?.mode === "versus";
  const isTogether = game?.mode === "together";

  // ---- Co-op derived state -------------------------------------------------
  const iAmChooser = !!game && !!me && game.chooser === me;
  const coopLetters = useMemo(
    () => (game?.word ? wordLetterSet(game.word) : new Set<string>()),
    [game?.word]
  );
  const coopWrongCount = game?.word ? countWrong(game.word, game.guessed) : 0;
  const coopWrongLetters = game?.word
    ? game.guessed.filter((l) => !coopLetters.has(l))
    : [];

  // ---- Versus derived state ------------------------------------------------
  // The word *I* must guess (my opponent chose it), and my own guesses.
  const myWord = isA ? game?.word_for_a : game?.word_for_b;
  const myGuessed = (isA ? game?.guessed_a : game?.guessed_b) ?? [];
  // The word I chose *for* my opponent (I know it, so I can watch their board).
  const oppWord = isA ? game?.word_for_b : game?.word_for_a;
  const oppGuessed = (isA ? game?.guessed_b : game?.guessed_a) ?? [];
  const iChoseWord = !!(isA ? game?.word_for_b : game?.word_for_a);
  const bothChosen = !!game?.word_for_a && !!game?.word_for_b;
  const myDone = !!(isA ? game?.a_done : game?.b_done);
  const oppDone = !!(isA ? game?.b_done : game?.a_done);
  const versusOver = !!game?.a_done && !!game?.b_done;
  const myLetters = useMemo(
    () => (myWord ? wordLetterSet(myWord) : new Set<string>()),
    [myWord]
  );
  const myWrongCount = myWord ? countWrong(myWord, myGuessed) : 0;
  const myWrongLetters = myWord
    ? myGuessed.filter((l) => !myLetters.has(l))
    : [];

  // ---- Actions: co-op ------------------------------------------------------
  const submitWord = useCallback(async () => {
    setWordError(null);
    const { word, error } = validateWord(wordInput);
    if (error || !word) return setWordError(error ?? "كلمة غير صالحة.");
    await supabase
      .from("games")
      .update({ word, guessed: [], status: "playing", result: null })
      .eq("id", code);
    setWordInput("");
  }, [wordInput, code]);

  const guess = useCallback(
    async (letter: string) => {
      if (!game || game.status !== "playing" || !game.word) return;
      if (iAmChooser || game.guessed.includes(letter)) return;

      const guessed = [...game.guessed, letter];
      const solved = isSolved(game.word, guessed);
      const dead = countWrong(game.word, guessed) >= MAX_WRONG;

      let status: Game["status"] = "playing";
      let result: Game["result"] = null;
      if (solved) {
        status = "finished";
        result = "won";
      } else if (dead) {
        status = "finished";
        result = "lost";
      }
      setGame({ ...game, guessed, status, result }); // optimistic
      await supabase
        .from("games")
        .update({ guessed, status, result })
        .eq("id", code);
    },
    [game, iAmChooser, code]
  );

  const playAgainCoop = useCallback(async () => {
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

  // ---- Actions: together (team vs a random word from a category) -----------
  const selectCategory = useCallback(
    async (cat: Category) => {
      const word = normalizeArabic(randomWord(cat));
      await supabase
        .from("games")
        .update({
          word,
          category: cat.name,
          guessed: [],
          status: "playing",
          result: null,
        })
        .eq("id", code);
    },
    [code]
  );

  const playAgainTogether = useCallback(async () => {
    if (!game) return;
    await supabase
      .from("games")
      .update({
        word: null,
        category: null,
        guessed: [],
        status: "choosing",
        result: null,
        round: game.round + 1,
      })
      .eq("id", code);
  }, [game, code]);

  // ---- Actions: versus -----------------------------------------------------
  const submitVersusWord = useCallback(async () => {
    setWordError(null);
    if (!game) return;
    const { word, error } = validateWord(wordInput);
    if (error || !word) return setWordError(error ?? "كلمة غير صالحة.");
    // I choose the word my OPPONENT will guess.
    const patch: Partial<Game> = isA
      ? { word_for_b: word }
      : { word_for_a: word };
    // Once both words are in, flip to playing.
    const otherChosen = isA ? game.word_for_a : game.word_for_b;
    if (otherChosen) patch.status = "playing";
    setGame({ ...game, ...patch }); // optimistic
    await supabase.from("games").update(patch).eq("id", code);
    setWordInput("");
  }, [wordInput, code, game, isA]);

  const guessVersus = useCallback(
    async (letter: string) => {
      if (!game || !myWord || myDone) return;
      if (myGuessed.includes(letter)) return;

      const guessed = [...myGuessed, letter];
      const done = isDone(myWord, guessed);
      const patch: Partial<Game> = isA
        ? { guessed_a: guessed, a_done: done }
        : { guessed_b: guessed, b_done: done };
      const otherDone = isA ? game.b_done : game.a_done;
      if (done && otherDone) patch.status = "finished";

      setGame({ ...game, ...patch }); // optimistic
      await supabase.from("games").update(patch).eq("id", code);
    },
    [game, myWord, myGuessed, myDone, isA, code]
  );

  const playAgainVersus = useCallback(async () => {
    if (!game) return;
    await supabase
      .from("games")
      .update({
        word_for_a: null,
        word_for_b: null,
        guessed_a: [],
        guessed_b: [],
        a_done: false,
        b_done: false,
        status: "choosing",
        round: game.round + 1,
      })
      .eq("id", code);
  }, [game, code]);

  // ---- Sharing -------------------------------------------------------------
  async function copyLink() {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      /* clipboard may be blocked; the code is visible on screen anyway */
    }
  }

  async function shareGame() {
    const payload = {
      title: "لعبة المشنقة",
      text: "تعال نلعب المشنقة معًا! 🎯 اضغط الرابط للدخول:",
      url: shareUrl,
    };
    if (typeof navigator !== "undefined" && navigator.share) {
      try {
        await navigator.share(payload);
      } catch {
        /* user dismissed the share sheet */
      }
      return;
    }
    copyLink();
  }

  // ---- Screens: pre-game ---------------------------------------------------
  if (phase === "loading") return <Centered>جارٍ التحميل…</Centered>;

  if (phase === "notfound") {
    return (
      <Centered>
        <p className="mb-4 text-lg">لا توجد غرفة بهذا الرمز.</p>
        <HomeButton router={router} label="العودة للصفحة الرئيسية" />
      </Centered>
    );
  }

  if (phase === "full") {
    return (
      <Centered>
        <p className="mb-4 text-lg">هذه الغرفة ممتلئة (لاعبان بالفعل).</p>
        <HomeButton router={router} label="إنشاء لعبة جديدة" />
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
        <div className="text-left">
          <div className="text-xs text-white/50">الجولة {game.round}</div>
          <div className="text-xs font-bold text-fuchsia-300">
            {isVersus ? "⚔️ تنافسي" : "🤝 تعاوني"}
          </div>
        </div>
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

      {/* ============ CO-OP / TOGETHER: choosing ============ */}
      {bothPresent && isTogether && game.status === "choosing" && (
        <CategoryPicker onPick={selectCategory} />
      )}

      {bothPresent && !isVersus && !isTogether && game.status === "choosing" && (
        <>
          {iAmChooser ? (
            <WordPicker
              title="دورك لاختيار الكلمة"
              hint="اكتب كلمة عربية، وسيحاول شريكك تخمينها حرفًا حرفًا."
              value={wordInput}
              onChange={setWordInput}
              onSubmit={submitWord}
              error={wordError}
              cta="ابدأ اللعبة"
            />
          ) : (
            <WaitingCard title="شريكك يختار كلمة…" sub="استعد للتخمين!" />
          )}
        </>
      )}

      {bothPresent &&
        !isVersus &&
        (game.status === "playing" || game.status === "finished") &&
        game.word && (
          <div className="flex flex-col gap-4">
            <div className="glass rounded-2xl px-4 py-2 text-center text-sm text-white/70">
              {isTogether
                ? `🤝 خمّنا الكلمة معًا${game.category ? ` — ${game.category}` : ""}`
                : iAmChooser
                ? "👀 شريكك يخمّن كلمتك"
                : "🧠 خمّن الكلمة!"}
            </div>

            <div className="glass rounded-3xl p-5">
              <Hangman wrong={coopWrongCount} />
              <LivesRow wrong={coopWrongCount} wrongLetters={coopWrongLetters} />
            </div>

            <div className="glass rounded-3xl p-5">
              <WordDisplay
                word={game.word}
                guessed={game.guessed}
                reveal={(!isTogether && iAmChooser) || game.status === "finished"}
              />
            </div>

            {game.status === "finished" &&
              (isTogether ? (
                <ResultBanner
                  won={game.result === "won"}
                  title={
                    game.result === "won"
                      ? "حللتماها معًا! 🎉"
                      : "انتهت المحاولات!"
                  }
                  word={game.word}
                  onPlayAgain={playAgainTogether}
                  playAgainLabel="🔄 كلمة جديدة"
                />
              ) : (
                <ResultBanner
                  won={game.result === "won"}
                  title={
                    game.result === "won"
                      ? iAmChooser
                        ? "خمّن شريكك الكلمة!"
                        : "أحسنت! خمّنت الكلمة"
                      : iAmChooser
                      ? "لم يخمّن شريكك الكلمة"
                      : "انتهت المحاولات!"
                  }
                  word={game.word}
                  onPlayAgain={playAgainCoop}
                  playAgainLabel="🔄 جولة جديدة (تبديل الأدوار)"
                />
              ))}

            {game.status === "playing" && !iAmChooser && (
              <div className="glass rounded-3xl p-4">
                <Keyboard
                  guessed={game.guessed}
                  wordLetters={coopLetters}
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

      {/* ================= VERSUS MODE ================= */}
      {bothPresent && isVersus && !bothChosen && (
        <>
          {!iChoseWord ? (
            <WordPicker
              title="اختر كلمة لخصمك"
              hint="اكتب كلمة عربية سيحاول خصمك تخمينها. كلاكما يخمّن في الوقت نفسه!"
              value={wordInput}
              onChange={setWordInput}
              onSubmit={submitVersusWord}
              error={wordError}
              cta="تأكيد الكلمة"
            />
          ) : (
            <WaitingCard title="بانتظار خصمك ليختار كلمته…" sub="ثم تبدأ المنافسة!" />
          )}
        </>
      )}

      {bothPresent && isVersus && bothChosen && myWord && (
        <div className="flex flex-col gap-4">
          <div className="glass rounded-2xl px-4 py-2 text-center text-sm text-white/70">
            {versusOver
              ? "انتهت الجولة"
              : myDone
              ? "أنهيت — بانتظار خصمك…"
              : "⚔️ خمّن كلمتك بأقل أخطاء!"}
          </div>

          {/* Opponent live race indicator */}
          <div className="glass flex items-center justify-between rounded-2xl px-4 py-3 text-sm">
            <span className="text-white/70">خصمك</span>
            <span className="flex items-center gap-3">
              <span className="text-rose-300">
                أخطاء: {oppWord ? countWrong(oppWord, oppGuessed) : 0}
              </span>
              <span className="text-white/60">
                {oppDone
                  ? oppWord && isSolved(oppWord, oppGuessed)
                    ? "✅ حلّها"
                    : "💀 خسر"
                  : "يلعب…"}
              </span>
            </span>
          </div>

          <div className="glass rounded-3xl p-5">
            <Hangman wrong={myWrongCount} />
            <LivesRow wrong={myWrongCount} wrongLetters={myWrongLetters} />
          </div>

          <div className="glass rounded-3xl p-5">
            <WordDisplay word={myWord} guessed={myGuessed} reveal={versusOver} />
          </div>

          {versusOver ? (
            <VersusResult game={game} isA={isA} onPlayAgain={playAgainVersus} />
          ) : (
            <div className="glass rounded-3xl p-4">
              <Keyboard
                guessed={myGuessed}
                wordLetters={myLetters}
                onGuess={guessVersus}
                disabled={myDone}
              />
              {myDone && (
                <p className="mt-3 text-center text-sm text-white/60">
                  {isSolved(myWord, myGuessed)
                    ? "🎉 حللت كلمتك! بانتظار خصمك…"
                    : "💀 انتهت محاولاتك. بانتظار خصمك…"}
                </p>
              )}
            </div>
          )}
        </div>
      )}

      {/* Live chat (available whenever you're in the room) */}
      {myRole && <Chat code={code} me={me} role={myRole} />}
    </main>
  );
}

/* -------------------------------- Pieces -------------------------------- */

function VersusResult({
  game,
  isA,
  onPlayAgain,
}: {
  game: Game;
  isA: boolean;
  onPlayAgain: () => void;
}) {
  const winner = versusWinner(game);
  const iWon = (winner === "a" && isA) || (winner === "b" && !isA);
  const draw = winner === "draw";

  const myWord = isA ? game.word_for_a : game.word_for_b;
  const oppWord = isA ? game.word_for_b : game.word_for_a;
  const myGuessed = isA ? game.guessed_a : game.guessed_b;
  const oppGuessed = isA ? game.guessed_b : game.guessed_a;

  return (
    <div
      className={[
        "rounded-3xl p-5 text-center",
        draw
          ? "bg-white/10 text-white"
          : iWon
          ? "bg-emerald-500/15 text-emerald-200"
          : "bg-rose-500/15 text-rose-200",
      ].join(" ")}
    >
      <div className="mb-1 text-4xl">{draw ? "🤝" : iWon ? "🏆" : "😅"}</div>
      <p className="text-xl font-bold">
        {draw ? "تعادل!" : iWon ? "فزت! 🎉" : "فاز خصمك"}
      </p>
      <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
        <div className="rounded-xl bg-black/20 p-3">
          <div className="text-white/60">كلمتك</div>
          <div className="font-bold" dir="rtl">
            {myWord}
          </div>
          <div className="mt-1 text-white/60">
            أخطاؤك: {myWord ? countWrong(myWord, myGuessed) : 0}
          </div>
        </div>
        <div className="rounded-xl bg-black/20 p-3">
          <div className="text-white/60">كلمة خصمك</div>
          <div className="font-bold" dir="rtl">
            {oppWord}
          </div>
          <div className="mt-1 text-white/60">
            أخطاؤه: {oppWord ? countWrong(oppWord, oppGuessed) : 0}
          </div>
        </div>
      </div>
      <button
        onClick={onPlayAgain}
        className="btn-primary mt-4 rounded-2xl px-6 py-3 font-bold"
      >
        🔄 جولة جديدة
      </button>
    </div>
  );
}

function WordPicker({
  title,
  hint,
  value,
  onChange,
  onSubmit,
  error,
  cta,
}: {
  title: string;
  hint: string;
  value: string;
  onChange: (v: string) => void;
  onSubmit: () => void;
  error: string | null;
  cta: string;
}) {
  return (
    <div className="glass rounded-3xl p-6">
      <div className="mb-1 text-center text-3xl">✍️</div>
      <h2 className="mb-1 text-center text-xl font-bold">{title}</h2>
      <p className="mb-5 text-center text-sm text-white/60">{hint}</p>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && onSubmit()}
        placeholder="اكتب الكلمة هنا"
        dir="rtl"
        enterKeyHint="done"
        className="input-field mb-1 w-full rounded-2xl px-4 py-3 text-center text-2xl font-bold text-white placeholder:text-white/30"
        autoFocus
      />
      <p className="mb-4 text-center text-xs text-white/40">
        خصمك لن يرى الكلمة — فقط عدد الحروف.
      </p>
      {error && (
        <p className="mb-3 rounded-xl bg-rose-500/15 px-4 py-2 text-center text-sm text-rose-200">
          {error}
        </p>
      )}
      <button
        onClick={onSubmit}
        className="btn-primary w-full rounded-2xl py-3 text-lg font-bold"
      >
        {cta}
      </button>
    </div>
  );
}

function CategoryPicker({ onPick }: { onPick: (cat: Category) => void }) {
  return (
    <div className="glass rounded-3xl p-6">
      <div className="mb-1 text-center text-3xl">🗂️</div>
      <h2 className="mb-1 text-center text-xl font-bold">اختارا تصنيفًا</h2>
      <p className="mb-5 text-center text-sm text-white/60">
        ستظهر كلمة عشوائية من التصنيف، وتحاولان حلّها معًا كفريق.
      </p>
      <div className="grid grid-cols-2 gap-2">
        {CATEGORIES.map((cat) => (
          <button
            key={cat.id}
            onClick={() => onPick(cat)}
            className="flex items-center gap-2 rounded-2xl border border-white/12 bg-white/5 p-3 text-right font-bold transition-all hover:-translate-y-0.5 hover:border-fuchsia-400 hover:bg-fuchsia-500/15"
          >
            <span className="text-2xl">{cat.emoji}</span>
            <span>{cat.name}</span>
          </button>
        ))}
      </div>
      <p className="mt-4 text-center text-xs text-white/40">
        يمكن لأيٍّ منكما اختيار التصنيف.
      </p>
    </div>
  );
}

function WaitingCard({ title, sub }: { title: string; sub: string }) {
  return (
    <div className="glass rounded-3xl p-8 text-center">
      <div className="mb-3 text-4xl animate-floaty">⏳</div>
      <h2 className="text-xl font-bold">{title}</h2>
      <p className="mt-2 text-sm text-white/60">{sub}</p>
    </div>
  );
}

function LivesRow({
  wrong,
  wrongLetters,
}: {
  wrong: number;
  wrongLetters: string[];
}) {
  return (
    <>
      <div className="mt-3 text-center text-sm text-white/60">
        المحاولات المتبقية:{" "}
        <span className="font-bold text-white">{Math.max(0, MAX_WRONG - wrong)}</span>{" "}
        / {MAX_WRONG}
      </div>
      {wrongLetters.length > 0 && (
        <div className="mt-2 text-center text-sm text-rose-300" dir="rtl">
          حروف خاطئة: {wrongLetters.join(" · ")}
        </div>
      )}
    </>
  );
}

function ResultBanner({
  won,
  title,
  word,
  onPlayAgain,
  playAgainLabel,
}: {
  won: boolean;
  title: string;
  word: string;
  onPlayAgain: () => void;
  playAgainLabel: string;
}) {
  return (
    <div
      className={[
        "rounded-3xl p-5 text-center",
        won ? "bg-emerald-500/15 text-emerald-200" : "bg-rose-500/15 text-rose-200",
      ].join(" ")}
    >
      <div className="mb-1 text-4xl">{won ? "🎉" : "💔"}</div>
      <p className="text-lg font-bold">{title}</p>
      <p className="mt-1 text-sm opacity-80" dir="rtl">
        الكلمة كانت: <span className="font-bold">{word}</span>
      </p>
      <button
        onClick={onPlayAgain}
        className="btn-primary mt-4 rounded-2xl px-6 py-3 font-bold"
      >
        {playAgainLabel}
      </button>
    </div>
  );
}

function HomeButton({
  router,
  label,
}: {
  router: ReturnType<typeof useRouter>;
  label: string;
}) {
  return (
    <button
      onClick={() => router.push("/")}
      className="btn-ghost rounded-2xl px-6 py-3 font-bold"
    >
      {label}
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
