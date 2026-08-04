// Natural, lightly competitive Arabic microcopy. Humour lives here so the rest
// of the UI can stay clean. Names are passed in from real app data.

function pick<T>(arr: T[], seed?: number): T {
  const i =
    seed == null
      ? Math.floor(Math.random() * arr.length)
      : Math.abs(seed) % arr.length;
  return arr[i];
}

export function greeting(name?: string | null): string {
  return name ? `مرحبًا ${name}` : "مرحبًا بك";
}

const HERO = [
  "هل أنت مستعد لخسارة جديدة؟",
  "القاموس متحمّس، والخصم يتظاهر بالهدوء.",
  "جولة سريعة قبل أن يعود الغرور؟",
  "الحروف جاهزة… والأعذار أيضًا.",
];
export function heroLine(seed?: number): string {
  return pick(HERO, seed);
}

// Loading lines.
export const LOADING = [
  "لحظة، نرتّب الحروف.",
  "نحاول إقناع الكلمات بالتعاون.",
  "اللعبة تجهّز خطتها ضدك.",
];
export function loadingLine(seed?: number): string {
  return pick(LOADING, seed);
}

// Empty states.
export const EMPTY = [
  "لا توجد مباريات هنا حتى الآن.",
  "الهدوء مريب… ابدأ لعبة جديدة.",
  "لا نتائج بعد، وهذا قابل للإصلاح.",
];

// Waiting for the other player.
export const WAITING = [
  "بانتظار حركة اللاعب الآخر.",
  "الدور ليس لك… استمتع بالهدوء المؤقت.",
  "الطرف الآخر يفكّر، أو يتظاهر بذلك.",
];
export function waitingLine(seed?: number): string {
  return pick(WAITING, seed);
}

// Invalid word.
export const INVALID_WORD = [
  "لم نعثر على هذه الكلمة.",
  "تبدو كلمة جميلة، لكن القاموس مختلف معك.",
  "جرّب كلمة أخرى قبل أن نحرج القاموس.",
];
export function invalidWordLine(seed?: number): string {
  return pick(INVALID_WORD, seed);
}

// Hangman wrong-guess quips (dynamic opponent name).
export function wrongGuessLine(opponent?: string | null, seed?: number): string {
  const lines = [
    "محاولة جريئة، لكنها خاطئة.",
    "الحرف بريء من هذه الكلمة.",
    "ما زالت لديك فرصة لإنقاذ الموقف.",
    opponent ? `${opponent} لن ينسى هذه المحاولة.` : "لن تُنسى هذه المحاولة.",
  ];
  return pick(lines, seed);
}

// Result messages, from the current user's perspective. Names are dynamic.
export function resultMessage(
  outcome: "win" | "lose" | "draw",
  opponent?: string | null,
  seed?: number
): string {
  if (outcome === "win") {
    return pick(
      [
        "فوز مستحق… حسب روايتك أنت.",
        "يبدو أن الحظ قرّر مساعدتك اليوم.",
        "انتصار نظيف، سنسمح لك بالتفاخر قليلًا.",
      ],
      seed
    );
  }
  if (outcome === "lose") {
    return pick(
      [
        opponent ? `${opponent} فاز. نحتاج إلى فتح تحقيق.` : "خسارة تستحق تحقيقًا.",
        "كانت قريبة… ثم لم تعد كذلك.",
        "لا بأس، الإعادة موجودة لسبب.",
      ],
      seed
    );
  }
  return pick(
    [
      "تعادل دبلوماسي لتجنّب المشاكل.",
      "لا فائز، ولا أعذار مقنعة.",
      "النتيجة عادلة بشكل مريب.",
    ],
    seed
  );
}
