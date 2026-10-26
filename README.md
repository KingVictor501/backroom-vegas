# The Vegas Backroom

An NFL odds comparison, news, and bet slip app with a high-end Las Vegas look.
Compare live odds from **Hard Rock Bet, BetMGM, and Caesars**, read NFL news,
look up team and player stats, and build bet slips: **Straight**, **Parlay**,
and **Same Game Parlay (SGP)**.

**Live app: https://backroom-vegas.vercel.app** (sign up with any email that has a common ending, like .com, .org, or .edu; no verification email)

> **Reference tool only.** Nobody places real bets or spends money in this app.

Applied AI capstone project. Built with Next.js (App Router), TypeScript,
Tailwind CSS, and MongoDB Atlas, and hosted on Vercel.

---

## What the app does

| Page | What you can do |
|---|---|
| **Sign up / Log in** | Email and password only (no email verification). Emails must end in a common ending (.com, .org, .net, .edu, .gov, .mil, .io, .us, country endings like .uk or .ca, and a few more; the list is `EMAIL_ENDINGS` in `lib/auth/validation.ts`), which also catches typos like `.con`. You stay logged in for 7 days. Every page needs you to be logged in. |
| **Feed** (`/`) | Search teams and players; league tabs (NFL works, the others say "Coming soon"); bet-type buttons; this week's and next week's games with **Spread / Total / Winner** odds buttons; filters (All, Today, This Week); and an **NFL news** box. |
| **League** (`/league/nfl`) | Every upcoming NFL matchup, soonest first. |
| **Matchup** (`/matchup/<id>`) | Both teams, records, date and time, an Odds / Insights switch (Insights is "coming soon"), **Build your own SGP**, and tabs: Game Lines (+ each team's chance of winning and both teams' injury reports), Player Props, Team Props, Halves, Quarters, D/ST, and Game Specials. Plus news about the matchup. |
| **Team** (`/team/<id>`) | Record, standing, season stats, last 5 games with stats, key players' last 5 games (collapsible), injuries, and team news. |
| **Player** (`/player/<id>`) | Photo, position, team, injury status, season stats, last 10 games with averages, news, and the next game's live props. |
| **Bet Slips** (`/betslips`) | All your slips with search and a type filter; **New slip**; each slip's page to rename it, remove picks, set it as your active slip, or delete it. |
| **Settings** (`/settings`) | Pick your sportsbook (the odds everywhere switch to it); log out. |

**Bet slip rules.** Your first tap on any odds starts a slip. Tapping a gold
(selected) price again removes it. Picks that can't go together (both sides of
a bet, over and under, two lines of one bet, anytime TD + 2+ TDs, or the
moneyline + spread on the same team) open a popup with **Cancel** or **Start new
slip**. An SGP only takes picks from its own game, and its combined odds are
labeled **Estimated**. The server works out every slip's type and combined odds
itself and checks the same rules, so they can't be faked.

---

## How the app connects to the APIs

```
Your browser ──► The Vegas Backroom server (Next.js on Vercel) ──► ESPN (stats, news, injuries, logos)
                 · pages built on the server                    ──► The Odds API (live odds and props)
                 · API routes in app/api                        ──► MongoDB Atlas (users and bet slips)
                 · Server Actions (login, sign up, settings)
```

- **The browser never talks to an outside API directly.** Every request to ESPN, The Odds API, or MongoDB happens on the server, so the API keys never reach the browser.
- **ESPN** (its public, unofficial API; no key): games, scores, team and player stats, injuries, news, and logos. Stats only: the app never reads ESPN's betting lines and never shows old (historical) odds.
- **The Odds API** (`ODDS_API_KEY`): live game lines and props for Hard Rock Bet (`hardrockbet`), BetMGM (`betmgm`), and Caesars (`williamhill_us`). Games are matched between ESPN and The Odds API by team names and kickoff time.
- **Saving credits:** answers are cached (saved for a while) on the server. Game lines for every game cost 3 credits per hour. Props, halves, and the other tabs only load when someone opens them, and are saved for 60 minutes.
- **Schema checks:** every outside answer is checked with zod before it's used, so an unexpected change shows a friendly message instead of crashing.

---

## Setup (on your computer)

**You need:** Node.js 20 or newer, a free MongoDB Atlas database, and a free The Odds API key.

```bash
git clone https://github.com/KingVictor501/backroom-vegas.git
cd backroom-vegas
npm install
cp .env.example .env.local      # then fill in the values (see below)
npm run dev                     # open http://localhost:3000 and sign up
```

To make a strong `AUTH_SECRET`, run this and paste the result into `.env.local`:

```bash
openssl rand -base64 48
```

Other commands:

| Command | What it does |
|---|---|
| `npm run dev` | Runs the app at http://localhost:3000 |
| `npm test` | Runs the automatic tests (Vitest): bet slip conflict rules, SGP rules, parlay math, odds → picks, game times, the after-login redirect guard, and the path traversal lock |
| `npm run typecheck` | Checks every TypeScript type |
| `npm run lint` | Checks the code style and React rules |
| `npm run build` | Builds the app the way Vercel does |

### Environment variables

These go in `.env.local` on your computer (never committed to GitHub; `.gitignore` blocks it) and in **Vercel → Project → Settings → Environment Variables** for the live site. `.env.example` lists the names with no real values.

| Name | What it's for |
|---|---|
| `MONGODB_URI` | Your MongoDB Atlas connection string |
| `MONGODB_DB` | The database name (`backroom-vegas`) |
| `AUTH_SECRET` | A long random secret (32+ characters) that signs the login cookie |
| `APP_URL` | The app's own address (`http://localhost:3000` locally, your live URL on Vercel) |
| `ALLOWED_ORIGINS` | The websites allowed to call the API from a browser (CORS), comma-separated. Your own address. Never `*`. |
| `ODDS_API_KEY` | Your The Odds API key |

None of these start with `NEXT_PUBLIC_`, so Next.js never sends them to the browser.

**On Vercel**, also allow Vercel to reach your database: in MongoDB Atlas → Network Access, add `0.0.0.0/0` (Vercel's addresses change).

---

## Postman collections

In the `postman/` folder. Drag each file onto the Postman window to import it.

| File | What it tests |
|---|---|
| `external-apis.postman_collection.json` | The outside APIs the app uses: The Odds API (events, game lines, markets, props, halves) and ESPN (scoreboard, teams, rosters, injuries, news, game summaries, players). Uses an `{{odds_api_key}}` variable you set in your own Postman environment. |
| `internal-routes.postman_collection.json` | The app's own API routes: games, one game, props, teams, injuries, news, search, and players. Includes "not found", "bad input", "logged out", and CORS tests. |
| `betslips.postman_collection.json` | The bet slip API: create, list, get, rename, change picks, and delete, plus conflict and SGP checks and the active slip. Each request checks its own result (see the Test Results tab). |
| `internal-local.postman_environment.json` | The settings the two internal collections use: `baseUrl` and an **empty** `session_cookie`. |

**Staying logged in for the internal collections:** log in to the app in your
browser, open DevTools → Application (Chrome) or Storage (Safari) → Cookies →
`bv_session`, copy its value, and paste it into `session_cookie` in the Postman
environment (in the Current value column only). Never commit or share it.

---

## Advanced feature: Server Actions

Login, sign up, log out, and the Settings sportsbook picker use **Server Actions**:
functions that run only on the server but are called straight from a form.

| Action | File | What it does |
|---|---|---|
| `signup`, `login`, `logout` | `app/actions/auth.ts` | Checks the form with zod, hashes passwords with bcrypt, and sets or clears the 7-day login cookie |
| `saveSportsbook` | `app/actions/settings.ts` | Checks the choice (only Hard Rock Bet, BetMGM, or Caesars), saves it to *your* account (your ID comes from your login cookie, never from the form), then refreshes the page |

The forms use React's `useActionState` to show "Logging in…" or "Saving…" and
the server's error messages. They also work with JavaScript turned off.

---

## Testing the NFL news widget (four states)

The **NFL news** box at the bottom of the Feed loads in the browser from
`/api/news`, so it has four different looks. Under the box there's a
**"For testing"** row of links, or you can type these addresses:

| Look | How to see it |
|---|---|
| **Loading** (gray cards) | `/?news=slow`: the API waits 3 seconds before answering. Or the real way: in **Chrome** DevTools → **Network** → throttling menu → **Slow 4G** (or 3G), then reload. |
| **Error** (message + Retry) | `/?news=bad-url`: the box asks for an address that doesn't exist. **Retry** asks again. |
| **Empty** | `/?news=empty`: the API answers with no stories. |
| **News** | `/`: picture, headline, short summary, and a link to the story on ESPN. |

These test switches only change what *that visitor* sees; they never change
any data. Screenshots of all four looks are in `docs/screenshots/`.

---

## Security

### How the app prevents XSS (cross-site scripting)

**XSS** is when an attacker gets their own code to run inside someone else's
browser, usually by sneaking HTML or a `<script>` into text the website
shows. This app shows a lot of text it didn't write: news headlines and
summaries from ESPN, player and team names, and slip names that users type.
Here's how none of it can ever run as code:

1. **No raw HTML, ever.** The code never uses `dangerouslySetInnerHTML` (the
   React feature that inserts raw HTML), `innerHTML`, or `eval`. React shows
   every piece of text *as text*: if a headline contained `<script>`, you'd
   just see the letters `<script>` on screen.
2. **News is turned into plain text on the server.** ESPN stories can contain
   HTML, so every headline and summary goes through `toPlainText()`
   (`lib/services/text.ts`), which removes all HTML before it ever leaves the server.
3. **Links are checked.** News links and pictures must be ordinary `https://`
   addresses. Anything else, like a `javascript:` link that would run code
   when tapped, is dropped. Links to ESPN open in a new tab with
   `rel="noopener noreferrer"`, so ESPN's page can't control ours.
4. **User input is checked on the server.** Every form and API request is
   checked with zod (type, length, and allowed values) before it's used. For
   example, slip names are 1–50 characters and sportsbooks must be one of three.
5. **Safety headers on every answer.** `X-Content-Type-Options: nosniff` (a
   file can't be passed off as a script), `X-Frame-Options: DENY` (other sites
   can't frame our pages to trick clicks), `Referrer-Policy`, and
   `Permissions-Policy` (no camera, microphone, or location).

### Other protections

- **Passwords** are hashed with bcrypt (cost 12) and never stored or sent as
  plain text. A failed login always says just "Invalid email or password." and
  takes the same time either way, so nobody can find out which emails have accounts.
- **The login cookie** (`bv_session`) is signed (so it can't be forged),
  `HttpOnly` (page scripts can't read it), `SameSite=Lax`, and `Secure` on the
  live site. It lasts 7 days.
- **Login is required everywhere.** Pages send logged-out visitors to /login,
  and API routes answer 401 "Please log in." The page guard checks the cookie's
  signature, and each page and route also checks the account still exists.
- **You can only see, change, or delete your own bet slips.** Every database
  search includes your user ID. Someone else's slip ID acts exactly like a fake
  ID ("not found"), so it doesn't even reveal that the slip exists.
- **CORS** only lets your own website (the `ALLOWED_ORIGINS` list) call the API
  from a browser. Unknown websites get 403. `*` (every website) is never allowed.
- **API keys stay on the server.** Files that read secrets are marked
  `server-only`, so the build fails if browser code ever imports them. The Odds
  API key is never written to logs.
- **No open redirects.** After login, the app only follows `?next=` to a page
  on this same site (`safeNextPath`). It refuses other websites (`//evil.com`,
  `https://…`), backslashes, and hidden tabs or line breaks (browsers delete
  those, which would turn `/<tab>/evil.com` into `//evil.com`). Tested in
  `lib/auth/validation.test.ts`.
- **No path traversal.** The app never opens files based on visitor input.
  Every ID that goes into an ESPN or Odds API address must be digits only
  (checked on every page and route), and the address builders refuse any `.`,
  `..`, or hidden `/` in a path as a second lock (`lib/services/safePath.ts`,
  tested in `safePath.test.ts`). So a trick like `/api/players/..%2f..%2fnews`
  just gets "not found".
- **Error messages say only what a user needs.** Every error is a short,
  friendly message like "We couldn't find that bet slip." or "Please log in."
  Unexpected crashes answer "Something went wrong on our side." Stack traces,
  file paths, and database details only go to the server log (Vercel → Logs),
  never to the visitor. That includes the public `/api/health/db` check.
- **No file uploads.** The app doesn't accept any uploaded files, so there's nothing to misuse there.
- **No secrets on GitHub.** `.env*` files are ignored (except `.env.example`,
  which has names only), and so are the saved sample API answers in `api-samples/`.

### Known limits

- **No login rate limiting.** Someone could try many passwords in a row. A real
  product should limit attempts per account and per IP address (for example
  with a service like Upstash).
- **No Content-Security-Policy header.** It would add another layer against
  XSS, but Next.js needs extra setup for it. Left out for now.
- **ESPN's API is unofficial** and not meant for commercial use, which is fine
  for a non-commercial school project. It can change without warning, and the
  app checks every answer with zod for that reason.
- **Development-only tool warning:** `npm audit` reports an issue in `braces`,
  inside Next.js's lint rules. It's only used while coding (never on the live
  site), and the only offered "fix" downgrades the lint setup. Production
  packages have 0 known vulnerabilities.
- **Caesars** currently has no odds posted in The Odds API; the app says so
  instead of showing a page of dashes.

### When an AI tool suggested something unsafe

This app was built with an AI coding assistant (Claude Code). These are the
times an AI tool or an example it worked from would have done something
unsafe, and what was done instead:

| What was suggested or considered | Why it was unsafe | What we did instead |
|---|---|---|
| The Next.js docs' CORS example uses `Access-Control-Allow-Origin: *` | Any website could call the API from a visitor's browser | An allowlist (`ALLOWED_ORIGINS`) that never accepts `*` |
| Letting the Bet Slips page call its own API using the address from the incoming request (the `Host` header) | A faked `Host` could make the server send a user's login cookie to another website | The address always comes from `APP_URL` in the settings |
| An early code comment claimed TypeScript would stop the password hash from being sent to the browser | TypeScript types don't exist when the app runs, so they can't stop anything | `toUser()` copies only safe fields, and the database never loads the password hash unless asked (`select: false`) |
| Allowing pictures from any website through Next.js's image resizer | Strangers could use our server to fetch and resize any picture | Only ESPN's `a.espncdn.com/i/...` is allowed; news pictures load straight from ESPN |
| Showing ESPN news as it arrives (it can contain HTML) | HTML from another site could run in our pages (XSS) | All news is turned into plain text on the server; no `dangerouslySetInnerHTML` |
| Logging full Odds API request addresses while debugging | The address includes the API key, which would end up in logs | The app logs only the number of credits left, never the address |
| Two pages (team page, New Slip) relied only on the page guard's cookie check | A valid cookie for a deleted account would still pass | Both pages also check the account still exists (`requireUser`) |
| A news link from ESPN would have been used as-is | A `javascript:` link would run code when tapped | Only `https://` links are kept |
| The first after-login redirect guard only blocked `//` and `/\` at the start | A hidden tab or line break (`/%09/evil.com`) slipped through, and the browser turned it into `//evil.com`: an open redirect to a fake site | The guard refuses all hidden characters and backslashes and checks the final address stays on this site, with tests |
| The public database health check (`/api/health/db`) answered "Check MONGODB_URI and MongoDB Atlas Network Access" when the database was down | It told any stranger which database the app uses and the name of a secret setting | It now says only "The database isn't available right now."; the details go to the server log |
| The ESPN address builder trusted that callers had checked IDs | If a future page forgot to check, an ID like `..` could make the server fetch a different ESPN address (path traversal) | Every address is checked for `.`, `..`, and hidden slashes before it's used, with tests |

<!-- Add any other time an AI tool suggested something unsafe that you rejected: -->

---

## Data sources and credits

- **ESPN**: stats, scores, injuries, news, logos, and photos, through ESPN's public, unofficial API. This is a non-commercial school project; ESPN content belongs to ESPN.
- **The Odds API**: live odds and props.
- Made for learning. Not affiliated with ESPN, the NFL, Hard Rock Bet, BetMGM, or Caesars.
