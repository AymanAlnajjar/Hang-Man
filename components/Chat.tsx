"use client";

import { useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";

type Msg = {
  id: number;
  game_id: string;
  sender: string;
  sender_role: string | null;
  body: string;
  created_at: string;
};

// A slide-up chat panel with a floating toggle button. Messages persist in the
// `messages` table and arrive live via Supabase Realtime.
export default function Chat({
  code,
  me,
  role,
}: {
  code: string;
  me: string;
  role: "a" | "b";
}) {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [text, setText] = useState("");
  const [unread, setUnread] = useState(0);
  const listRef = useRef<HTMLDivElement>(null);
  const openRef = useRef(open);
  openRef.current = open;

  // Load history + subscribe to new messages.
  useEffect(() => {
    let active = true;
    supabase
      .from("messages")
      .select("*")
      .eq("game_id", code)
      .order("created_at", { ascending: true })
      .limit(300)
      .then(({ data }) => {
        if (active && data) setMessages(data as Msg[]);
      });

    const channel = supabase
      .channel(`chat-${code}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
          filter: `game_id=eq.${code}`,
        },
        (payload) => {
          const m = payload.new as Msg;
          setMessages((prev) =>
            prev.some((x) => x.id === m.id) ? prev : [...prev, m]
          );
          if (!openRef.current && m.sender !== me) {
            setUnread((u) => u + 1);
          }
        }
      )
      .subscribe();

    return () => {
      active = false;
      supabase.removeChannel(channel);
    };
  }, [code, me]);

  // Clear the unread badge and scroll to the newest message when opened.
  useEffect(() => {
    if (!open) return;
    setUnread(0);
    const t = setTimeout(() => {
      const el = listRef.current;
      if (el) el.scrollTop = el.scrollHeight;
    }, 40);
    return () => clearTimeout(t);
  }, [open, messages.length]);

  async function send() {
    const body = text.trim();
    if (!body) return;
    setText("");
    await supabase
      .from("messages")
      .insert({ game_id: code, sender: me, sender_role: role, body });
  }

  return (
    <>
      {/* Floating toggle */}
      <button
        onClick={() => setOpen((o) => !o)}
        aria-label="الدردشة"
        className="fixed bottom-4 left-4 z-40 flex h-14 w-14 items-center justify-center rounded-full text-2xl shadow-lg"
        style={{ background: "linear-gradient(135deg,#d946ef,#8b5cf6)" }}
      >
        {open ? "✕" : "💬"}
        {!open && unread > 0 && (
          <span className="absolute -right-1 -top-1 flex h-6 min-w-6 items-center justify-center rounded-full bg-rose-500 px-1.5 text-xs font-bold text-white">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>

      {/* Slide-up panel */}
      {open && (
        <div className="fixed inset-0 z-50 flex items-end justify-center">
          <div
            className="absolute inset-0 bg-black/50"
            onClick={() => setOpen(false)}
          />
          <div
            dir="rtl"
            className="glass relative flex w-full max-w-lg flex-col rounded-t-3xl"
            style={{ height: "72dvh" }}
          >
            <div className="flex items-center justify-between border-b border-white/10 px-5 py-3">
              <span className="font-bold">💬 الدردشة</span>
              <button
                onClick={() => setOpen(false)}
                className="text-white/60 hover:text-white"
                aria-label="إغلاق"
              >
                ✕
              </button>
            </div>

            <div
              ref={listRef}
              className="flex-1 space-y-2 overflow-y-auto px-4 py-3"
            >
              {messages.length === 0 ? (
                <p className="mt-10 text-center text-sm text-white/40">
                  ابدأ المحادثة… قل شيئًا لطيفًا ❤️
                </p>
              ) : (
                messages.map((m) => {
                  const mine = m.sender === me;
                  return (
                    <div
                      key={m.id}
                      className={`flex ${mine ? "justify-start" : "justify-end"}`}
                    >
                      <div
                        className={[
                          "max-w-[78%] whitespace-pre-wrap break-words rounded-2xl px-3.5 py-2 text-[15px] leading-relaxed",
                          mine
                            ? "rounded-bl-md bg-fuchsia-600/80 text-white"
                            : "rounded-br-md bg-white/12 text-white",
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
              className="flex items-center gap-2 border-t border-white/10 p-3"
              style={{ paddingBottom: "max(0.75rem, env(safe-area-inset-bottom))" }}
            >
              <input
                value={text}
                onChange={(e) => setText(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && send()}
                placeholder="اكتب رسالة…"
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
          </div>
        </div>
      )}
    </>
  );
}
