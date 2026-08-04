"use client";

import { useRouter } from "next/navigation";
import type { ReactNode } from "react";
import { BackIcon } from "@/components/ui/icons";

// Page header. Compact by default (good for game pages), with optional back
// button, title, and a trailing slot (settings, score, room code…).
export default function TopHeader({
  title,
  subtitle,
  back,
  onBack,
  trailing,
  compact,
}: {
  title?: ReactNode;
  subtitle?: ReactNode;
  back?: boolean;
  onBack?: () => void;
  trailing?: ReactNode;
  compact?: boolean;
}) {
  const router = useRouter();
  const goBack = onBack ?? (() => router.push("/"));

  return (
    <header
      className={[
        "flex items-center justify-between gap-2",
        compact ? "py-2" : "py-3",
      ].join(" ")}
    >
      <div className="flex min-w-0 items-center gap-2">
        {back && (
          <button
            onClick={goBack}
            aria-label="رجوع"
            className="grid h-10 w-10 shrink-0 place-items-center rounded-md border-2 border-ink bg-surface-strong text-ink"
          >
            {/* In RTL, back points to the inline-start (visually right). */}
            <BackIcon size={20} />
          </button>
        )}
        {title && (
          <div className="min-w-0">
            <h1 className={compact ? "truncate text-lg font-bold" : "truncate text-xl font-extrabold"}>
              {title}
            </h1>
            {subtitle && (
              <p className="truncate text-xs text-ink-soft">{subtitle}</p>
            )}
          </div>
        )}
      </div>
      {trailing && <div className="flex shrink-0 items-center gap-2">{trailing}</div>}
    </header>
  );
}
