"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";
import { useAuth } from "@/lib/auth";
import AppShell from "@/components/layout/AppShell";
import Button from "@/components/ui/Button";

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
    return (
      <AppShell>
        <p className="mt-16 text-center text-ink-soft">جارٍ التحميل…</p>
      </AppShell>
    );
  }

  // Already signed in.
  if (user) {
    return (
      <AppShell>
        <header className="pt-2">
          <h1 className="text-2xl font-extrabold">حسابنا</h1>
        </header>
        <div className="card mt-4 bg-surface p-6 text-center">
          <div
            className="mx-auto mb-3 grid h-16 w-16 place-items-center rounded-md border-2 border-ink bg-primary-soft text-3xl"
            aria-hidden
          >
            🌷
          </div>
          <h2 className="text-xl font-extrabold">
            مرحبًا {profile?.username ?? ""}
          </h2>
          <p className="mt-1 text-sm text-ink-soft">{user.email}</p>
          <Link href="/friends" className="mt-5 block">
            <Button variant="primary" block>
              👥 الأصدقاء والدعوات
            </Button>
          </Link>
          <button
            onClick={signOut}
            className="btn btn-ghost mt-3 w-full"
          >
            تسجيل الخروج
          </button>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="mb-5 mt-4 text-center">
        <div className="mb-2 text-5xl animate-floaty" aria-hidden>🔐</div>
        <h1 className="text-2xl font-extrabold">
          {mode === "in" ? "تسجيل الدخول" : "إنشاء حساب"}
        </h1>
        <p className="mt-1 text-sm text-ink-soft">
          حساب واحد لك، لتضيف شريكك كصديق وتدعوه للألعاب مباشرة.
        </p>
      </div>

      <div className="card bg-surface p-6">
        {mode === "up" && (
          <input
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="اسم المستخدم"
            dir="rtl"
            className="input-field mb-3 w-full px-4 py-3"
          />
        )}
        <input
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="البريد الإلكتروني"
          type="email"
          dir="ltr"
          autoComplete="email"
          className="input-field mb-3 w-full px-4 py-3"
        />
        <input
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && submit()}
          placeholder="كلمة المرور"
          type="password"
          dir="ltr"
          autoComplete={mode === "in" ? "current-password" : "new-password"}
          className="input-field mb-4 w-full px-4 py-3"
        />

        <Button onClick={submit} loading={busy} variant="primary" block>
          {mode === "in" ? "دخول" : "إنشاء الحساب"}
        </Button>

        {error && (
          <p className="mt-3 rounded-md border-2 border-ink bg-danger-soft px-4 py-2 text-center text-sm text-ink">
            {error}
          </p>
        )}
        {info && (
          <p className="mt-3 rounded-md border-2 border-ink bg-success-soft px-4 py-2 text-center text-sm text-ink">
            {info}
          </p>
        )}

        <button
          onClick={() => {
            setMode(mode === "in" ? "up" : "in");
            setError(null);
            setInfo(null);
          }}
          className="mt-4 w-full text-center text-sm font-bold text-ink-soft"
        >
          {mode === "in" ? "ليس لديك حساب؟ أنشئ واحدًا" : "لديك حساب؟ سجّل الدخول"}
        </button>
      </div>
    </AppShell>
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
