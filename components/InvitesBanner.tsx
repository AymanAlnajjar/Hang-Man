"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth";
import { GAME_META, type GameType } from "@/lib/rooms";

type Invite = {
  id: number;
  from_user: string;
  to_user: string;
  game_type: GameType;
  room_code: string;
  status: string;
};

// Shows pending game invites addressed to the signed-in user, with accept/ignore.
export default function InvitesBanner() {
  const router = useRouter();
  const { user } = useAuth();
  const [invites, setInvites] = useState<Invite[]>([]);
  const [names, setNames] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase
      .from("invites")
      .select("*")
      .eq("to_user", user.id)
      .eq("status", "pending")
      .order("created_at", { ascending: false });
    const list = (data as Invite[]) ?? [];
    setInvites(list);
    const ids = [...new Set(list.map((i) => i.from_user))];
    if (ids.length) {
      const { data: profs } = await supabase
        .from("profiles")
        .select("id, username")
        .in("id", ids);
      const map: Record<string, string> = {};
      (profs as { id: string; username: string }[] | null)?.forEach(
        (p) => (map[p.id] = p.username)
      );
      setNames(map);
    }
  }, [user]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel(`invites-${user.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "invites" }, () => load())
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, load]);

  async function accept(inv: Invite) {
    await supabase.from("invites").update({ status: "accepted" }).eq("id", inv.id);
    const meta = GAME_META[inv.game_type];
    if (meta) router.push(meta.route(inv.room_code));
  }
  async function ignore(inv: Invite) {
    await supabase.from("invites").update({ status: "declined" }).eq("id", inv.id);
    setInvites((prev) => prev.filter((i) => i.id !== inv.id));
  }

  if (!user || invites.length === 0) return null;

  return (
    <div className="mb-4 flex flex-col gap-2">
      {invites.map((inv) => {
        const meta = GAME_META[inv.game_type];
        return (
          <div
            key={inv.id}
            className="card flex items-center justify-between gap-2 bg-yellow-soft p-3"
          >
            <div className="min-w-0 text-sm">
              <span className="font-bold">@{names[inv.from_user] ?? "صديق"}</span> دعاك للعب{" "}
              <span className="font-bold">
                {meta?.emoji} {meta?.name ?? inv.game_type}
              </span>
            </div>
            <div className="flex shrink-0 gap-2">
              <button
                onClick={() => accept(inv)}
                className="btn btn-primary min-h-[40px] px-4 text-sm"
              >
                دخول
              </button>
              <button
                onClick={() => ignore(inv)}
                className="btn btn-ghost min-h-[40px] px-3 text-sm"
              >
                تجاهل
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
