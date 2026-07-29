"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth";

type Msg = {
  id: number;
  game_id: string;
  sender: string;
  body: string;
  created_at: string;
};

export default function DirectMessage() {
  const params = useParams();
  const friendId = String(params.id || "");
  const { user, loading } = useAuth();
  const [messages, setMessages] = useState<Msg[]>([]);
  const [friendName, setFriendName] = useState("صديق");
  const [text, setText] = useState("");
  const [hasMore, setHasMore] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);

  // Stable conversation key for this pair (persists forever, across games).
  const convo =
    user && friendId ? `dm:${[user.id, friendId].sort().join("_")}` : null;

  // Friend's username.
  useEffect(() => {
    if (!friendId) return;
    supabase
      .from("profiles")
      .select("username")
      .eq("id", friendId)
      .maybeSingle()
      .then(({ data }) => {
        if (data) setFriendName((data as { username: string }).username);
      });
  }, [friendId]);

  const loadLatest = useCallback(async () => {
    if (!convo) return;
    const { data } = await supabase
      .from("messages")
      .select("id, game_id, sender, body, created_at")
      .eq("game_id", convo)
      .order("created_at", { ascending: false })
      .limit(30);
    const list = ((data as Msg[]) ?? []).reverse();
    setMessages(list);
    setHasMore(list.length === 30);
    setTimeout(() => {
      const el = listRef.current;
      if (el) el.scrollTop = el.scrollHeight;
    }, 40);
  }, [convo]);

  useEffect(() => {
    loadLatest();
  }, [loadLatest]);

  // Realtime for new messages in this conversation.
  useEffect(() => {
    if (!convo) return;
    const channel = supabase
      .channel(`dm-${convo}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messages", filter: `game_id=eq.${convo}` },
        (payload) => {
          const m = payload.new as Msg;
          setMessages((prev) => (prev.some((x) => x.id === m.id) ? prev : [...prev, m]));
          setTimeout(() => {
            const el = listRef.current;
            if (el) el.scrollTop = el.scrollHeight;
          }, 30);
        }
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [convo]);

  async function loadOlder() {
    if (!convo || messages.length === 0) return;
    const oldest = messages[0].created_at;
    const { data } = await supabase
      .from("messages")
      .select("id, game_id, sender, body, created_at")
      .eq("game_id", convo)
      .lt("created_at", oldest)
      .order("created_at", { ascending: false })
      .limit(30);
    const older = ((data as Msg[]) ?? []).reverse();
    setMessages((prev) => [...older, ...prev]);
    setHasMore(older.length === 30);
  }

  async function send() {
    const body = text.trim();
    if (!body || !convo || !user) return;
    setText("");
    await supabase
      .from("messages")
      .insert({ game_id: convo, sender: user.id, body });
  }

  if (loading) return <Centered>جارٍ التحميل…</Centered>;
  if (!user)
    return (
      <Centered>
        <p className="mb-4 text-lg">سجّل الدخول لمراسلة أصدقائك.</p>
        <Link href="/account" className="btn-primary rounded-2xl px-6 py-3 font-bold">
          تسجيل الدخول
        </Link>
      </Centered>
    );

  return (
    <main className="mx-auto flex min-h-dvh max-w-lg flex-col px-4 pt-safe pb-safe">
      <header className="flex items-center justify-between border-b border-white/10 py-3">
        <Link href="/friends" className="text-white/60 hover:text-white">
          ← الأصدقاء
        </Link>
        <span className="font-bold">💬 @{friendName}</span>
        <span className="w-12" />
      </header>

      <div ref={listRef} className="flex-1 space-y-2 overflow-y-auto py-3">
        {hasMore && (
          <div className="text-center">
            <button onClick={loadOlder} className="btn-ghost rounded-full px-4 py-1.5 text-xs font-bold">
              تحميل رسائل أقدم
            </button>
          </div>
        )}
        {messages.length === 0 ? (
          <p className="mt-10 text-center text-sm text-white/40">ابدأ المحادثة ❤️</p>
        ) : (
          messages.map((m) => {
            const mine = m.sender === user.id;
            return (
              <div key={m.id} className={`flex ${mine ? "justify-start" : "justify-end"}`}>
                <div
                  className={[
                    "max-w-[78%] whitespace-pre-wrap break-words rounded-2xl px-3.5 py-2 text-[15px] leading-relaxed",
                    mine ? "rounded-bl-md bg-fuchsia-600/80 text-white" : "rounded-br-md bg-white/12 text-white",
                  ].join(" ")}
                >
                  {m.body}
                </div>
              </div>
            );
          })
        )}
      </div>

      <div
        className="flex items-center gap-2 border-t border-white/10 py-3"
        style={{ paddingBottom: "max(0.75rem, env(safe-area-inset-bottom))" }}
      >
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && send()}
          placeholder="اكتب رسالة…"
          dir="rtl"
          enterKeyHint="send"
          className="input-field w-full rounded-2xl px-4 py-3 text-base text-white placeholder:text-white/30"
        />
        <button
          onClick={send}
          disabled={!text.trim()}
          className="btn-primary shrink-0 rounded-2xl px-5 py-3 font-bold disabled:opacity-40"
        >
          إرسال
        </button>
      </div>
    </main>
  );
}

function Centered({ children }: { children: React.ReactNode }) {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center px-6 text-center text-white/80">
      {children}
    </main>
  );
}
