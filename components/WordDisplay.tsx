"use client";

// Shows the word as a row of letter slots. Guessed (or revealed) letters show,
// the rest show a blank underline. Spaces render as a gap between words.
export default function WordDisplay({
  word,
  guessed,
  reveal,
}: {
  word: string;
  guessed: string[];
  reveal: boolean;
}) {
  const guessedSet = new Set(guessed);
  const chars = word.split("");

  return (
    <div
      dir="rtl"
      className="flex flex-wrap justify-center gap-x-2 gap-y-3"
      aria-label="الكلمة"
    >
      {chars.map((ch, i) => {
        if (ch === " ") {
          return <span key={i} className="w-4" />;
        }
        const shown = reveal || guessedSet.has(ch);
        const missed = reveal && !guessedSet.has(ch); // letter never guessed, shown on loss
        return (
          <span
            key={i}
            className={[
              "inline-flex h-14 w-11 items-end justify-center rounded-lg border-b-4 pb-1 text-3xl font-bold transition-colors",
              shown
                ? missed
                  ? "border-rose-400/70 text-rose-300"
                  : "border-fuchsia-300 text-white animate-pop"
                : "border-white/25 text-transparent",
            ].join(" ")}
          >
            {shown ? ch : "؟"}
          </span>
        );
      })}
    </div>
  );
}
