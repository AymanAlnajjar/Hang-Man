# 🎯 لعبة المشنقة — Arabic Hangman (2-player, online)

A real-time, two-player Arabic Hangman game built for playing together across
any distance. One person creates a room and shares the link; the other joins.
Each round, one player secretly chooses an Arabic word and the other guesses it
letter by letter on a beautiful on-screen Arabic keyboard. Roles swap every
round.

- **Frontend:** Next.js (React) → hosted on **Vercel**
- **Backend:** **Supabase** (Postgres + Realtime) — keeps both screens in sync
- Fully right-to-left (RTL), Arabic keyboard, modern glassy design
- No login required — a shareable room link is all you need

---

## How it plays

1. One of you clicks **"إنشاء لعبة جديدة"** → gets a room link.
2. Share the link (WhatsApp, etc.). The other opens it → joins the same room.
3. The game **randomly picks who chooses the word** first.
4. The chooser types a secret Arabic word. The guesser sees only blanks.
5. The guesser taps letters. Wrong guesses build the hangman (6 tries).
6. Win or lose, tap **"جولة جديدة"** — roles swap and you go again.

---

## Setup — do this once (about 10 minutes)

You'll need two free accounts: **Supabase** and **Vercel** (you can sign into
both with GitHub or Google).

### Step 1 — Create the Supabase backend

1. Go to <https://supabase.com> → **New project**. Pick any name and a database
   password (save it somewhere; you won't need it for the app). Wait ~2 min for
   it to finish setting up.
2. In the left sidebar open **SQL Editor** → **New query**.
3. Open the file [`supabase-setup.sql`](./supabase-setup.sql) from this project,
   copy **everything**, paste it in, and click **Run**. You should see
   "Success".
4. Go to **Project Settings** (gear icon) → **API**. Copy these two values:
   - **Project URL** (looks like `https://abcd1234.supabase.co`)
   - **anon public** key (a long string under "Project API keys")

Keep these two values handy for Step 3.

### Step 2 — Put the code on GitHub

Vercel deploys from a Git repo. From this folder, in a terminal:

```bash
git init
git add .
git commit -m "Arabic Hangman"
```

Then create an empty repo at <https://github.com/new> (no README), and run the
two commands GitHub shows you, e.g.:

```bash
git remote add origin https://github.com/YOUR-USERNAME/arabic-hangman.git
git branch -M main
git push -u origin main
```

### Step 3 — Deploy the frontend on Vercel

1. Go to <https://vercel.com> → **Add New… → Project** → **Import** your
   `arabic-hangman` GitHub repo.
2. Before clicking Deploy, open **Environment Variables** and add these two
   (names must match exactly):

   | Name | Value |
   |------|-------|
   | `NEXT_PUBLIC_SUPABASE_URL` | your Project URL from Step 1 |
   | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | your anon public key from Step 1 |

3. Click **Deploy**. After a minute you'll get a live URL like
   `https://arabic-hangman.vercel.app`.

**That's it.** Open the URL, create a game, send the link to your fiancée, and
play. ❤️

### Make it feel like a real app (optional)

The game is built mobile-first (full-height layout, big touch targets, native
share sheet, safe-area support for notches). To get an app icon on your phone's
home screen:

- **iPhone (Safari):** open the site → Share → **Add to Home Screen**.
- **Android (Chrome):** open the site → menu (⋮) → **Add to Home screen**.

It then opens full-screen with no browser bars — just like a native app.

---

## Running it on your own computer first (optional)

If you want to test locally before deploying, install
[Node.js](https://nodejs.org) (LTS), then in this folder:

```bash
cp .env.local.example .env.local   # then edit .env.local with your two values
npm install
npm run dev
```

Open <http://localhost:3000>. To test two players on one machine, open a second
window in a private/incognito tab (each browser profile is treated as a
separate player).

---

## Notes & tuning

- **Difficulty:** change `MAX_WRONG` in [`lib/game.ts`](./lib/game.ts) (default
  6) to allow more or fewer wrong guesses.
- **Letters:** Arabic letter variants are normalized so guessing feels fair —
  e.g. `أ / إ / آ` all count as `ا`, and `ى` counts as `ي`. Diacritics
  (tashkeel) are ignored. See [`lib/arabic.ts`](./lib/arabic.ts).
- **Fairness note:** the secret word is stored in the shared room so both
  browsers can sync; the guesser's screen simply never displays it until the
  round ends. It's built on trust — perfect for a couple, not for tournament
  play against a determined cheater with developer tools.
- **Cost:** both Supabase and Vercel free tiers are far more than enough for two
  people playing.
