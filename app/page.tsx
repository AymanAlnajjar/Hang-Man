"use client";

import Link from "next/link";
import { useAuth } from "@/lib/auth";
import InvitesBanner from "@/components/InvitesBanner";

const GAMES = [
  {
    href: "/hangman",
    emoji: "🎯",
    name: "المشنقة",
    desc: "خمّنا الكلمة حرفًا حرفًا قبل أن يكتمل الرسم.",
    tag: "٣ أنماط",
  },
  {
    href: "/wordbox",
    emoji: "🔤",
    name: "تكوين الكلمات",
    desc: "كوّنا أكبر عدد من الكلمات من الحروف قبل انتهاء الوقت.",
    tag: "تنافسي",
  },
  {
    href: "/meld",
    emoji: "🧠",
    name: "توارد الأفكار",
    desc: "كلٌّ يكتب كلمة سرًّا — والهدف أن تتطابقا في الكلمة نفسها.",
    tag: "تعاوني",
  },
  {
    href: "/stop",
    emoji: "🅰️",
    name: "اسم حيوان جماد",
    desc: "حرف عشوائي، واملآ التصنيفات بأسرع وقت. الأكثر نقاطًا يفوز.",
    tag: "تنافسي",
  },
  {
    href: "/wordle",
    emoji: "🟩",
    name: "وردل",
    desc: "خمّنا الكلمة المخفية في ٦ محاولات — من يحلّها بمحاولات أقل يفوز.",
    tag: "تنافسي",
  },
];

export default function Hub() {
  const { user, profile } = useAuth();
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center px-5 py-6 pt-safe pb-safe">
      {/* Account bar */}
      <div className="mb-4 mt-1 flex items-center justify-between">
        {user ? (
          <Link
            href="/friends"
            className="glass rounded-full px-4 py-2 text-sm font-bold hover:border-fuchsia-400/60"
          >
            👥 الأصدقاء
          </Link>
        ) : (
          <Link
            href="/account"
            className="glass rounded-full px-4 py-2 text-sm font-bold hover:border-fuchsia-400/60"
          >
            🔐 تسجيل الدخول
          </Link>
        )}
        <Link href="/account" className="text-sm text-white/60 hover:text-white">
          {user ? `@${profile?.username ?? "حسابي"}` : "بدون حساب"}
        </Link>
      </div>

      <InvitesBanner />

      <div className="mb-8 text-center">
        <div className="mb-3 text-5xl animate-floaty">🎮</div>
        <h1 className="text-4xl font-extrabold tracking-tight">ألعاب الكلمات</h1>
        <p className="mt-2 text-white/60">
          اختاروا لعبة، أنشئوا غرفة، وادعُوا صديقكم — أو شاركوا الرابط. ❤️
        </p>
      </div>

      <div className="flex flex-col gap-3">
        {GAMES.map((g) => (
          <Link
            key={g.href}
            href={g.href}
            className="glass group flex items-center gap-4 rounded-3xl p-5 transition-all hover:-translate-y-0.5 hover:border-fuchsia-400/60"
          >
            <div className="grid h-16 w-16 shrink-0 place-items-center rounded-2xl bg-white/5 text-4xl">
              {g.emoji}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-bold">{g.name}</h2>
                <span className="rounded-full bg-fuchsia-500/20 px-2 py-0.5 text-[11px] font-bold text-fuchsia-200">
                  {g.tag}
                </span>
              </div>
              <p className="mt-1 text-sm leading-snug text-white/55">{g.desc}</p>
            </div>
            <div className="shrink-0 text-2xl text-white/30 transition-transform group-hover:-translate-x-1">
              ‹
            </div>
          </Link>
        ))}
      </div>

      <p className="mt-8 text-center text-xs text-white/40">
        المزيد من الألعاب قريبًا…
      </p>
    </main>
  );
}
