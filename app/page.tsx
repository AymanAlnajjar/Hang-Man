"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";
import { getPlayerId } from "@/lib/player";
import { makeRoomCode } from "@/lib/game";

export default function Home() {
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
    // Try a few codes in case of an (unlikely) collision.
    for (let attempt = 0; attempt < 5; attempt++) {
      const code = makeRoomCode();
      const { error } = await supabase.from("games").insert({
        id: code,
        player_a: me,
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
    <main className="mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center px-5 pt-safe pb-safe">
      <div className="mb-8 text-center">
        <div className="mb-3 text-5xl animate-floaty">🎯</div>
        <h1 className="text-4xl font-extrabold tracking-tight">لعبة المشنقة</h1>
        <p className="mt-2 text-white/60">
          العبها مع شريكك أينما كنتما — واحد يختار الكلمة والآخر يخمّن الحروف.
        </p>
      </div>

      <div className="glass w-full rounded-3xl p-6">
        <button
          onClick={createGame}
          disabled={busy}
          className="btn-primary w-full rounded-2xl py-4 text-lg font-bold text-white"
        >
          {busy ? "جارٍ الإنشاء…" : "➕ إنشاء لعبة جديدة"}
        </button>

        <div className="my-5 flex items-center gap-3 text-white/40">
          <span className="h-px flex-1 bg-white/15" />
          <span className="text-sm">أو</span>
          <span className="h-px flex-1 bg-white/15" />
        </div>

        <label className="mb-2 block text-sm text-white/70">
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
            className="input-field w-full rounded-2xl px-4 py-3 text-center text-lg font-bold tracking-widest text-white placeholder:text-white/30"
          />
          <button
            onClick={joinGame}
            className="btn-ghost shrink-0 rounded-2xl px-5 font-bold text-white"
          >
            دخول
          </button>
        </div>

        {error && (
          <p className="mt-4 rounded-xl bg-rose-500/15 px-4 py-2 text-sm text-rose-200">
            {error}
          </p>
        )}
      </div>

      <p className="mt-6 text-center text-xs text-white/40">
        أنشئ لعبة، أرسل الرابط لشريكك، والعبا معًا في الوقت نفسه ❤️
      </p>
    </main>
  );
}
