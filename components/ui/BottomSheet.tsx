"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { CloseIcon } from "./icons";

// Mobile bottom sheet: slides up from the bottom, respects safe area, traps
// focus loosely, closes on Escape / backdrop. Preferred over centered modals.
export default function BottomSheet({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
}) {
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    // Move focus into the sheet for screen readers / keyboard users.
    const t = setTimeout(() => panelRef.current?.focus(), 20);
    return () => {
      document.removeEventListener("keydown", onKey);
      clearTimeout(t);
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 flex items-end justify-center"
      style={{ zIndex: "var(--z-modal)" }}
    >
      <div className="absolute inset-0 bg-ink/45" onClick={onClose} aria-hidden />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
        dir="rtl"
        className="relative w-full max-w-[480px] animate-sheet-up rounded-t-lg border-2 border-b-0 border-ink bg-surface outline-none"
        style={{
          maxHeight: "86dvh",
          paddingBottom: "max(1rem, env(safe-area-inset-bottom))",
        }}
      >
        {/* drag handle */}
        <div className="flex justify-center pt-2.5">
          <span className="h-1.5 w-10 rounded-pill bg-muted" aria-hidden />
        </div>
        <div className="flex items-center justify-between px-5 pb-2 pt-2">
          {title ? (
            <h2 className="text-lg font-bold text-ink">{title}</h2>
          ) : (
            <span />
          )}
          <button
            onClick={onClose}
            aria-label="إغلاق"
            className="grid h-9 w-9 place-items-center rounded-md border-2 border-ink bg-surface-strong text-ink"
          >
            <CloseIcon size={18} />
          </button>
        </div>
        <div className="overflow-y-auto px-5 pb-4" style={{ maxHeight: "68dvh" }}>
          {children}
        </div>
      </div>
    </div>
  );
}
