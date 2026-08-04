type Tone = "primary" | "coral" | "yellow" | "success" | "danger";

const FILL: Record<Tone, string> = {
  primary: "bg-primary",
  coral: "bg-coral",
  yellow: "bg-yellow",
  success: "bg-success",
  danger: "bg-danger",
};

// Thick, outlined progress indicator. `value`/`max` are clamped to 0..100%.
// Fills from the inline-start edge, so it reads correctly right-to-left.
export default function ProgressBar({
  value,
  max = 100,
  tone = "primary",
  label,
  className = "",
}: {
  value: number;
  max?: number;
  tone?: Tone;
  label?: string;
  className?: string;
}) {
  const pct = Math.max(0, Math.min(100, (value / (max || 1)) * 100));
  return (
    <div
      className={["h-3 w-full overflow-hidden rounded-pill border-2 border-ink bg-surface-strong", className].join(" ")}
      role="progressbar"
      aria-valuenow={Math.round(pct)}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={label}
    >
      <div
        className={["h-full rounded-pill transition-[width] duration-200 ease-standard", FILL[tone]].join(" ")}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}
