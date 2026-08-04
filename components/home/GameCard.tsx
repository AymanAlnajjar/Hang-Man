import Link from "next/link";
import type { GameInfo } from "@/lib/games";
import Chip from "@/components/ui/Chip";

const TONE_BG: Record<GameInfo["tone"], string> = {
  primary: "bg-primary-soft",
  coral: "bg-coral-soft",
  yellow: "bg-yellow-soft",
  success: "bg-success-soft",
};
const CHIP_TONE: Record<GameInfo["tone"], "primary" | "coral" | "yellow" | "success"> = {
  primary: "primary",
  coral: "coral",
  yellow: "yellow",
  success: "success",
};

// A game entry card. `featured` is the big hero tile; `compact` is the 2-col tile;
// default is a full-width row with a description.
export default function GameCard({
  info,
  variant = "row",
}: {
  info: GameInfo;
  variant?: "featured" | "compact" | "row";
}) {
  const bg = TONE_BG[info.tone];

  if (variant === "compact") {
    return (
      <Link
        href={info.href}
        className={["card card-interactive flex flex-col gap-2 p-4", bg].join(" ")}
      >
        <span className="grid h-12 w-12 place-items-center rounded-md border-2 border-ink bg-surface-strong text-2xl">
          {info.icon}
        </span>
        <h3 className="text-[17px] font-bold leading-tight">{info.name}</h3>
        <Chip tone={CHIP_TONE[info.tone]} className="self-start">
          {info.tag}
        </Chip>
      </Link>
    );
  }

  if (variant === "featured") {
    return (
      <Link
        href={info.href}
        className={["card card-interactive rounded-lg p-5", bg].join(" ")}
      >
        <div className="flex items-start justify-between gap-3">
          <span className="grid h-16 w-16 place-items-center rounded-md border-2 border-ink bg-surface-strong text-4xl">
            {info.icon}
          </span>
          <Chip tone={CHIP_TONE[info.tone]}>{info.tag}</Chip>
        </div>
        <h2 className="mt-3 text-2xl font-extrabold">{info.name}</h2>
        <p className="mt-1 text-sm leading-relaxed text-ink-soft">{info.short}</p>
        <span className="mt-3 inline-flex items-center gap-1 text-sm font-bold text-primary-dark">
          ابدأوا اللعب ‹
        </span>
      </Link>
    );
  }

  return (
    <Link
      href={info.href}
      className={["card card-interactive flex items-center gap-4 p-4", bg].join(" ")}
    >
      <span className="grid h-14 w-14 shrink-0 place-items-center rounded-md border-2 border-ink bg-surface-strong text-3xl">
        {info.icon}
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <h3 className="text-[17px] font-bold">{info.name}</h3>
          <Chip tone={CHIP_TONE[info.tone]}>{info.tag}</Chip>
        </div>
        <p className="mt-0.5 text-sm leading-snug text-ink-soft">{info.short}</p>
      </div>
      <span aria-hidden className="shrink-0 text-2xl text-ink-soft">
        ‹
      </span>
    </Link>
  );
}
