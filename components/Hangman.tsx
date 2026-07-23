"use client";

import { MAX_WRONG } from "@/lib/game";

// Draws the gallows plus one body part per wrong guess (up to MAX_WRONG).
export default function Hangman({ wrong }: { wrong: number }) {
  const w = Math.min(wrong, MAX_WRONG);
  const stroke = "#f5d0fe";
  const bad = "#fb7185";

  const parts = [
    // head
    <circle key="head" cx="140" cy="80" r="20" fill="none" stroke={bad} strokeWidth="4" />,
    // body
    <line key="body" x1="140" y1="100" x2="140" y2="150" stroke={bad} strokeWidth="4" />,
    // left arm
    <line key="la" x1="140" y1="115" x2="115" y2="135" stroke={bad} strokeWidth="4" />,
    // right arm
    <line key="ra" x1="140" y1="115" x2="165" y2="135" stroke={bad} strokeWidth="4" />,
    // left leg
    <line key="ll" x1="140" y1="150" x2="120" y2="185" stroke={bad} strokeWidth="4" />,
    // right leg
    <line key="rl" x1="140" y1="150" x2="160" y2="185" stroke={bad} strokeWidth="4" />,
  ];

  return (
    <svg viewBox="0 0 220 220" className="mx-auto w-full max-w-[180px] sm:max-w-[220px]" role="img" aria-label="رسم المشنقة">
      {/* gallows */}
      <line x1="20" y1="205" x2="100" y2="205" stroke={stroke} strokeWidth="5" strokeLinecap="round" />
      <line x1="55" y1="205" x2="55" y2="20" stroke={stroke} strokeWidth="5" strokeLinecap="round" />
      <line x1="55" y1="20" x2="140" y2="20" stroke={stroke} strokeWidth="5" strokeLinecap="round" />
      <line x1="140" y1="20" x2="140" y2="60" stroke={stroke} strokeWidth="5" strokeLinecap="round" />
      {parts.slice(0, w).map((p) => (
        <g key={(p as any).key} className="animate-pop" style={{ transformOrigin: "center" }}>
          {p}
        </g>
      ))}
    </svg>
  );
}
