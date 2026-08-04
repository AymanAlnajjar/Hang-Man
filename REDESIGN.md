# تجديد الواجهة — Redesign notes

Design direction: **Arabic Playful Editorial + Soft Neo-Brutalism + Cozy Mobile Game UI**.
Mobile-only, native RTL, cream/navy palette, hard borders + offset shadows, no glassmorphism, no heavy gradients.

## Audit (Phase 1)

- **Framework:** Next.js 14.2.5 (App Router), React 18.3, TypeScript.
- **Styling:** Tailwind CSS 3.4 + `app/globals.css` component layer (`.glass`, `.btn-primary`, `.btn-ghost`, `.input-field`).
- **State:** local React state + Supabase Realtime (`postgres_changes`). No external state lib.
- **Auth:** Supabase Auth via `lib/auth.ts` (`useAuth`); anonymous per-device id via `lib/player.ts`.
- **Realtime/multiplayer:** per-room channels; optimistic `setGame` + DB writes. **Do not touch.**
- **Routes:** `/`, `/hangman` + `/game/[code]`, `/wordle` + `/wordle/[code]`, `/stop` + `/stop/[code]`,
  `/meld` + `/meld/[code]`, `/wordbox` + `/wordbox/[code]`, `/account`, `/friends`, `/dm/[id]`.
- **Shared components:** `Chat`, `Keyboard`, `WordDisplay`, `Hangman`, `MatchResult`, `InvitesBanner`.
- **RTL:** already `<html dir="rtl" lang="ar">`. Redesign switches to logical CSS properties.
- **Build:** Node is not installed on the dev machine — local lint/typecheck/build cannot be run here;
  validation happens on Vercel. Code written conservatively to preserve types.

## Approach

Central token swap (Tailwind palette + `globals.css`) reskins all shared primitives at once,
then each screen's dark-theme utilities (`text-white/*`, `bg-white/*`, fuchsia gradients) are
replaced with semantic tokens (`text-ink`, `bg-surface`, `border-ink`, `bg-primary`, …).
**No game logic, DB call, route, or realtime code is changed** — only markup/classes/presentation.

## New / changed
- Tokens: `tailwind.config.ts`, `app/globals.css`, `app/layout.tsx` (Alexandria + IBM Plex Sans Arabic).
- UI library: `components/ui/*` (Button, Card, Chip, ProgressBar, BottomSheet, Toast, EmptyState, Skeleton).
- Layout: `components/layout/*` (AppShell, TopHeader, BottomNavigation).
- Game UI: `Keyboard` → editorial `ArabicKeyboard`, `WordDisplay` → `LetterTile` row, `Hangman` → tulip-petals.
- Screens: `/` (editorial dashboard), `/games` (library, new), `/results` (rivalry, new), plus every game + social screen.
