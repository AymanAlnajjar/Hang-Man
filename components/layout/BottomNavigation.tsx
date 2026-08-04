"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { HomeIcon, GamesIcon, TrophyIcon, HeartIcon } from "@/components/ui/icons";
import type { ComponentType } from "react";

type Item = {
  href: string;
  label: string;
  Icon: ComponentType<{ size?: number }>;
  match: (p: string) => boolean;
};

const ITEMS: Item[] = [
  { href: "/", label: "الرئيسية", Icon: HomeIcon, match: (p) => p === "/" },
  { href: "/games", label: "الألعاب", Icon: GamesIcon, match: (p) => p.startsWith("/games") },
  { href: "/results", label: "النتائج", Icon: TrophyIcon, match: (p) => p.startsWith("/results") },
  { href: "/account", label: "حسابنا", Icon: HeartIcon, match: (p) => p.startsWith("/account") || p.startsWith("/friends") },
];

// Persistent mobile bottom nav. Selected state is shown by fill + weight + a top
// marker (not colour alone), and it sits above the safe-area inset.
export default function BottomNavigation() {
  const pathname = usePathname() || "/";

  return (
    <nav
      aria-label="التنقّل الرئيسي"
      className="fixed inset-x-0 bottom-0 z-30 mx-auto max-w-[480px] border-t-2 border-ink bg-surface-strong"
      style={{
        zIndex: "var(--z-navigation)",
        paddingBottom: "env(safe-area-inset-bottom)",
      }}
    >
      <ul className="flex items-stretch justify-around">
        {ITEMS.map(({ href, label, Icon, match }) => {
          const active = match(pathname);
          return (
            <li key={href} className="flex-1">
              <Link
                href={href}
                aria-current={active ? "page" : undefined}
                className="relative flex h-16 flex-col items-center justify-center gap-1"
              >
                <span
                  aria-hidden
                  className={[
                    "absolute inset-x-6 top-0 h-1 rounded-b-pill transition-colors",
                    active ? "bg-primary" : "bg-transparent",
                  ].join(" ")}
                />
                <span
                  className={[
                    "grid h-8 w-8 place-items-center rounded-md transition-colors",
                    active ? "bg-primary-soft text-primary-dark" : "text-ink-soft",
                  ].join(" ")}
                >
                  <Icon size={22} />
                </span>
                <span
                  className={[
                    "text-[11px] leading-none",
                    active ? "font-bold text-ink" : "font-medium text-ink-soft",
                  ].join(" ")}
                >
                  {label}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
