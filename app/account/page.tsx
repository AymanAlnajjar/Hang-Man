"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";
import { useAuth } from "@/lib/auth";

export default function AccountPage() {
  const router = useRouter();
  const { user, profile, loading } = useAuth();
  const [mode, setMode] = useState<"in" | "up">("in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [username, setUsername] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  async function submit() {
    setError(null);
    setInfo(null);
    if (!isSupabaseConfigured) {
      setError("لم يتم ربط قاعدة البيانات بعد.");
      return;
    }
    if (!email.trim() || !password) {
      setError("أدخل البريد وكلمة المرور.");
      return;
    }
    setBusy(true);

    if (mode === "up") {
      const uname = username.trim();
      if (uname.length < 2) {
        setBusy(false);
        setError("اختر اسم مستخدم (حرفين على الأقل).");
        return;
      }
      // Username must be unique.
      const { data: taken } = await supabase
        .from("profiles")
        .select("id")
        .eq("username", uname)
        .maybeSingle();
      if (taken) {
        setBusy(false);
        setError("اسم المستخدم محجوز، جرّب غيره.");
        return;
      }
      const { data, error: signErr } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: { data: { username: uname } },
      });
      if (signErr) {
        setBusy(false);
        setError(friendlyAuthError(signErr.message));
        return;
      }
      if (!data.session) {
        setBusy(false);
        setInfo("تحقّق من بريدك لتأكيد الحساب ثم سجّل الدخول.");
        return;
      }
      // Create the profile now that we have a session.
      await supabase.from("profiles").insert({
        id: data.user!.id,
        username: uname,
        display_name: uname,
      });
      router.push("/friends");
      return;
    }

    const { error: signErr } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });
    setBusy(false);
    if (signErr) {
      setError("بريد أو كلمة مرور غير صحيحة.");
      return;
    }
    router.push("/friends");
  }

  async function signOut() {
    await supabase.auth.signOut();
    setEmail("");
    setPassword("");
    setUsername("");
  }

  if (loading) {
    return <Centered>جارٍ التحميل…</Centered>;
  }

  // Already signed in.
  if (user) {
    return (
      <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center px-5 pt-safe pb-safe">
        <BackLink />
        <div className="glass rounded-3xl p-6 text-center">
          <div className="mb-2 text-4xl">👤</div>
          <h1 className="text-2xl font-bold">مرحبًا {profile?.username ?? ""}</h1>
          <p className="mt-1 text-sm text-white/60">{user.email}</p>
          <Link
            href="/friends"
            className="btn-primary mt-5 block rounded-2xl py-3 font-bold"
          >
            👥 الأصدقاء والدعوات
          </Link>
          <button
            onClick={signOut}
            className="btn-ghost mt-3 w-full rounded-2xl py-3 font-bold"
          >
            تسجيل الخروج
          </button>
        </div>
      </main>
    );
  }

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center px-5 pt-safe pb-safe">
      <BackLink />
      <div className="mb-6 text-center">
        <div className="mb-2 text-5xl animate-floaty">🔐</div>
        <h1 className="text-3xl font-extrabold">
          {mode === "in" ? "تسجيل الدخول" : "إنشاء حساب"}
        </h1>
        <p className="mt-1 text-sm text-white/60">
          حساب واحد لك، لتضيف شريكك كصديق وتدعوه للألعاب مباشرة.
        </p>
      </div>

      <div className="glass rounded-3xl p-6">
        {mode === "up" && (
          <input
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="اسم المستخدم"
            dir="rtl"
            className="input-field mb-3 w-full rounded-2xl px-4 py-3 text-white placeholder:text-white/30"
          />
        )}
        <input
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="البريد الإلكتروني"
          type="email"
          dir="ltr"
          autoComplete="email"
          className="input-field mb-3 w-full rounded-2xl px-4 py-3 text-white placeholder:text-white/30"
        />
        <input
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && submit()}
          placeholder="كلمة المرور"
          type="password"
          dir="ltr"
          autoComplete={mode === "in" ? "current-password" : "new-password"}
          className="input-field mb-4 w-full rounded-2xl px-4 py-3 text-white placeholder:text-white/30"
        />

        <button
          onClick={submit}
          disabled={busy}
          className="btn-primary w-full rounded-2xl py-3 text-lg font-bold disabled:opacity-50"
        >
          {busy ? "…" : mode === "in" ? "دخول" : "إنشاء الحساب"}
        </button>

        {error && (
          <p className="mt-3 rounded-xl bg-rose-500/15 px-4 py-2 text-center text-sm text-rose-200">
            {error}
          </p>
        )}
        {info && (
          <p className="mt-3 rounded-xl bg-emerald-500/15 px-4 py-2 text-center text-sm text-emerald-200">
            {info}
          </p>
        )}

        <button
          onClick={() => {
            setMode(mode === "in" ? "up" : "in");
            setError(null);
            setInfo(null);
          }}
          className="mt-4 w-full text-center text-sm text-white/60 hover:text-white"
        >
          {mode === "in" ? "ليس لديك حساب؟ أنشئ واحدًا" : "لديك حساب؟ سجّل الدخول"}
        </button>
      </div>
    </main>
  );
}

function friendlyAuthError(m: string): string {
  const s = m.toLowerCase();
  if (s.includes("rate limit"))
    return "تجاوزت حدّ إرسال البريد. أطفئ «تأكيد البريد» في إعدادات Supabase (Authentication → Providers → Email)، أو انتظر ساعة.";
  if (s.includes("already") && s.includes("regist"))
    return "هذا البريد مسجّل بالفعل — سجّل الدخول بدلًا من ذلك.";
  if (s.includes("password"))
    return "كلمة المرور قصيرة (٦ أحرف على الأقل).";
  if (s.includes("valid email") || s.includes("invalid email"))
    return "البريد الإلكتروني غير صحيح.";
  return m;
}

function BackLink() {
  return (
    <Link
      href="/"
      className="mb-4 inline-flex items-center gap-1 self-start text-sm text-white/50 hover:text-white"
    >
      ← كل الألعاب
    </Link>
  );
}

function Centered({ children }: { children: React.ReactNode }) {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center px-6 text-center text-white/80">
      {children}
    </main>
  );
}
