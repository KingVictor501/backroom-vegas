# Wiring log

Which pages are wired to which endpoints, how each of the four states (loading, error, empty, data) was forced and checked, and one AI diff that was read and changed before approving.

**How to read the "Result" columns:** results marked **measured** come from a real request to the running app with a throwaway logged-in user in the dev database (`backroom-vegas-dev`), recorded on 2026-10-29. Items marked **☐ confirm in browser** are screen looks that need your eyes; the step to force each one is given.

## 1. Pages wired and the endpoint each one calls

Most pages load their data on the server (they call ESPN, The Odds API and MongoDB through `lib/services` and `lib/db`, not through the browser). Only these pieces call **our own API from the browser**:

| Page | Piece | Calls | Method |
|---|---|---|---|
| Feed `/` | News box (`feed/NewsWidget`) | `/api/news?limit=6` | GET |
| Feed `/` | Search box (`feed/SearchBar`) | `/api/search?q=` | GET |
| Feed `/`, League `/league/{league}` | Game cards live scores (`feed/GameBrowser` → `useLiveScores`) | `/api/live?league=&games=` | GET |
| Matchup `/matchup/{id}` | Live score in the header (`matchup/MatchupHeader`) | `/api/live` | GET |
| Bet Slips `/betslips` | The list itself is loaded **on the server** | `/api/betslips` (through `lib/api/ownApi.ts`) | GET |
| Bet Slips `/betslips` | Copy a slip, set the active slip (`betslips/SlipList`) | `/api/betslips/{id}/copy`, `/api/betslips/active` | POST, PUT |
| New slip `/betslips/new` | `betslips/NewSlipForm` | `/api/betslips` | POST |
| Slip detail `/betslips/{id}` | Rename, picks, wager, copy, delete, set active (`betslips/SlipDetail`), plus live scores | `/api/betslips/{id}` (PATCH, DELETE), `/api/betslips/{id}/copy`, `/api/betslips/active`, `/api/live` | PATCH, DELETE, POST, PUT, GET |
| Every page | Add or remove a pick, start a slip (`betslip/BetSlipProvider`, all through `lib/betting/slipRequests.ts`) | `/api/betslips`, `/api/betslips/{id}`, `/api/betslips/active` | POST, PATCH, PUT, DELETE |
| Login, sign up, invite, profile, settings | Forms | Server Actions in `app/actions/*.ts` (not URLs) | form post |

Team, Player, Matchup tables, Injuries and the Feed's game list are read on the server, so they have no browser-to-API call. The full route list is in [`api-design.md`](api-design.md), and the call sites are in [`component-tree.md`](component-tree.md).

## 2. The four states: what was done and what was seen

### News box on the Feed (has built-in switches)

| State | What I did | Result |
|---|---|---|
| **Loading** | Opened `/?news=slow`. The API waits 3 seconds. | **Measured:** `GET /api/news?demo=slow` answered `200` after **3.1 s**. Screen: gray placeholder cards. ☐ confirm in browser |
| **Error** | Opened `/?news=bad-url`. The box asks for an address that doesn't exist. | **Measured:** the address answers `404`. Screen: red box "NFL news didn't load" with a **Retry** button. ☐ confirm in browser |
| **Empty** | Opened `/?news=empty`. | **Measured:** `GET /api/news?demo=empty` answered `200` with `[]`. Screen: "No NFL news right now." ☐ confirm in browser |
| **Data** | Opened `/`. | **Measured:** `200` in 47 ms with **6 stories**. Screen: pictures, headlines, summaries. |

Screenshots of all four looks are in `docs/week6-capstone-news-widget-screenshots/`.

### Search box on the Feed

| State | What I did | Result |
|---|---|---|
| **Data** | Typed `mahomes`. | **Measured:** `GET /api/search?q=mahomes` answered `200` with Patrick Mahomes (QB, KC). |
| **Empty** | Typed `zzzzqqqq`. | **Measured:** `200` with `[]`. Screen: "No teams or players match …. Check the spelling and try again." ☐ confirm in browser |
| **Error (bad input)** | One letter, `a`. | **Measured:** `400 invalid-input`, "Type at least 2 letters." The box waits for 2 letters first. |
| **Loading / network error** | In Safari: Develop → Network → throttle, or turn Wi-Fi off. | ☐ confirm in browser |

### Live scores (game cards, matchup header, slip detail)

| State | What I did | Result |
|---|---|---|
| **Data** | Opened a live or finished game. | Score, period and clock show; picks grade as Winning, Losing, Push or Pending. ☐ confirm in browser |
| **Empty** | A day with no live game. | Nothing polls and cards show the normal start time. |
| **Error** | Turn Wi-Fi off while a game is on. | Screen keeps the last score and shows "Scores delayed. Showing the last scores we have." ☐ confirm in browser |
| **Bad request** | Asked for `games=abc`. | **Measured:** `400 invalid-input`; the route refuses it before calling ESPN. |

### Bet Slips list and slip detail

| State | What I did | Result |
|---|---|---|
| **Empty** | Used a brand-new account. | **Measured:** `GET /api/betslips` answered `200` with `[]`. Screen: "no slips" message with a tap-to-start hint. ☐ confirm in browser |
| **Data** | Created a slip, then reloaded. | The list shows it in the page source with JavaScript off (the list is built on the server). |
| **Loading** | Throttled the network (Safari: Develop → Network). | Next.js shows `app/(main)/loading.tsx`: skeleton, menu stays put. ☐ confirm in browser |
| **Error** | The list fetches its own API through `APP_URL`; set `APP_URL` to a wrong port in `.env.local` and restart. | `app/(main)/betslips/error.tsx`: friendly message with **Retry**, no stack trace. ☐ confirm in browser, then put `APP_URL` back |
| **Not found** | Opened `/betslips/64b7f0c2a1b2c3d4e5f60718`. | **Measured:** the page answered with its "not found" content, but the technical status is `200`, not `404` (a known limit in `security-review.md`). |

### Server-loaded pages (Matchup, Team, Player, Feed games)

Each section is wrapped in `<Suspense>` with a gray skeleton while loading, and each section has its own "isn't available right now" message if ESPN or The Odds API fails (the code catches the failure and shows the message instead of crashing). These were **checked in the code, not forced**, because forcing an outside API to fail needs a broken key or no network on the server.

## 3. One diff read and changed before approving

**What the AI got wrong:** the first version of the after-login redirect guard (`safeNextPath`) only blocked addresses starting with `//` or `/\`. That looks safe, but a hidden tab or line break in the address, like `/%09/evil.com`, slipped through, and the browser turned it into `//evil.com`. That is an **open redirect**: someone could send you a real login link that, after you log in, drops you on a fake site.

**How it was fixed:** the guard now refuses every hidden character and backslash, and then checks that the final address still points at this site. The attack is also a test (`tests/pentest.test.ts` tries `https://evil.example`, `//evil.example`, `/\evil.example` and `javascript:alert(1)` and expects `/` every time).

More examples of unsafe AI suggestions that were changed are in the table in [`security-review.md`](security-review.md).
