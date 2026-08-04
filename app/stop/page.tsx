"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";
import { getPlayerId } from "@/lib/player";
import { makeRoomCode } from "@/lib/game";
import { ROUND_DURATION } from "@/lib/stop";

export default function StopHome() {
  const router = useRouter();
  const [joinCode, setJoinCode] = useState("");
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
      const { error } = await supabase.from("stop_games").insert({
        id: code,
        player_a: me,
        status: "waiting",
        duration: ROUND_DURATION,
        round: 1,
      });
      if (!error) {
        router.push(`/stop/${code}`);
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
    router.push(`/stop/${code}`);
  }

  return (
    <main className="mx-auto flex min-h-dvh max-w-[480px] flex-col justify-center px-5 pt-safe pb-safe">
      <Link href="/games" className="mb-4 self-start">
        <span className="chip">‹ كل الألعاب</span>
      </Link>

      <div className="mb-6 text-center">
        <div className="mb-3 text-5xl animate-floaty">🅰️</div>
        <h1 className="text-3xl font-extrabold tracking-tight">اسم حيوان جماد</h1>
        <p className="mt-2 text-sm text-ink-soft">
          يظهر حرف عشوائي، وتتسابقان لملء التصنيفات (اسم، حيوان، نبات، جماد،
          بلاد) بكلمات تبدأ به. من يضغط «قف» يوقف الجولة — والأكثر نقاطًا يفوز!
        </p>
      </div>

      <div className="card w-full bg-surface p-6">
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
