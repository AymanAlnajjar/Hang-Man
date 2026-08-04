import type { ReactNode } from "react";

// Friendly empty / error placeholder. Reflects card geometry, not a bare spinner.
export default function EmptyState({
  icon = "🫙",
  title,
  hint,
  action,
  tone = "muted",
}: {
  icon?: ReactNode;
  title: string;
  hint?: string;
  action?: ReactNode;
  tone?: "muted" | "danger";
}) {
  return (
    <div
      className={[
        "card flex flex-col items-center gap-2 p-8 text-center",
        tone === "danger" ? "bg-danger-soft" : "bg-surface",
      ].join(" ")}
    >
      <div className="text-4xl" aria-hidden>
        {icon}
      </div>
      <h3 className="text-lg font-bold text-ink">{title}</h3>
      {hint && <p className="text-sm text-ink-soft">{hint}</p>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}
