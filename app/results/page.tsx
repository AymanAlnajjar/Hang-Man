"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth";
import { fetchHeadToHead, type H2H } from "@/lib/scores";
import AppShell from "@/components/layout/AppShell";
import Button from "@/components/ui/Button";
import EmptyState from "@/components/ui/EmptyState";
import { SkeletonList } from "@/components/ui/Skeleton";

type Rival = { id: string; username: string; h2h: H2H };

export default function ResultsPage() {
  const { user, loading } = useAuth();
  const [rivals, setRivals] = useState<Rival[] | null>(null);

  const load = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase
      .from("friendships")
      .select("requester, addressee, status")
      .or(`requester.eq.${user.id},addressee.eq.${user.id}`)
      .eq("status", "accepted");
    const rows = (data as { requester: string; addressee: string }[]) ?? [];
    const otherIds = rows.map((r) =>
      r.requester === user.id ? r.addressee : r.requester
    );
    if (otherIds.length === 0) {
      setRivals([]);
      return;
    }
    const { data: profs } = await supabase
      .from("profiles")
      .select("id, username")
      .in("id", otherIds);
    const nameMap: Record<string, string> = {};
    (profs as { id: string; username: string }[] | null)?.forEach(
      (p) => (nameMap[p.id] = p.username)
    );
    const list = await Promise.all(
      otherIds.map(async (id) => ({
        id,
        username: nameMap[id] ?? "صديق",
        h2h: await fetchHeadToHead(user.id, id, user.id),
      }))
    );
    // Most-played rivalries first.
    list.sort((a, b) => b.h2h.mine + b.h2h.theirs - (a.h2h.mine + a.h2h.theirs));
    setRivals(list);
  }, [user]);

  useEffect(() => {
    if (!loading) load();
  }, [loading, load]);

  return (
    <AppShell>
      <header className="pt-2">
        <h1 className="text-2xl font-extrabold">النتائج</h1>
        <p className="mt-1 text-sm text-ink-soft">
          سجلّ المواجهات في الألعاب التنافسية — من يتصدّر بينكما؟
        </p>
      </header>

      <div className="mt-4">
        {loading || (user && rivals === null) ? (
          <SkeletonList count={2} />
        ) : !user ? (
          <EmptyState
            icon="🔐"
            title="سجّلا الدخول لحفظ النتائج"
            hint="بحساب لكلٍّ منكما نتذكّر كل فوز ونعرض سجلّ المواجهات."
            action={
              <Link href="/account">
                <Button variant="primary">تسجيل الدخول</Button>
              </Link>
            }
          />
        ) : rivals && rivals.length === 0 ? (
          <EmptyState
            icon="🫥"
            title="لا يوجد خصم بعد"
            hint="أضيفا بعضكما كصديقين، والعبا لعبة تنافسية لتبدأ الحكاية."
            action={
              <Link href="/account">
                <Button variant="primary">إضافة صديق</Button>
              </Link>
            }
          />
        ) : (
          <div className="flex flex-col gap-3">
            {rivals!.map((r) => {
              const total = r.h2h.mine + r.h2h.theirs;
              const lead =
                r.h2h.mine === r.h2h.theirs
                  ? "متعادلان"
                  : r.h2h.mine > r.h2h.theirs
                  ? "أنت المتصدّر"
                  : `${r.username} المتصدّر`;
              const diff = Math.abs(r.h2h.mine - r.h2h.theirs);
              return (
                <div key={r.id} className="card bg-surface p-5">
                  <div className="mb-3 flex items-center justify-between">
                    <span className="chip chip-yellow">🏆 {lead}</span>
                    <span className="text-xs text-ink-soft">
                      {total > 0 ? `${total} مباراة` : "لم تلعبا بعد"}
                    </span>
                  </div>
                  <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 text-center">
                    <div>
                      <div className="text-sm font-bold text-ink-soft">أنت</div>
                      <div className="text-4xl font-extrabold tabular-nums text-primary-dark">
                        {r.h2h.mine}
                      </div>
                    </div>
                    <div className="text-lg text-ink-soft">—</div>
                    <div>
                      <div className="truncate text-sm font-bold text-ink-soft">
                        @{r.username}
                      </div>
                      <div className="text-4xl font-extrabold tabular-nums text-coral">
                        {r.h2h.theirs}
                      </div>
                    </div>
                  </div>
                  {total > 0 && diff > 0 && (
                    <p className="mt-3 text-center text-xs text-ink-soft">
                      الفارق {diff} — {diff >= 3 ? "الوضع محرج قليلًا." : "لا شيء لا يمكن تعويضه."}
                    </p>
                  )}
                  <div className="mt-4">
                    <Link href={`/dm/${r.id}`}>
                      <Button variant="ghost" block>
                        💬 مراسلة @{r.username}
                      </Button>
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </AppShell>
  );
}
