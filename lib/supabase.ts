import { createClient } from "@supabase/supabase-js";

// Placeholders keep `next build` from crashing when env vars are absent
// (e.g. during CI). The real values must be set in Vercel for the app to work.
const url =
  process.env.NEXT_PUBLIC_SUPABASE_URL || "https://placeholder.supabase.co";
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "public-anon-placeholder";

export const supabase = createClient(url, key, {
  realtime: { params: { eventsPerSecond: 10 } },
});

export const isSupabaseConfigured = Boolean(
  process.env.NEXT_PUBLIC_SUPABASE_URL &&
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);
