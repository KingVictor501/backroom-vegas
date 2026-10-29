# Component tree

The folder structure mirrors the tree: `app/` holds the pages (server components that load data), `components/<area>/` holds the pieces each area uses, `lib/` holds server code (database, ESPN, odds, auth), and `types/` holds the shared types.

## Where state lives

| State | Where | Why |
|---|---|---|
| Logged-in user | The `bv_session` cookie, read on the server (`lib/auth/dal.ts`) | The server decides; the browser never holds the user's identity |
| The active bet slip, pending conflict popup, delete popup, toast | `components/betslip/BetSlipProvider.tsx` (React context, client). It is handed the saved slip by the server layout, so the slip bar is there with no flicker | Every page's odds buttons, the slip bar, the desktop panel, and the slip page share one slip |
| Live scores | `components/live/useLiveScores.ts` (client hook; timing rules in `livePoller.ts`) | Only needs to live in the screen showing the games |
| Search text, date filter, bet-type filter on the Feed | `useState` inside `components/feed/GameBrowser.tsx` | Filters the already-loaded list instantly |
| Everything else (games, odds, stats, slips lists) | Not kept in browser state. Server components load it per request, with short server-side caches | Pages stay fast and work with JavaScript off |

## Where API calls happen

- **Server components and server code** call ESPN, The Odds API, and MongoDB directly (`lib/services/**`, `lib/db/**`). The browser never calls an outside API.
- **The browser calls only our own API:**
  - Slip changes go through one helper file, `lib/betting/slipRequests.ts` (create, save picks, rename, wager, make active, copy, delete, clear active). It is used by `BetSlipProvider`, `NewSlipForm`, `SlipList`, and `SlipDetail`, and calls `/api/betslips`, `/api/betslips/{id}`, `/api/betslips/{id}/copy`, and `/api/betslips/active`
  - The Bet Slips list page (`app/(main)/betslips/page.tsx`) loads `GET /api/betslips` **on the server** through `lib/api/ownApi.ts` (using `APP_URL` and the user's cookie), so the list is in the page source with JavaScript off
  - `useLiveScores` → `/api/live`
  - `SearchBar` → `/api/search`
  - `NewsWidget` (`components/feed/NewsWidget.tsx`) → `/api/news`
- **Forms use Server Actions** (`app/actions/*.ts`): invite, sign up, log in, log out, settings, and the three profile forms.
- `components/matchup/AutoRefresh.tsx` calls `router.refresh()`, which re-runs the server-rendered stats section; it makes no API call of its own.

## The tree

```
app/layout.tsx                     root: fonts, site notice banner
├── app/(auth)/layout.tsx          logged-out frame + footer
│   ├── invite/page.tsx            └ components/auth/InviteForm
│   ├── login/page.tsx             └ components/auth/LoginForm
│   └── signup/page.tsx            └ components/auth/SignupForm
├── app/(legal)/layout.tsx         "Back to login" breadcrumb
│   ├── privacy/page.tsx
│   └── terms/page.tsx
└── app/(main)/layout.tsx          logged-in frame (server: loads the active slip)
    └── BetSlipProvider            ← slip state lives here (client)
        ├── components/nav/AppNav            menu: bottom bar on phones, sidebar on desktop
        ├── <main> pages …
        │   ├── page.tsx (Feed) and league/[league]/page.tsx
        │   │   └ components/feed/LeagueGames (server) → GameBrowser (client)
        │   │       ├ SearchBar, LeagueTabs
        │   │       └ GameCard → GameLinesTable → OddsButton, StartSgpButton, LiveScoreLine
        │   ├── matchup/[gameId]/page.tsx
        │   │   ├ matchup/MatchupHeader (client, live score)
        │   │   ├ matchup/MatchupTabs, MarketSections → OddsButton
        │   │   ├ feed/GameLinesTable, matchup/WinProbability
        │   │   ├ matchup/GameStats (+ AutoRefresh)      live / final stats, collapsible
        │   │   └ matchup/MatchupNews (injuries, stories)
        │   ├── team/[teamId]/page.tsx        NFL: team/TeamHeader + TeamSections
        │   │                                 NBA: basketball/NbaTeamView
        │   ├── player/[playerId]/page.tsx    NFL: player/PlayerHeader + NextGameCard (+ stats/StatTable)
        │   │                                 NBA: basketball/NbaPlayerView
        │   ├── betslips/page.tsx             └ betslips/SlipList (client filter/sort, copy)
        │   ├── betslips/new/page.tsx         └ betslips/NewSlipForm
        │   ├── betslips/[id]/page.tsx        └ betslips/SlipDetail, betslip/PayoutBox, live/PickGradeBadge
        │   ├── profile/page.tsx              └ profile/ChangeEmailForm, ChangePasswordForm, DeleteAccountDialog
        │   └── settings/page.tsx             └ settings/SportsbookPicker
        ├── components/betslip/SlipBar        phones and tablets
        ├── components/betslip/SlipPanel      desktop right panel
        ├── components/betslip/ConflictDialog, ChoiceDialog, SlipToast
        └── components/SiteFooter
app/error.tsx, app/(main)/error.tsx, app/(main)/loading.tsx, app/not-found.tsx     friendly error / loading / not-found screens
```

**Shared pieces:** `components/ErrorMessage.tsx` (loud red errors), `ErrorScreen`, `NotFoundCard`, `InjuryList`, `NewsList`, `PracticeOddsNotice`, `SiteNotice`, `CollapseButton`.

**The four states** (loading, error, empty, data): each data page either streams its sections behind `<Suspense>` skeletons (team, matchup, stats) or has a route `loading.tsx`/`error.tsx`; each section shows its own friendly "not available" and "nothing yet" messages. The News widget (`components/feed/NewsWidget.tsx`) shows all four on demand.

**Server vs. client:** pages are server components. Only interactive pieces use `"use client"`: `BetSlipProvider` and the slip UI, `GameBrowser`, `SearchBar`, `MatchupHeader`, `useLiveScores`, `AutoRefresh`, `SlipList`/`SlipDetail`, and the forms.
