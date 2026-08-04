"use client";

import { MAX_WRONG } from "@/lib/game";

// A tulip that loses one petal per wrong guess — a calmer, grown-up stand-in for
// the classic gallows. Petals remaining = attempts remaining; drop from the
// outside in so the flower keeps its core until the last mistake.
export default function Hangman({ wrong }: { wrong: number }) {
  const remaining = Math.max(0, MAX_WRONG - Math.min(wrong, MAX_WRONG));

  const ink = "#20243d";
  const petalFill = ["#ff806c", "#ff806c", "#5267e8", "#5267e8", "#ffd369", "#ffd369"];
  // Fanned petals, ordered inner→outer so slice(0, remaining) drops outer first.
  const angles = [-10, 10, -32, 32, -54, 54];

  return (
    <svg
      viewBox="0 0 220 220"
      className="mx-auto w-full max-w-[170px] sm:max-w-[200px]"
      role="img"
      aria-label={`الوردة تبقّى منها ${remaining} من ${MAX_WRONG} بتلات`}
    >
      {/* stem */}
      <line x1="110" y1="200" x2="110" y2="104" stroke="#78ad8a" strokeWidth="6" strokeLinecap="round" />
      {/* leaves */}
      <ellipse cx="88" cy="150" rx="20" ry="10" fill="#dcecdf" stroke={ink} strokeWidth="2.5" transform="rotate(-28 88 150)" />
      <ellipse cx="132" cy="168" rx="18" ry="9" fill="#dcecdf" stroke={ink} strokeWidth="2.5" transform="rotate(26 132 168)" />

      {/* calyx / cup */}
      <path d="M92 104 Q110 122 128 104 L124 96 Q110 104 96 96 Z" fill="#78ad8a" stroke={ink} strokeWidth="2.5" />

      {/* petals (inner kept longest) */}
      {angles.map((a, i) => {
        const shown = i < remaining;
        if (!shown) return null;
        return (
          <ellipse
            key={i}
            cx="110"
            cy="70"
            rx="15"
            ry="32"
            fill={petalFill[i]}
            stroke={ink}
            strokeWidth="2.5"
            transform={`rotate(${a} 110 102)`}
            className="animate-pop"
            style={{ transformOrigin: "110px 102px" }}
          />
        );
      })}

      {/* when bare, a small dropped petal at the base to soften the loss */}
      {remaining === 0 && (
        <ellipse cx="140" cy="196" rx="12" ry="6" fill="#ffe2dc" stroke={ink} strokeWidth="2" transform="rotate(18 140 196)" />
      )}
    </svg>
  );
}
