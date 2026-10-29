# API design

Two kinds of server entry points exist: **API routes** (`app/api/**/route.ts`, plain HTTP you can call from Postman) and **Server Actions** (`app/actions/*.ts`, functions that forms call; they are not URLs you can hand to Postman).

**Conventions**

- All API answers are JSON. Errors always look like `{ "error": { "code": "...", "message": "..." } }` with no stack traces.
- **Auth** = the signed `bv_session` cookie (a JWT that expires in 7 days). Protected routes answer `401` without a good cookie. In Postman, call **Login** first; Postman stores the cookie.
- **CORS**: only origins listed in `ALLOWED_ORIGINS` may call `/api` from a browser (never `*`). Others get `403`. Requests with no `Origin` header (Postman, servers) are not affected.
- **Body size**: JSON bodies over 100,000 characters get `413`.
- **Common statuses**: `400` bad or missing input, `401` not logged in, `404` not found (including "someone else's record"), `413` too big, `409` conflict (a slip name already taken, or picks that can't go together), `429` too many attempts (login), `500` generic server error, `502` ESPN or The Odds API isn't responding, `503` database down (health check only).
- `league` is `nfl` (default) or `nba`. Game, team, and player IDs are ESPN IDs: digits only, up to 12 (`401873022`).

## API routes

### Auth and health

| Method | URL | Auth | Body / query | Success response |
|---|---|---|---|---|
| POST | `/api/auth/login` | public | `{ "email": string, "password": string }` | `200 { user: { id, email, preferredSportsbook, activeBetSlipId, inviteCodeId, passwordChangedAt, createdAt } }` and sets the `bv_session` cookie. Never returns the password hash. Wrong email or password gives the same `401`. Locked out gives `429` "Too many attempts" with a `Retry-After` header (seconds) |
| GET | `/logout` | public | none | `307` redirect to `/login`, cookie deleted |
| GET | `/api/health/db` | public | none | `200 { status: "connected" }`, or `503 { status: "error", message }` |

### Bet slips (full CRUD; every route is scoped to the logged-in user)

| Method | URL | Auth | Body / query | Success response |
|---|---|---|---|---|
| GET | `/api/betslips` | yes | none | `200 BetSlip[]`, your slips only, newest first |
| POST | `/api/betslips` | yes | `{ name?, picks? (≤25), sgpGameId?, setActive?, numberIfTaken?, wager? }` | `201 BetSlip` + `Location` header. `400` bad input, `409` name taken or picks conflict |
| GET | `/api/betslips/{id}` | yes | none | `200 BetSlip`, or `404` if it isn't yours or doesn't exist |
| PATCH | `/api/betslips/{id}` | yes | at least one of `{ name, picks, wager }` | `200 BetSlip`, or `400` / `404` / `409` (name taken or picks conflict) |
| DELETE | `/api/betslips/{id}` | yes | none | `200 { deleted: true, id }`, or `404` |
| POST | `/api/betslips/{id}/copy` | yes | none | `201 BetSlip` (name "Copy of …", ≤50 chars, old games skipped, odds refreshed, becomes active) + `Location`, or `404` |
| GET | `/api/betslips/active` | yes | none | `200 BetSlip` or `200 null` (no active slip) |
| PUT | `/api/betslips/active` | yes | `{ "slipId": string \| null }` | `200 BetSlip` or `200 null`; `404` if the slip isn't yours |

Pick fields and limits: see `docs/data-model.md`. Wager is 0.01–10,000 with at most 2 decimals; slip names are 1–50 characters.

### Sports data (all need login, all read-only, ESPN or The Odds API behind the scenes)

| Method | URL | Auth | Query | Success response |
|---|---|---|---|---|
| GET | `/api/games` | yes | `league` | `200 { sportsbook, games: GameWithLines[], thisWeekGameIds, oddsUnavailable }` |
| GET | `/api/games/{id}` | yes | `league` | `200 { sportsbook, game, ... }` or `404` |
| GET | `/api/games/{id}/props` | yes | `league`, `category` = `touchdowns` \| `passing` \| `rushing` \| `receiving` \| `receptions` | `200` player props from your sportsbook (NFL) |
| GET | `/api/live` | yes | `league`, `games` (1–25 comma-separated IDs), `stats` = `true` \| `false` | `200 { games: LiveGame[] }` (score, period, clock, optional box score). No Odds API credits |
| GET | `/api/teams` | yes | `league` | `200 TeamSummary[]` |
| GET | `/api/teams/{id}` | yes | `league` | `200 { ...overview, recentResults, roster }` or `404` |
| GET | `/api/players/{id}` | yes | `league` | `200 PlayerDetails` or `404` |
| GET | `/api/injuries` | yes | `league`, `team?` | `200` injuries by team, or one team's list |
| GET | `/api/news` | yes | `league`, `team?`, `limit?` (1–25, default 10), `demo?` = `empty` \| `slow` (grader test switch: no stories, or a 3-second wait) | `200 NewsArticle[]` |
| GET | `/api/search` | yes | `league`, `q` (2–50 characters) | `200` matching teams and players |

(The NBA team and player *pages* read ESPN directly through server code in `lib/services/espn/basketball.ts`; they have no separate JSON route. `/api/teams/{id}` and `/api/players/{id}` currently return football-shaped data for the NFL.)

## Server Actions (forms)

These are called by forms in the browser, run on the server, validate everything with zod, and return a form state with a loud red message through `components/ErrorMessage.tsx`. None return the password hash.

| Action (file) | Who | Inputs | Does |
|---|---|---|---|
| `enterInviteCode` (`actions/invite.ts`) | public | `code` | Checks the code (does **not** use it up), sets the `bv_invite` cookie for 30 days. Five wrong codes → 15-minute wait. Message for any bad code: "That invite code isn't valid." |
| `signup` (`actions/auth.ts`) | needs `bv_invite` cookie | `email`, `password`, `confirmPassword` | Validates (password ≥8 chars with a letter and a number), re-checks the invite, takes one use atomically, saves a bcrypt hash, logs the user in |
| `login` (`actions/auth.ts`) | public | `email`, `password` | Lockout check (5 per email, 20 per IP, 15 minutes), bcrypt compare, sets `bv_session`. A good login resets the email's count |
| `logout` (`actions/auth.ts`) | logged in | none | Deletes `bv_session` |
| `saveSportsbook` (`actions/settings.ts`) | logged in | `sportsbook` = `hardrock` \| `betmgm` | Saves the user's preferred book |
| `changeEmail` (`actions/profile.ts`) | logged in | `newEmail`, `currentPassword` | Checks the current password (rate-limited), checks the new email is free, saves it |
| `changePassword` (`actions/profile.ts`) | logged in | `currentPassword`, `newPassword`, `confirmNewPassword` | Same rules as sign up, saves a new hash, signs out other devices, keeps this one logged in |
| `deleteAccount` (`actions/profile.ts`) | logged in | `confirmText` = `DELETE`, `currentPassword` | Deletes the user **and all their slips**, clears `bv_session`, goes to `/invite` |

## Pages (for reference)

Public: `/invite`, `/login`, `/signup` (needs invite cookie), `/privacy`, `/terms`. Protected (logged-out visitors are redirected to `/login`): `/` (Feed), `/league/{league}`, `/matchup/{gameId}?league=`, `/team/{teamId}?league=`, `/player/{playerId}?league=`, `/betslips`, `/betslips/new`, `/betslips/{id}`, `/profile`, `/settings`.

## Auth round trip

What happens when a visitor meets a protected route, and where a new signup lands. `proxy.ts` runs first on every request; the real checks sit next to the data (`lib/auth/dal.ts` for pages, `withUser` for API routes).

| Visitor does this | What happens |
|---|---|
| Logged out, opens a **protected page** (for example `/betslips`) | `proxy.ts` redirects to `/login?next=/betslips`. After logging in, they land back on `/betslips`. For `/` there is no `next`, so they land on the Feed. |
| Logged out, calls a **protected API route** (for example `GET /api/betslips`) | `401` JSON error `{ "error": { "code": "unauthorized", ... } }`, not a redirect |
| Logged out, opens `/signup` **without an invite cookie** | Redirected to `/invite` first (the `next` address is kept) |
| **Signs up** with a valid invite | The account is created, the `bv_session` cookie is set, and they land on the **Feed (`/`)**, or on the `next` page if there was one |
| **Logs in** with the right password | The `bv_session` cookie is set and they land on the Feed (or the `next` page) |
| Logged in, opens `/login`, `/signup`, or `/invite` | Redirected to the Feed |
| Has a bad, edited, or expired `bv_session` cookie | Treated as logged out (same as the first two rows) |

## Testing every route in Postman

Import `docs/backroom-vegas.postman_collection.json` (Postman → Import → drag the file in). Set the collection variable `baseUrl` (default `http://localhost:3000`) and run **Login** first. Use a throwaway account on the dev database, never the live one.
