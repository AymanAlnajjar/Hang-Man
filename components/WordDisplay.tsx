"use client";

// Shows the word as a row of letter tiles. Guessed (or revealed) letters show,
// the rest show a blank slot. Spaces render as a gap between words. Letters stay
// centered inside their tiles even in the RTL layout.
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
      className="flex flex-wrap justify-center gap-2"
      role="group"
      aria-label="الكلمة"
    >
      {chars.map((ch, i) => {
        if (ch === " ") {
          return <span key={i} className="w-3" />;
        }
        const shown = reveal || guessedSet.has(ch);
        const missed = reveal && !guessedSet.has(ch); // never guessed, shown on loss
        return (
          <span
            key={i}
            aria-label={shown ? ch : "حرف مخفي"}
            className={[
              "grid h-14 w-11 place-items-center rounded-md border-2 border-ink text-3xl font-extrabold",
              shown
                ? missed
                  ? "animate-pop bg-danger-soft text-ink"
                  : "animate-bounce-up bg-yellow text-ink"
                : "bg-surface-strong text-transparent",
            ].join(" ")}
          >
            {shown ? ch : "•"}
          </span>
        );
      })}
    </div>
  );
}
