"use client";

import {
  createContext,
  useCallback,
  useContext,
  useRef,
  useState,
  type ReactNode,
} from "react";

type ToastTone = "default" | "success" | "danger" | "primary";
type ToastItem = { id: number; text: string; tone: ToastTone };

type ToastApi = (text: string, tone?: ToastTone) => void;

const ToastCtx = createContext<ToastApi | null>(null);

// Lightweight Arabic toast region, positioned above the bottom navigation.
// Announced via aria-live for screen readers.
export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const seq = useRef(0);

  const push = useCallback<ToastApi>((text, tone = "default") => {
    const id = ++seq.current;
    setItems((prev) => [...prev, { id, text, tone }]);
    setTimeout(() => {
      setItems((prev) => prev.filter((t) => t.id !== id));
    }, 2600);
  }, []);

  return (
    <ToastCtx.Provider value={push}>
      {children}
      <div
        className="pointer-events-none fixed inset-x-0 flex flex-col items-center gap-2 px-4"
        style={{
          bottom: "calc(var(--nav-height) + env(safe-area-inset-bottom) + 12px)",
          zIndex: "var(--z-toast)",
        }}
        aria-live="polite"
        aria-atomic="false"
      >
        {items.map((t) => (
          <div
            key={t.id}
            dir="rtl"
            className={[
              "animate-toast-in w-full max-w-[440px] rounded-md border-2 border-ink px-4 py-2.5 text-sm font-bold shadow-card-sm",
              t.tone === "success"
                ? "bg-success-soft text-ink"
                : t.tone === "danger"
                ? "bg-danger-soft text-ink"
                : t.tone === "primary"
                ? "bg-primary-soft text-ink"
                : "bg-surface-strong text-ink",
            ].join(" ")}
          >
            {t.text}
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  );
}

// Returns a `toast(text, tone?)` function. Safe no-op if no provider is mounted.
export function useToast(): ToastApi {
  const ctx = useContext(ToastCtx);
  return ctx ?? (() => {});
}
