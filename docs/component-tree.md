# Component tree

The folder structure mirrors the tree: `app/` holds the pages (server components that load data), `components/<area>/` holds the pieces each area uses, `lib/` holds server code (database, ESPN, odds, auth), and `types/` holds the shared types.

## Where state lives

| State | Where | Why |
|---|---|---|
| Logged-in user | The `bv_session` cookie, read on the server (`lib/auth/dal.ts`) | The server decides; the browser never holds the user's identity |
| The active bet slip, pending conflict popup, delete popup, toast | `components/betslip/BetSlipProvider.tsx` (React context, client). It is handed the saved slip by the server layout, so the slip bar is there with no flicker | Every page's odds buttons, the slip bar, the desktop panel, and the slip page share one slip |
| Live scores | `components/live/useLiveScores.ts` (client hook; timing rules in `livePoller.ts`). Used by `GameBrowser`, `MatchupHeader`, and `SlipDetail` | Only needs to live in the screen showing the games |
| Search text, date filter (This Week / Today), bet-type filter, the "Show live games" tick box (off at first), and the current page on the Feed | `useState` inside `components/feed/GameBrowser.tsx` | Filters the already-loaded list instantly. Changing the search, filter or tick box goes back to page 1 |
| Everything else (games, odds, stats, slips lists) | Not kept in browser state. Server components load it per request, with short server-side caches | Pages stay fast and work with JavaScript off |

## Where API calls happen

- **Server components and server code** call ESPN, The Odds API, and MongoDB directly (`lib/services/**`, `lib/db/**`). The browser never calls an outside API.
- **The browser calls only our own API:**
  - Slip changes go through one helper file, `lib/betting/slipRequests.ts` (create, save picks, rename, wager, make active, copy, delete, clear active). It is used by `BetSlipProvider`, `NewSlipForm`, `SlipList`, and `SlipDetail`, and calls `/api/betslips`, `/api/betslips/{id}`, `/api/betslips/{id}/copy`, and `/api/betslips/active`
  - The Bet Slips list page (`app/(main)/betslips/page.tsx`) loads `GET /api/betslips` **on the server** through `lib/api/ownApi.ts` (using `APP_URL` and the user's cookie), so the list is in the page source with JavaScript off
  - `useLiveScores` → `/api/live`
  - `SearchBar` → `/api/search`
  - `NewsWidget` (`components/feed/NewsWidget.tsx`) → `/api/news`
- **Shared API helpers** (so no page writes its own request code for these):
  - **Browser → our API, for bet slips:** `lib/betting/slipRequests.ts`. It sends the request, turns a failed answer into a `SlipRequestError` with the server's friendly message, and is used by every slip component.
  - **Server → our own API:** `lib/api/ownApi.ts` (`getFromOwnApi`). It adds the user's cookie and uses `APP_URL`, and is used by the Bet Slips list page.
  - **Server → outside APIs:** `lib/services/http.ts` (the shared fetch that checks every answer with zod and turns failures into friendly errors), with `lib/services/espn/client.ts` and `lib/services/odds/client.ts` building the ESPN and Odds API addresses.
  - Search, the News widget, and live scores make their own small `fetch` calls to our API (each with its own loading and error handling); they are not routed through a shared helper yet.
- **Forms use Server Actions** (`app/actions/*.ts`): invite, sign up, log in, log out, settings, and the three profile forms.
- `components/matchup/AutoRefresh.tsx` calls `router.refresh()`, which re-runs the server-rendered stats section; it makes no API call of its own.

## The tree

```
app/layout.tsx                     root: fonts, site notice banner; renders per visit (needed for the CSP nonce)
├── app/(auth)/layout.tsx          logged-out frame + footer
│   ├── invite/page.tsx            └ components/auth/InviteForm
│   ├── login/page.tsx             └ components/auth/LoginForm
│   └── signup/page.tsx            └ components/auth/SignupForm
├── app/(legal)/layout.tsx         "Back to login" breadcrumb + footer
│   ├── privacy/page.tsx           └ legal/TemplateNotice
│   └── terms/page.tsx             └ legal/TemplateNotice
└── app/(main)/layout.tsx          logged-in frame (server: loads the active slip)
    └── BetSlipProvider            ← slip state lives here (client)
        ├── components/nav/AppNav            menu: bottom bar on phones, sidebar on desktop
        ├── <main> pages …
        │   ├── page.tsx (Feed)
        │   │   ├ components/feed/LeagueGames (server) → PracticeOddsNotice, GameBrowser (client)
        │   │   │   ├ SearchBar, LeagueTabs, ScoresDelayed
        │   │   │   └ GameCard → LiveScoreLine, StartSgpButton, GameLinesTable → OddsButton
        │   │   └ components/feed/NewsWidget (client, calls /api/news, shows all four states)
        │   ├── league/[league]/page.tsx      └ LeagueGames (a league that is on) or PagePlaceholder ("Coming soon")
        │   ├── matchup/[gameId]/page.tsx
        │   │   ├ PracticeOddsNotice
        │   │   ├ matchup/MatchupHeader (client, live score, ScoresDelayed)
        │   │   ├ matchup/MatchupTabs (+ StartSgpButton), MarketSections → OddsButton
        │   │   ├ feed/GameLinesTable → OddsButton, matchup/WinProbability
        │   │   ├ matchup/GameStats (+ AutoRefresh)      live / final stats, collapsible
        │   │   └ matchup/MatchupNews (MatchupInjuries, MatchupStories, each behind Suspense)
        │   ├── team/[teamId]/page.tsx        NFL: team/TeamHeader + TeamSections
        │   │                                   (RecentGames, UpcomingSchedule, KeyPlayers, InjuriesAndNews)
        │   │                                 NBA: basketball/NbaTeamView (reuses UpcomingSchedule)
        │   ├── player/[playerId]/page.tsx    NFL: player/PlayerHeader + NextGameCard (+ stats/StatTable)
        │   │                                 NBA: basketball/NbaPlayerView
        │   ├── betslips/page.tsx             └ betslips/SlipList (client filter/sort, copy)
        │   ├── betslips/new/page.tsx         └ betslips/NewSlipForm
        │   ├── betslips/[id]/page.tsx        └ betslips/SlipDetail, betslip/PayoutBox, live/PickGradeBadge, ScoresDelayed
        │   ├── profile/page.tsx              └ profile/ChangeEmailForm, ChangePasswordForm, DeleteAccountDialog, SuccessMessage
        │   └── settings/page.tsx             └ settings/SportsbookPicker, auth/LogoutButton
        ├── components/betslip/SlipBar        phones and tablets (+ PayoutBox)
        ├── components/betslip/SlipPanel      desktop right panel (+ PayoutBox)
        ├── components/betslip/ConflictDialog, ChoiceDialog, SlipToast
        │   (the provider itself renders the bar, panel, dialogs and toast)
        └── components/SiteFooter
app/error.tsx, app/(main)/error.tsx, app/(main)/loading.tsx, app/not-found.tsx     friendly error / loading / not-found screens
Route-level versions too: error.tsx for betslips, betslips/[id], matchup, player, team; loading.tsx for betslips/[id], matchup, player;
not-found.tsx for betslips/[id], matchup, player, team
```

**The Feed's cards:** `GameBrowser` keeps only this league's week (from `weekEndsOn` in `config/leagues.ts`, using `isThisFeedWeek` in `lib/format/gameTime.ts`), hides live games until the tick box is ticked, orders the rest with `lib/feed/paging.ts` (live first, then soonest start), and shows 3 rows per page (3 cards on a phone, 6 on a tablet or wider; `useColumns` reads the screen width) with a page indicator under the cards. Live scores are only requested for the cards on the page being shown. For the NBA, `lib/services/espn/games.ts` asks ESPN for each remaining day of the week, because ESPN's plain scoreboard returns only today.

**Shared pieces:** `components/ErrorMessage.tsx` (loud red errors), `ErrorScreen`, `NotFoundCard`, `InjuryList`, `NewsList`, `PracticeOddsNotice`, `SiteNotice`, `CollapseButton`, `stats/StatTable` (the stat tables on team, player, and matchup pages), `auth/AuthField` (the labeled input every form uses), `nav/NavIcons`, `live/ScoresDelayed`, and `live/PickGradeBadge`.

**The four states** (loading, error, empty, data): each data page either streams its sections behind `<Suspense>` skeletons (team, matchup, stats) or has a route `loading.tsx`/`error.tsx`; each section shows its own friendly "not available" and "nothing yet" messages. The News widget (`components/feed/NewsWidget.tsx`) shows all four on demand, and the live-score pieces keep the last score with a "Scores delayed" note if scores can't load.

**Server vs. client:** pages are server components. Only interactive pieces use `"use client"`: `BetSlipProvider` and the slip UI (`SlipBar`, `SlipPanel`, the dialogs, `OddsButton`, `StartSgpButton`, `PayoutBox`), `AppNav`, `GameBrowser`, `SearchBar`, `NewsWidget`, `MatchupHeader`, `useLiveScores`, `AutoRefresh`, `CollapseButton`, `SlipList`/`SlipDetail`/`NewSlipForm`, the forms (`InviteForm`, `LoginForm`, `SignupForm`, the three profile forms, `SportsbookPicker`), and the error screens (`ErrorScreen` and each `error.tsx`).
