"use client";

import type { ReactNode } from "react";
import { ToastProvider } from "@/components/ui/Toast";
import BottomNavigation from "./BottomNavigation";

// Mobile application container: centered ≤480px column, safe areas, toast region,
// and an optional persistent bottom navigation. Content scrolls; the nav is fixed.
export default function AppShell({
  children,
  nav = true,
  className = "",
}: {
  children: ReactNode;
  nav?: boolean;
  className?: string;
}) {
  return (
    <ToastProvider>
      <div className="mx-auto flex min-h-dvh max-w-[480px] flex-col">
        <div
          className={["flex-1 px-4 pt-safe", className].join(" ")}
          style={{
            // Leave room for the fixed nav so content is never hidden behind it.
            paddingBottom: nav
              ? "calc(var(--nav-height) + env(safe-area-inset-bottom) + 16px)"
              : undefined,
          }}
        >
          {children}
        </div>
      </div>
      {nav && <BottomNavigation />}
    </ToastProvider>
  );
}
