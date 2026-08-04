import type { HTMLAttributes } from "react";

type Tone =
  | "default"
  | "primary"
  | "coral"
  | "yellow"
  | "success"
  | "danger"
  | "muted";

type Props = HTMLAttributes<HTMLSpanElement> & { tone?: Tone };

const TONE: Record<Tone, string> = {
  default: "",
  primary: "chip-primary",
  coral: "chip-coral",
  yellow: "chip-yellow",
  success: "chip-success",
  danger: "chip-danger",
  muted: "chip-muted",
};

// Small status/tag pill. Used for game types, turn status, streaks, badges.
export default function Chip({ tone = "default", className = "", children, ...rest }: Props) {
  return (
    <span className={["chip", TONE[tone], className].join(" ")} {...rest}>
      {children}
    </span>
  );
}
