// Single catalogue of games, shared by the home dashboard and the games library.
export type GameKey = "hangman" | "wordle" | "wordbox" | "stop" | "meld";

export type GameTone = "primary" | "coral" | "yellow" | "success";
export type GameCategory = "سريعة" | "يومية" | "تنافسية" | "تعاونية";

export type GameInfo = {
  key: GameKey;
  href: string;
  name: string;
  short: string;
  tag: string;
  tone: GameTone;
  icon: string;
  categories: GameCategory[];
};

export const GAMES: GameInfo[] = [
  {
    key: "hangman",
    href: "/hangman",
    name: "المشنقة",
    short: "خمّنا الكلمة حرفًا حرفًا قبل أن تذبل الوردة.",
    tag: "٣ أنماط",
    tone: "coral",
    icon: "🌷",
    categories: ["تنافسية", "تعاونية"],
  },
  {
    key: "wordle",
    href: "/wordle",
    name: "وردل",
    short: "كلمة مخفية، ست محاولات، وسباق هادئ بينكما.",
    tag: "تنافسي",
    tone: "success",
    icon: "🟩",
    categories: ["تنافسية", "يومية"],
  },
  {
    key: "wordbox",
    href: "/wordbox",
    name: "تكوين الكلمات",
    short: "صِلا الحروف المتجاورة وكوّنا أطول الكلمات.",
    tag: "تنافسي",
    tone: "primary",
    icon: "🔤",
    categories: ["تنافسية", "سريعة"],
  },
  {
    key: "stop",
    href: "/stop",
    name: "اسم حيوان جماد",
    short: "حرف واحد، خمس خانات، ومن يسبق بالضغط يكسب.",
    tag: "سريعة",
    tone: "yellow",
    icon: "🅰️",
    categories: ["سريعة", "تنافسية"],
  },
  {
    key: "meld",
    href: "/meld",
    name: "توارد الأفكار",
    short: "كلمتان سرّيتان… وتحاولان أن تلتقيا في واحدة.",
    tag: "تعاوني",
    tone: "coral",
    icon: "🧠",
    categories: ["تعاونية"],
  },
];

export const GAME_CATEGORIES: GameCategory[] = [
  "سريعة",
  "يومية",
  "تنافسية",
  "تعاونية",
];

export function gameByKey(key: GameKey): GameInfo | undefined {
  return GAMES.find((g) => g.key === key);
}
