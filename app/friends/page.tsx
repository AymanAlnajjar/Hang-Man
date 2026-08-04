"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth";
import { getPlayerId } from "@/lib/player";
import { GAME_META, type GameType, createRoom } from "@/lib/rooms";
import AppShell from "@/components/layout/AppShell";
import Button from "@/components/ui/Button";
import EmptyState from "@/components/ui/EmptyState";

type Friendship = {
  id: number;
  requester: string;
  addressee: string;
  status: "pending" | "accepted";
};
type Profile = { id: string; username: string };

export default function FriendsPage() {
  const router = useRouter();
  const { user, profile, loading } = useAuth();
  const [rows, setRows] = useState<Friendship[]>([]);
  const [profiles, setProfiles] = useState<Record<string, string>>({});
  const [search, setSearch] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [inviteFor, setInviteFor] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase
      .from("friendships")
      .select("*")
      .or(`requester.eq.${user.id},addressee.eq.${user.id}`);
    const list = (data as Friendship[]) ?? [];
    setRows(list);
    const ids = new Set<string>();
    list.forEach((f) => {
      ids.add(f.requester);
      ids.add(f.addressee);
    });
    if (ids.size) {
      const { data: profs } = await supabase
        .from("profiles")
        .select("id, username")
        .in("id", [...ids]);
      const map: Record<string, string> = {};
      (profs as Profile[] | null)?.forEach((p) => (map[p.id] = p.username));
      setProfiles(map);
    }
  }, [user]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel(`friends-${user.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "friendships" }, () => load())
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, load]);

  async function sendRequest() {
    setMsg(null);
    const uname = search.trim();
    if (!uname || !user) return;
    if (uname === profile?.username) {
      setMsg("لا يمكنك إضافة نفسك 🙂");
      return;
    }
    const { data: found } = await supabase
      .from("profiles")
      .select("id, username")
      .eq("username", uname)
      .maybeSingle();
    if (!found) {
      setMsg("لا يوجد مستخدم بهذا الاسم.");
      return;
    }
    const target = found as Profile;
    const exists = rows.find(
      (f) =>
        (f.requester === user.id && f.addressee === target.id) ||
        (f.requester === target.id && f.addressee === user.id)
    );
    if (exists) {
      setMsg("بينكما طلب أو صداقة بالفعل.");
      return;
    }
    const { error } = await supabase
      .from("friendships")
      .insert({ requester: user.id, addressee: target.id, status: "pending" });
    if (error) setMsg("تعذّر إرسال الطلب.");
    else {
      setMsg(`تم إرسال الطلب إلى ${target.username} ✓`);
      setSearch("");
      load();
    }
  }

  async function accept(id: number) {
    await supabase.from("friendships").update({ status: "accepted" }).eq("id", id);
    load();
  }
  async function remove(id: number) {
    await supabase.from("friendships").delete().eq("id", id);
    load();
  }

  async function invite(friendAuthId: string, type: GameType) {
    if (!user) return;
    const me = getPlayerId();
    const code = await createRoom(type, me);
    if (!code) {
      setMsg("تعذّر إنشاء الغرفة.");
      return;
    }
    await supabase.from("invites").insert({
      from_user: user.id,
      to_user: friendAuthId,
      game_type: type,
      room_code: code,
    });
    router.push(GAME_META[type].route(code));
  }

  if (loading)
    return (
      <AppShell>
        <p className="mt-16 text-center text-ink-soft">جارٍ التحميل…</p>
      </AppShell>
    );
  if (!user)
    return (
      <AppShell>
        <div className="mt-6">
          <EmptyState
            icon="🔐"
            title="سجّل الدخول أولًا"
            hint="بحساب تضيف شريكك كصديق وتدعوه للألعاب مباشرة."
            action={
              <Link href="/account">
                <Button variant="primary">تسجيل الدخول</Button>
              </Link>
            }
          />
        </div>
      </AppShell>
    );

  const incoming = rows.filter((f) => f.addressee === user.id && f.status === "pending");
  const outgoing = rows.filter((f) => f.requester === user.id && f.status === "pending");
  const friends = rows.filter((f) => f.status === "accepted");
  const other = (f: Friendship) => (f.requester === user.id ? f.addressee : f.requester);

  return (
    <AppShell>
      <header className="flex items-center justify-between pt-2">
        <h1 className="text-2xl font-extrabold">الأصدقاء</h1>
        <span className="chip chip-primary">@{profile?.username}</span>
      </header>

      {/* Add friend */}
      <div className="card mt-4 bg-surface p-4">
        <label className="mb-2 block text-sm font-bold text-ink-soft">
          إضافة صديق باسم المستخدم
        </label>
        <div className="flex gap-2">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && sendRequest()}
            placeholder="اسم المستخدم"
            dir="rtl"
            className="input-field w-full px-4 py-2.5"
          />
          <button onClick={sendRequest} className="btn btn-primary shrink-0">
            إضافة
          </button>
        </div>
        {msg && <p className="mt-3 text-center text-sm text-ink-soft">{msg}</p>}
      </div>

      {/* Incoming requests */}
      {incoming.length > 0 && (
        <section className="mt-4">
          <h2 className="mb-2 text-sm font-bold text-ink-soft">طلبات واردة</h2>
          <div className="flex flex-col gap-2">
            {incoming.map((f) => (
              <div key={f.id} className="card flex items-center justify-between bg-surface p-3">
                <span className="font-bold">@{profiles[other(f)] ?? "…"}</span>
                <div className="flex gap-2">
                  <button onClick={() => accept(f.id)} className="btn btn-primary min-h-[40px] px-4 text-sm">
                    قبول
                  </button>
                  <button onClick={() => remove(f.id)} className="btn btn-ghost min-h-[40px] px-3 text-sm">
                    رفض
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Friends */}
      <section className="mt-4">
        <h2 className="mb-2 text-sm font-bold text-ink-soft">أصدقائي ({friends.length})</h2>
        {friends.length === 0 ? (
          <p className="text-sm text-ink-soft">لا أصدقاء بعد — أضف شريكك أعلاه ❤️</p>
        ) : (
          <div className="flex flex-col gap-2">
            {friends.map((f) => {
              const fid = other(f);
              return (
                <div key={f.id} className="card bg-surface p-3">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-bold">@{profiles[fid] ?? "…"}</span>
                    <div className="flex gap-2">
                      <Link
                        href={`/dm/${fid}`}
                        className="btn btn-ghost min-h-[40px] px-3 text-sm"
                        aria-label="مراسلة"
                      >
                        💬
                      </Link>
                      <button
                        onClick={() => setInviteFor(inviteFor === fid ? null : fid)}
                        className="btn btn-primary min-h-[40px] px-4 text-sm"
                      >
                        🎮 العب
                      </button>
                      <button onClick={() => remove(f.id)} className="btn btn-ghost min-h-[40px] px-3 text-sm">
                        حذف
                      </button>
                    </div>
                  </div>
                  {inviteFor === fid && (
                    <div className="mt-3 grid grid-cols-3 gap-2">
                      {(Object.keys(GAME_META) as GameType[]).map((t) => (
                        <button
                          key={t}
                          onClick={() => invite(fid, t)}
                          className="rounded-md border-2 border-ink bg-surface-strong p-2 text-center active:translate-y-0.5"
                        >
                          <div className="text-xl">{GAME_META[t].emoji}</div>
                          <div className="mt-0.5 text-[11px] font-bold leading-tight">{GAME_META[t].name}</div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* Outgoing */}
      {outgoing.length > 0 && (
        <section className="mt-4">
          <h2 className="mb-2 text-sm font-bold text-ink-soft">طلبات مُرسلة</h2>
          <div className="flex flex-col gap-2">
            {outgoing.map((f) => (
              <div key={f.id} className="card flex items-center justify-between bg-surface px-4 py-2.5 text-sm">
                <span className="text-ink-soft">@{profiles[other(f)] ?? "…"}</span>
                <span className="text-ink-soft">بانتظار القبول…</span>
              </div>
            ))}
          </div>
        </section>
      )}
    </AppShell>
  );
}
