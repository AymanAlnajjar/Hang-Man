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
      .order("created_at", { ascending: false })
      .limit(50)
      .then(({ data }) => {
        if (active && data) setMessages((data as Msg[]).reverse());
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
        className="fixed bottom-5 left-4 z-40 flex h-14 w-14 items-center justify-center rounded-md border-2 border-ink bg-coral text-2xl text-ink shadow-card-sm active:translate-y-0.5"
        style={{ zIndex: "var(--z-overlay)", bottom: "max(1.25rem, env(safe-area-inset-bottom))" }}
      >
        {open ? "✕" : "💬"}
        {!open && unread > 0 && (
          <span className="absolute -right-1.5 -top-1.5 flex h-6 min-w-6 items-center justify-center rounded-pill border-2 border-ink bg-danger px-1.5 text-xs font-bold text-white">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>

      {/* Slide-up panel */}
      {open && (
        <div className="fixed inset-0 flex items-end justify-center" style={{ zIndex: "var(--z-modal)" }}>
          <div
            className="absolute inset-0 bg-ink/45"
            onClick={() => setOpen(false)}
          />
          <div
            dir="rtl"
            className="relative flex w-full max-w-[480px] flex-col rounded-t-lg border-2 border-b-0 border-ink bg-surface"
            style={{ height: "72dvh" }}
          >
            <div className="flex items-center justify-between border-b-2 border-ink px-5 py-3">
              <span className="font-bold">💬 الدردشة</span>
              <button
                onClick={() => setOpen(false)}
                className="grid h-9 w-9 place-items-center rounded-md border-2 border-ink bg-surface-strong text-ink"
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
                <p className="mt-10 text-center text-sm text-ink-soft">
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
                          "max-w-[78%] whitespace-pre-wrap break-words rounded-md border-2 border-ink px-3.5 py-2 text-[15px] leading-relaxed",
                          mine
                            ? "bg-primary text-white"
                            : "bg-surface-strong text-ink",
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
              className="flex items-center gap-2 border-t-2 border-ink p-3"
              style={{ paddingBottom: "max(0.75rem, env(safe-area-inset-bottom))" }}
            >
              <input
                value={text}
                onChange={(e) => setText(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && send()}
                placeholder="اكتب رسالة…"
                enterKeyHint="send"
                className="input-field w-full px-4 py-3 text-base text-ink"
              />
              <button
                onClick={send}
                disabled={!text.trim()}
                className="btn btn-primary shrink-0"
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
