import type { HTMLAttributes } from "react";

type Tone =
  | "default"
  | "primary"
  | "coral"
  | "yellow"
  | "success"
  | "danger"
  | "muted"
  | "featured";

type Props = HTMLAttributes<HTMLDivElement> & {
  tone?: Tone;
  interactive?: boolean;
  compact?: boolean;
};

const TONE: Record<Tone, string> = {
  default: "bg-surface",
  primary: "bg-primary-soft",
  coral: "bg-coral-soft",
  yellow: "bg-yellow-soft",
  success: "bg-success-soft",
  danger: "bg-danger-soft",
  muted: "bg-muted",
  featured: "bg-surface-strong",
};

// Editorial card. Base look comes from the `.card` component class; tone swaps
// the fill, `interactive` adds the press-in behaviour, `featured` a bigger radius.
export default function Card({
  tone = "default",
  interactive,
  compact,
  className = "",
  children,
  ...rest
}: Props) {
  return (
    <div
      className={[
        "card",
        TONE[tone],
        tone === "featured" ? "rounded-lg" : "",
        interactive ? "card-interactive cursor-pointer" : "",
        compact ? "p-3" : "p-5",
        className,
      ].join(" ")}
      {...rest}
    >
      {children}
    </div>
  );
}
