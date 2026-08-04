"use client";

import { useState } from "react";
import AppShell from "@/components/layout/AppShell";
import GameCard from "@/components/home/GameCard";
import { GAMES, GAME_CATEGORIES, type GameCategory } from "@/lib/games";

type Filter = "الكل" | GameCategory;

export default function GamesLibrary() {
  const [filter, setFilter] = useState<Filter>("الكل");
  const filters: Filter[] = ["الكل", ...GAME_CATEGORIES];

  const [featured, ...rest] = GAMES;
  const shown =
    filter === "الكل"
      ? rest
      : GAMES.filter((g) => g.categories.includes(filter));
  const showFeatured = filter === "الكل";

  return (
    <AppShell>
      <header className="pt-2">
        <h1 className="text-2xl font-extrabold">الألعاب</h1>
        <p className="mt-1 text-sm text-ink-soft">
          اختاروا لعبة وابدآ غرفة — كل لعبة فيها دردشة مباشرة.
        </p>
      </header>

      {/* Filter chips */}
      <div className="mt-4 flex flex-wrap gap-2" role="tablist" aria-label="تصفية">
        {filters.map((f) => {
          const active = f === filter;
          return (
            <button
              key={f}
              role="tab"
              aria-selected={active}
              onClick={() => setFilter(f)}
              className={[
                "chip",
                active ? "chip-primary ring-2 ring-ink" : "",
              ].join(" ")}
            >
              {f}
            </button>
          );
        })}
      </div>

      {showFeatured && (
        <section className="mt-4">
          <GameCard info={featured} variant="featured" />
        </section>
      )}

      <section className="mt-3 flex flex-col gap-3">
        {shown.map((g) => (
          <GameCard key={g.key} info={g} variant="row" />
        ))}
      </section>
    </AppShell>
  );
}
