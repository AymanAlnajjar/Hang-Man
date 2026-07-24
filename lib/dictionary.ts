import { normalizeArabic, ARABIC_LETTERS } from "@/lib/arabic";
import { CATEGORIES } from "@/lib/words";

// The dictionary has two layers:
//  1) a small curated list, seeded synchronously so the game works instantly;
//  2) a big list (~18k common words in /public/ar-words.txt) loaded at runtime
//     the first time a Word-Grid game starts.
// Words are normalized the same way the game normalizes traced words, so a word
// on the board matches an entry here.

const EXTRA: string[] = [
  "يوم", "ليل", "نهار", "صباح", "مساء", "شهر", "سنة", "وقت", "ساعة", "شمس",
  "قمر", "نجم", "سماء", "ارض", "بحر", "نهر", "جبل", "مطر", "ثلج", "ريح",
  "رعد", "برق", "غيم", "نار", "ماء", "هواء", "تراب", "رمل", "نور", "ظلام",
  "رجل", "امراة", "ولد", "بنت", "طفل", "صديق", "جار", "ملك", "ناس", "شعب",
  "راس", "عين", "انف", "قدم", "قلب", "شعر", "وجه", "اذن", "ظهر", "بطن",
  "خبز", "لحم", "ارز", "ملح", "سكر", "عسل", "لبن", "جبن", "زيت", "شاي",
  "قهوة", "تمر", "عنب", "تفاح", "موز", "حليب", "بيض", "سمك", "دجاج", "لوز",
  "بيت", "باب", "دار", "شباك", "كرسي", "سرير", "طاولة", "مفتاح", "كتاب", "قلم",
  "ورق", "صحن", "كاس", "ملعقة", "سكين", "ثوب", "حذاء", "مراة", "سجادة", "صندوق",
  "مدينة", "قرية", "شارع", "سوق", "مدرسة", "مسجد", "حديقة", "ملعب", "مطار", "طريق",
  "سيارة", "طيارة", "قطار", "سفينة", "دراجة", "حصان", "قارب", "شاحنة",
  "كبير", "صغير", "طويل", "قصير", "جديد", "قديم", "جميل", "بعيد", "قريب", "سريع",
  "علم", "عمل", "درس", "لعب", "اكل", "شرب", "نام", "مشى", "جرى", "قرا",
  "كتب", "سمع", "راى", "قال", "ذهب", "جاء", "وقف", "جلس", "قام", "فتح",
  "احمر", "ازرق", "اخضر", "اصفر", "ابيض", "اسود", "ذهب", "فضة", "حديد", "خشب",
  "قط", "كلب", "فار", "اسد", "نمر", "فيل", "بقرة", "خروف", "ثعلب", "غزال",
  "سلام", "خير", "عدل", "صدق", "فكر", "حلم", "امل", "خوف", "فرح", "غضب",
  "صوت", "لون", "اسم", "لغة", "كلمة", "حرف", "سؤال", "جواب", "عمر", "عقل",
];

const allowed = new Set(ARABIC_LETTERS);
function acceptable(w: string): boolean {
  const len = w.length;
  if (len < 3 || len > 15) return false;
  for (const ch of w) if (!allowed.has(ch)) return false;
  return true;
}

const DICTIONARY = new Set<string>();
const PLANTABLE: string[] = []; // 3–6 letter words, used to seed grids

function addWord(raw: string): void {
  const w = normalizeArabic(raw);
  if (!acceptable(w) || DICTIONARY.has(w)) return;
  DICTIONARY.add(w);
  if (w.length <= 6) PLANTABLE.push(w);
}

// Seed the curated words immediately (synchronous, always available).
for (const cat of CATEGORIES) for (const w of cat.words) addWord(w);
for (const w of EXTRA) addWord(w);

export function isWord(word: string): boolean {
  const w = normalizeArabic(word);
  if (DICTIONARY.has(w)) return true;
  // Definite-article forms also count: "ال" + a known base word.
  // e.g. نمر (base) → النمر, شمس → الشمس. Scored by their own (longer) length.
  if (w.startsWith("ال")) {
    const base = w.slice(2);
    if (base.length >= 3 && DICTIONARY.has(base)) return true;
  }
  return false;
}

export function plantableWords(): string[] {
  return PLANTABLE;
}

export function dictionarySize(): number {
  return DICTIONARY.size;
}

// Fetch and merge the big word list. Cached so it only ever runs once.
let loadPromise: Promise<void> | null = null;
export function loadFullDictionary(): Promise<void> {
  if (loadPromise) return loadPromise;
  loadPromise = (async () => {
    try {
      const res = await fetch("/ar-words.txt");
      if (!res.ok) return;
      const text = await res.text();
      for (const line of text.split("\n")) {
        const w = line.trim();
        if (w) addWord(w);
      }
    } catch {
      /* keep the curated fallback if the fetch fails */
    }
  })();
  return loadPromise;
}
