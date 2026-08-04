"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";
import { getPlayerId } from "@/lib/player";
import { makeRoomCode, type GameMode } from "@/lib/game";

export default function HangmanHome() {
  const router = useRouter();
  const [joinCode, setJoinCode] = useState("");
  const [mode, setMode] = useState<GameMode>("together");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function createGame() {
    setError(null);
    if (!isSupabaseConfigured) {
      setError("لم يتم ربط قاعدة البيانات بعد. راجع ملف README لإعداد Supabase.");
      return;
    }
    setBusy(true);
    const me = getPlayerId();
    for (let attempt = 0; attempt < 5; attempt++) {
      const code = makeRoomCode();
      const { error } = await supabase.from("games").insert({
        id: code,
        player_a: me,
        mode,
        guessed: [],
        status: "waiting",
        round: 1,
      });
      if (!error) {
        router.push(`/game/${code}`);
        return;
      }
    }
    setBusy(false);
    setError("تعذّر إنشاء اللعبة. حاول مرة أخرى.");
  }

  function joinGame() {
    setError(null);
    const code = joinCode.trim().toUpperCase();
    if (!code) {
      setError("أدخل رمز الغرفة.");
      return;
    }
    router.push(`/game/${code}`);
  }

  return (
    <main className="mx-auto flex min-h-dvh max-w-[480px] flex-col justify-center px-5 pt-safe pb-safe">
      <Link href="/games" className="mb-4 self-start">
        <span className="chip">‹ كل الألعاب</span>
      </Link>

      <div className="mb-6 text-center">
        <div className="mb-3 text-5xl animate-floaty">🌷</div>
        <h1 className="text-3xl font-extrabold tracking-tight">لعبة المشنقة</h1>
        <p className="mt-2 text-sm text-ink-soft">
          العبها مع شريكك أينما كنتما — واختر طريقة اللعب.
        </p>
      </div>

      <div className="card w-full bg-surface p-6">
        <div className="mb-4 flex flex-col gap-2">
          <ModeCard
            active={mode === "together"}
            onClick={() => setMode("together")}
            icon="🤝"
            title="تعاوني"
            desc="نحلّ كلمة عشوائية من تصنيف تختارانه — معًا كفريق"
          />
          <ModeCard
            active={mode === "coop"}
            onClick={() => setMode("coop")}
            icon="✍️"
            title="تبادلي"
            desc="واحد يختار الكلمة، والآخر يخمّنها — ثم تتبادلان"
          />
          <ModeCard
            active={mode === "versus"}
            onClick={() => setMode("versus")}
            icon="⚔️"
            title="تنافسي"
            desc="كلٌّ يختار كلمة للآخر — ومن يحلّها بأقل أخطاء يفوز"
          />
        </div>

        <button onClick={createGame} disabled={busy} className="btn btn-primary w-full text-lg">
          {busy ? "جارٍ الإنشاء…" : "➕ إنشاء لعبة جديدة"}
        </button>

        <div className="my-5 flex items-center gap-3 text-ink-soft">
          <span className="h-0.5 flex-1 bg-muted" />
          <span className="text-sm">أو</span>
          <span className="h-0.5 flex-1 bg-muted" />
        </div>

        <label className="mb-2 block text-sm font-bold text-ink-soft">
          الانضمام إلى لعبة برمز الغرفة
        </label>
        <div className="flex gap-2">
          <input
            value={joinCode}
            onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
            onKeyDown={(e) => e.key === "Enter" && joinGame()}
            placeholder="مثال: K7QM2"
            dir="ltr"
            maxLength={8}
            enterKeyHint="go"
            className="input-field w-full px-4 py-3 text-center text-lg font-bold tracking-widest text-ink"
          />
          <button onClick={joinGame} className="btn btn-ghost shrink-0 px-5">
            دخول
          </button>
        </div>

        {error && (
          <p className="mt-4 rounded-md border-2 border-ink bg-danger-soft px-4 py-2 text-sm text-ink">
            {error}
          </p>
        )}
      </div>
    </main>
  );
}

function ModeCard({
  active,
  onClick,
  icon,
  title,
  desc,
}: {
  active: boolean;
  onClick: () => void;
  icon: string;
  title: string;
  desc: string;
}) {
  return (
    <button
      onClick={onClick}
      aria-pressed={active}
      className={[
        "flex items-center gap-3 rounded-md border-2 border-ink p-3 text-right transition-transform active:translate-y-0.5",
        active ? "bg-primary-soft" : "bg-surface-strong",
      ].join(" ")}
    >
      <div className="shrink-0 text-2xl">{icon}</div>
      <div className="min-w-0">
        <div className="flex items-center gap-2 font-bold">
          {title}
          {active && <span className="text-primary-dark">✓</span>}
        </div>
        <div className="text-[11px] leading-tight text-ink-soft">{desc}</div>
      </div>
    </button>
  );
}
