"use client";

import { ARABIC_LETTERS } from "@/lib/arabic";

// On-screen Arabic keyboard. Correct guesses turn green, wrong ones red (with a
// small shake), and every tried letter is disabled. `disabled` locks the whole
// board (used when it's not your turn or the round is over).
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
    <div dir="rtl" className="grid grid-cols-7 gap-1.5 sm:grid-cols-9">
      {ARABIC_LETTERS.map((letter) => {
        const tried = guessedSet.has(letter);
        const correct = tried && wordLetters.has(letter);
        const wrong = tried && !wordLetters.has(letter);
        return (
          <button
            key={letter}
            type="button"
            disabled={disabled || tried}
            aria-label={letter}
            aria-pressed={tried}
            onClick={() => onGuess(letter)}
            className={[
              "grid aspect-square min-h-[44px] place-items-center rounded-md border-2 border-ink text-xl font-extrabold transition-transform",
              "disabled:cursor-not-allowed active:translate-y-0.5",
              correct
                ? "bg-success text-white"
                : wrong
                ? "animate-shake bg-danger-soft text-ink/50"
                : disabled
                ? "bg-muted text-disabled"
                : "bg-surface-strong text-ink shadow-card-sm",
            ].join(" ")}
          >
            {letter}
          </button>
        );
      })}
    </div>
  );
}
