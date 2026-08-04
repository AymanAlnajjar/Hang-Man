"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/lib/auth";
import InvitesBanner from "@/components/InvitesBanner";
import AppShell from "@/components/layout/AppShell";
import GameCard from "@/components/home/GameCard";
import Chip from "@/components/ui/Chip";
import { GAMES, gameByKey } from "@/lib/games";
import { GAME_META } from "@/lib/rooms";
import { getRecentRoom, type RecentRoom } from "@/lib/recent";
import { greeting, heroLine } from "@/lib/microcopy";

export default function Hub() {
  const { user, profile } = useAuth();
  const [recent, setRecent] = useState<RecentRoom | null>(null);
  // Pick the witty line after mount so SSR and the first client render match.
  const [seed, setSeed] = useState(0);

  useEffect(() => {
    setRecent(getRecentRoom());
    setSeed(Math.floor(Math.random() * 997));
  }, []);

  const [featured, ...rest] = GAMES;
  const name = profile?.username ?? null;
  const recentGame = recent ? gameByKey(recent.game) : undefined;

  return (
    <AppShell>
      {/* Greeting + account */}
      <div className="flex items-start justify-between gap-3 pt-2">
        <div className="min-w-0">
          <h1 className="text-2xl font-extrabold leading-tight">
            {greeting(name)}
          </h1>
          <p className="mt-1 text-sm text-ink-soft">{heroLine(seed)}</p>
        </div>
        <Link
          href={user ? "/account" : "/account"}
          className="chip chip-primary shrink-0"
        >
          {user ? `@${profile?.username ?? "حسابنا"}` : "تسجيل الدخول"}
        </Link>
      </div>

      <div className="mt-4">
        <InvitesBanner />
      </div>

      {/* Resume last room */}
      {recent && recentGame && (
        <Link
          href={GAME_META[recent.game].route(recent.code)}
          className="card card-interactive mt-2 flex items-center gap-4 rounded-lg bg-primary-soft p-5"
        >
          <span className="grid h-16 w-16 shrink-0 place-items-center rounded-md border-2 border-ink bg-surface-strong text-4xl">
            {recentGame.icon}
          </span>
          <div className="min-w-0 flex-1">
            <div className="text-xs font-bold text-primary-dark">أكملوا اللعب</div>
            <h2 className="truncate text-xl font-extrabold">{recentGame.name}</h2>
            <p className="mt-0.5 text-sm text-ink-soft">
              الغرفة <span dir="ltr" className="font-bold tracking-widest">{recent.code}</span>
            </p>
          </div>
          <span aria-hidden className="shrink-0 text-2xl text-primary-dark">‹</span>
        </Link>
      )}

      {/* Featured game */}
      <section className="mt-4">
        <h2 className="mb-2 text-lg font-bold">
          العبوا الآن
        </h2>
        <GameCard info={featured} variant="featured" />
      </section>

      {/* Rest of the games as a light bento grid */}
      <section className="mt-3 grid grid-cols-2 gap-3">
        {rest.map((g) => (
          <GameCard key={g.key} info={g} variant="compact" />
        ))}
        <Link
          href="/games"
          className="card card-interactive flex flex-col items-start justify-between gap-2 bg-surface p-4"
        >
          <span className="grid h-12 w-12 place-items-center rounded-md border-2 border-ink bg-surface-strong text-2xl">
            ⋯
          </span>
          <h3 className="text-[17px] font-bold leading-tight">كل الألعاب</h3>
          <Chip tone="muted" className="self-start">المكتبة</Chip>
        </Link>
      </section>

      {/* Rivalry teaser */}
      <Link
        href="/results"
        className="card card-interactive mt-4 flex items-center justify-between gap-3 bg-yellow-soft p-4"
      >
        <div>
          <div className="text-xs font-bold text-ink-soft">سجلّ المواجهات</div>
          <p className="text-[15px] font-bold">من المتصدّر بينكما؟</p>
        </div>
        <span className="chip chip-yellow">🏆 النتائج</span>
      </Link>

      <p className="mt-6 text-center text-xs text-ink-soft">
        صُنع بحبّ لشخصين — والمزيد من الألعاب قريبًا.
      </p>
    </AppShell>
  );
}
