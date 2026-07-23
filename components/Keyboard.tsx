"use client";

import { ARABIC_LETTERS } from "@/lib/arabic";

// On-screen Arabic keyboard. Correct guesses turn green, wrong ones red,
// and every tried letter is disabled. `disabled` locks the whole board
// (used when it's not your turn or the round is over).
export default function Keyboard({
  guessed,
  wordLetters,
  onGuess,
  disabled,
}: {
  guessed: string[];
  wordLetters: Set<string>;
  onGuess: (letter: string) => void;
  disabled: boolean;
}) {
  const guessedSet = new Set(guessed);

  return (
    <div dir="rtl" className="grid grid-cols-6 gap-2 sm:grid-cols-10">
      {ARABIC_LETTERS.map((letter) => {
        const tried = guessedSet.has(letter);
        const correct = tried && wordLetters.has(letter);
        const wrong = tried && !wordLetters.has(letter);
        return (
          <button
            key={letter}
            type="button"
            disabled={disabled || tried}
            onClick={() => onGuess(letter)}
            className={[
              "aspect-square rounded-xl text-xl font-bold transition-all select-none",
              "disabled:cursor-not-allowed",
              correct
                ? "bg-emerald-500/90 text-white shadow-lg shadow-emerald-500/20"
                : wrong
                ? "bg-rose-500/80 text-white/90"
                : disabled
                ? "bg-white/5 text-white/30"
                : "bg-white/10 text-white hover:bg-fuchsia-500/40 hover:-translate-y-0.5 active:translate-y-0",
            ].join(" ")}
          >
            {letter}
          </button>
        );
      })}
    </div>
  );
}
