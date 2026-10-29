# The Vegas Backroom

An NFL and NBA odds comparison, news, and bet slip app with a high-end Las Vegas look.
Compare live odds from **Hard Rock Bet and BetMGM**, read injuries and news,
look up team and player stats, watch live scores, and build bet slips: **Straight**, **Parlay**,
and **Same Game Parlay (SGP)**.

**Live app: https://backroom-vegas.vercel.app**

> **Reference tool only.** Nobody places real bets or spends money in this app. For adults 21 and over.

### Grader access

The app starts with an **invite code** page, so you need a code before you can sign up (logging in does not need one).

- **Grader invite code:**
  `BRV-7E5B-K5CD`

- Then **sign up** with any email that has a common ending, like .com, .org, or .edu (no verification email is sent), and a password with at least 8 characters, a letter, and a number.
- Please use a throwaway email. Deleting your account (Profile page) removes your data.

## Value statement

The Vegas Backroom will be a research tool for weekend sport bettors like me who want to check the facts before building a bet. Today, researching one bet means jumping between sportsbook sites for odds, news sites for injuries, stats sites for player trends, and a notes app to track picks. The app will put odds from multiple sportsbooks, injury news, stats, and live scores on one screen, and let users save bet slips that flag picks that can’t both win. The value is less time hunting across tabs, fewer mistakes on a slip, and an easy way to spot the best price. It’s a reference tool only; no real bets are placed.

Applied AI capstone project. Built with Next.js (App Router), TypeScript,
Tailwind CSS, and MongoDB Atlas, and hosted on Vercel.

---

## What the app does

| Page                                         | What you can do                                                                                                                                                                                                                                                                                                                                          |
| -------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Invite** (`/invite`)                       | The first page a new visitor sees. Enter an invite code to reach sign up.                                                                                                                                                                                                                                                                                |
| **Sign up / Log in**                         | Email and password only (no email verification). Emails must end in a common ending (.com, .org, .net, .edu, .gov, .mil, .io, .us, country endings like .uk or .ca, and a few more; the list is `EMAIL_ENDINGS` in `lib/auth/validation.ts`), which also catches typos like `.con`. You stay logged in for 7 days. Every page needs you to be logged in. |
| **Feed** (`/`)                               | Search teams and players; league tabs (NFL and NBA work, the others say "Coming soon"); bet-type buttons; this week's and next week's games with **Spread / Total / Winner** odds buttons; filters (All, Today, This Week); and an **NFL news** box.                                                                                                     |
| **League** (`/league/nfl`)                   | Every upcoming NFL matchup, soonest first.                                                                                                                                                                                                                                                                                                               |
| **Matchup** (`/matchup/<id>`)                | Both teams, records, date and time, an Odds / Insights switch (Insights is "coming soon"), **Build your own SGP**, and tabs: Game Lines (+ each team's chance of winning and both teams' injury reports), Player Props, Team Props, Halves, Quarters, D/ST, and Game Specials. Plus news about the matchup.                                              |
| **Team** (`/team/<id>`)                      | Record, standing, season stats, last 5 games with stats, the remaining schedule (collapsible, closed at first), key players' last 5 games (collapsible), injuries, and team news. NBA teams: add `?league=nba`.                                                                                                                                          |
| **Player** (`/player/<id>`)                  | Photo, position, team, injury status, season stats, last 10 games with averages, news, and the next game's live props.                                                                                                                                                                                                                                   |
| **Bet Slips** (`/betslips`)                  | All your slips with search and a type filter; **New slip**; each slip's page to rename it, remove picks, set a pretend **wager** and see the **estimated payout**, **copy** it, set it as your active slip, or delete it.                                                                                                                                |
| **Profile** (`/profile`)                     | Change your email, change your password, or delete your account. Each needs your current password.                                                                                                                                                                                                                                                       |
| **Settings** (`/settings`)                   | Pick your sportsbook (the odds everywhere switch to it); log out.                                                                                                                                                                                                                                                                                        |
| **Privacy and Terms** (`/privacy`, `/terms`) | Template pages (not legal advice), linked from the footer with the responsible-gambling help line.                                                                                                                                                                                                                                                       |

**Bet slip rules.** Your first tap on any odds starts a slip. Tapping a gold
(selected) price again removes it. Picks that can't go together (both sides of
a bet, over and under, two lines of one bet, anytime TD + 2+ TDs, or the
moneyline + spread on the same team) open a popup with **Cancel** or **Start new
slip**. An SGP only takes picks from its own game, and its combined odds are
labeled **Estimated**. The server works out every slip's type and combined odds
itself and checks the same rules, so they can't be faked.

---

## How the app connects to the APIs

> **Diagrams:** see [`docs/system-diagram.md`](docs/system-diagram.md) for the picture of how the browser, the guard (`proxy.ts`), the app, the database, and the outside APIs connect, and [`docs/data-model.md`](docs/data-model.md) for the database.

```
Your browser ──► The Vegas Backroom server (Next.js on Vercel) ──► ESPN (stats, news, injuries, logos, live scores)
                 · proxy.ts (the guard)                         ──► The Odds API (live odds and props)
                 · pages built on the server                    ──► MongoDB Atlas (users, bet slips, invite codes)
                 · API routes in app/api
                 · Server Actions (login, sign up, profile, settings)
```

- **The browser never talks to an outside API directly.** Every request to ESPN, The Odds API, or MongoDB happens on the server, so the API keys never reach the browser.
- **ESPN** (its public, unofficial API; no key): games, scores, team and player stats, injuries, news, and logos. Stats only: the app never reads ESPN's betting lines and never shows old (historical) odds.
- **The Odds API** (`ODDS_API_KEY`): live game lines and props for Hard Rock Bet (`hardrockbet`), and BetMGM (`betmgm`). Games are matched between ESPN and The Odds API by team names and kickoff time.
- **Saving credits:** answers are cached (saved for a while) on the server. Game lines for every game cost 3 credits per refresh and are saved for 6 hours. Props, halves, and the other tabs only load when someone opens them. Live scores come from ESPN, not The Odds API, so they cost no credits.
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

| Command                                               | What it does                                                                                                     |
| ----------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| `npm run dev`                                         | Runs the app at http://localhost:3000                                                                            |
| `npm test`                                            | Runs all 639 automatic tests (Vitest) on a throwaway in-memory database                                          |
| `npm run typecheck`                                   | Checks every TypeScript type                                                                                     |
| `npm run lint`                                        | Checks the code style and React rules                                                                            |
| `npm run build`                                       | Builds the app the way Vercel does                                                                               |
| `npm run invite:create -- --db <name>`                | Makes an invite code in the database you name (see the script's help for uses and expiry)                        |
| `npm run invite:check -- --db <name>`                 | Checks an invite code without printing it (read-only)                                                            |
| `npm run pentest -- --base <address> --db <name>-dev` | Runs the 101 attack checks from `docs/penetration-test.md` against a running copy of the app (dev database only) |

### Environment variables

These go in `.env.local` on your computer (never committed to GitHub; `.gitignore` blocks it) and in **Vercel → Project → Settings → Environment Variables** for the live site. `.env.example` lists the names with no real values.

| Name              | What it's for                                                                                                                                                                                                                 |
| ----------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `MONGODB_URI`     | Your MongoDB Atlas connection string                                                                                                                                                                                          |
| `MONGODB_DB`      | The database name. `backroom-vegas` for the live site (Vercel **Production** only), `backroom-vegas-dev` for Preview and your computer. If it is missing outside the live site, the app refuses to start instead of guessing. |
| `AUTH_SECRET`     | A long random secret (32+ characters) that signs the login cookie                                                                                                                                                             |
| `APP_URL`         | The app's own address (`http://localhost:3000` locally, your live URL on Vercel)                                                                                                                                              |
| `ALLOWED_ORIGINS` | The websites allowed to call the API from a browser (CORS), comma-separated. Your own address. Never `*`.                                                                                                                     |
| `ODDS_API_KEY`    | Your The Odds API key                                                                                                                                                                                                         |
| `SAMPLE_ODDS`     | Optional, `true` on your computer only: uses saved sample odds so no credits are spent                                                                                                                                        |
| `DUMMY_ODDS`      | Optional, `true` in Vercel **Preview** only: shows clearly labeled practice odds. The live site ignores it.                                                                                                                   |

None of these start with `NEXT_PUBLIC_`, so Next.js never sends them to the browser.

**On Vercel**, also allow Vercel to reach your database: in MongoDB Atlas → Network Access, add `0.0.0.0/0` (Vercel's addresses change).

---

## What's new in Week 7

- **Invite codes.** A new visitor must enter a valid code before reaching sign up. Codes are hard to guess, counted only when an account is created, and limited to a few wrong tries in a row.
- **Login protection.** After 5 wrong passwords for an email (or 20 for a network address), login waits 15 minutes. Counts are saved in the database, and the message is the same whether or not the account exists.
- **Profile page.** Change email, change password (this logs out other devices), or delete the account and all its slips.
- **Copy a slip.** Starts a new slip from an old one. Picks for games that already started are skipped (and you are told), odds are refreshed to your sportsbook's current lines, and the copy becomes your active slip.
- **Estimated payout.** A pretend wager (default $10, from $0.01 to $10,000) shows profit and total return from each pick's saved odds. Parlay and SGP odds are multiplied, and SGPs are labeled "Estimated".
- **Live scores.** Score, quarter, and clock on game cards, matchup pages, and slips, refreshed about every 30 seconds while a game is on. Each pick shows Winning, Losing, Push, or Pending. If scores can't load, the last score stays with a "Scores delayed" note.
- **NBA.** Odds, matchup, team, and player pages work for the NBA as well as the NFL. Matchups also show a collapsible box of live or final game stats.
- **Product basics.** A "for reference only" notice, a 21+ notice, a responsible-gambling link (1-800-GAMBLER), and template Privacy and Terms pages.
- **Security hardening.** A Content-Security-Policy, size limits on every request, safe logging, a lockout, and a full audit and penetration test (see below).
- **Automated tests.** `npm test` runs 639 tests: conflict rules, parlay and payout math, auth, invite codes, lockout, profile, slip CRUD and ownership, live-score grading, and the attack tests.

### How to run the tests

```bash
npm test            # all 639 tests, about 15 seconds, on a throwaway in-memory database
npm run typecheck   # TypeScript
npm run lint        # code style
npm run build       # the same build Vercel does
```

The tests never touch `backroom-vegas-dev` or the live database.

### Documentation (the `docs` folder)

| Document                                               | What it covers                                                                                  |
| ------------------------------------------------------ | ----------------------------------------------------------------------------------------------- |
| [`docs/value-statement.md`](docs/value-statement.md)   | What the app does, who it's for, the problem, and the value                                     |
| [`docs/system-diagram.md`](docs/system-diagram.md)     | How the browser, guard, app, database, and outside APIs connect                                 |
| [`docs/data-model.md`](docs/data-model.md)             | Every database collection, field, and relationship                                              |
| [`docs/api-design.md`](docs/api-design.md)             | Every API route and Server Action: method, address, body, response, and whether login is needed |
| [`docs/component-tree.md`](docs/component-tree.md)     | The page and component hierarchy, where state lives, and where data is fetched                  |
| [`docs/security-audit.md`](docs/security-audit.md)     | The pre-ship security checklist, checked against the code                                       |
| [`docs/penetration-test.md`](docs/penetration-test.md) | Five attacks on my own app, with the exact requests and results                                 |
| [`docs/security-review.md`](docs/security-review.md)   | What I checked, what I tried to break, what I found and fixed, and the risks that remain        |
| [`docs/qa-checklist.md`](docs/qa-checklist.md)         | The manual walk-through of the whole app on a phone and a computer                              |

---

## Postman collections

In the `postman/` folder. Drag each file onto the Postman window to import it.

| File                                       | What it tests                                                                                                                                                                                                                                         |
| ------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `external-apis.postman_collection.json`    | The outside APIs the app uses: The Odds API (events, game lines, markets, props, halves) and ESPN (scoreboard, teams, rosters, injuries, news, game summaries, players). Uses an `{{odds_api_key}}` variable you set in your own Postman environment. |
| `internal-routes.postman_collection.json`  | The app's own API routes: games, one game, props, teams, injuries, news, search, and players. Includes "not found", "bad input", "logged out", and CORS tests.                                                                                        |
| `betslips.postman_collection.json`         | The bet slip API: create, list, get, rename, change picks, and delete, plus conflict and SGP checks and the active slip. Each request checks its own result (see the Test Results tab).                                                               |
| `login-lockout.postman_collection.json`    | The login lockout: 5 wrong passwords, then `429` for 15 minutes even with the right password. Use `login-lockout.postman_environment.json`.                                                                                                           |
| `penetration-test.postman_collection.json` | The five attacks (no token, tampered token, another user's data, bad input, oversized requests). Fill `emailA`, `emailB`, and `password` with two throwaway dev accounts. Never run it against the live site.                                         |
| `internal-local.postman_environment.json`  | The settings the two internal collections use: `baseUrl` and an **empty** `session_cookie`.                                                                                                                                                           |

**Staying logged in for the internal collections:** log in to the app in your
browser, open DevTools → Application (Chrome) or Storage (Safari) → Cookies →
`bv_session`, copy its value, and paste it into `session_cookie` in the Postman
environment (in the Current value column only). Never commit or share it.

---

## Advanced feature: Server Actions

Login, sign up, log out, and the Settings sportsbook picker use **Server Actions**:
functions that run only on the server but are called straight from a form.

| Action                      | File                      | What it does                                                                                                                                                      |
| --------------------------- | ------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `signup`, `login`, `logout` | `app/actions/auth.ts`     | Checks the form with zod, hashes passwords with bcrypt, and sets or clears the 7-day login cookie                                                                 |
| `saveSportsbook`            | `app/actions/settings.ts` | Checks the choice (only Hard Rock Bet or BetMGM), saves it to _your_ account (your ID comes from your login cookie, never from the form), then refreshes the page |

The forms use React's `useActionState` to show "Logging in…" or "Saving…" and
the server's error messages. They also work with JavaScript turned off.

---

## Testing the NFL news widget (four states)

The **NFL news** box at the bottom of the Feed loads in the browser from
`/api/news`, so it has four different looks. Under the box there's a
**"For testing"** row of links, or you can type these addresses:

| Look                        | How to see it                                                                                                                                                        |
| --------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Loading** (gray cards)    | `/?news=slow`: the API waits 3 seconds before answering. Or the real way: in **Chrome** DevTools → **Network** → throttling menu → **Slow 4G** (or 3G), then reload. |
| **Error** (message + Retry) | `/?news=bad-url`: the box asks for an address that doesn't exist. **Retry** asks again.                                                                              |
| **Empty**                   | `/?news=empty`: the API answers with no stories.                                                                                                                     |
| **News**                    | `/`: picture, headline, short summary, and a link to the story on ESPN.                                                                                              |

These test switches only change what _that visitor_ sees; they never change
any data. Screenshots of all four looks are in `docs/week6-capstone-news-widget-screenshots/`.

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
   every piece of text _as text_: if a headline contained `<script>`, you'd
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
   example, slip names are 1–50 characters and sportsbooks must be one of the two we support.
5. **Safety headers on every answer.** `X-Content-Type-Options: nosniff` (a
   file can't be passed off as a script), `X-Frame-Options: DENY` (other sites
   can't frame our pages to trick clicks), `Strict-Transport-Security` (https
   only), `Referrer-Policy`, and `Permissions-Policy` (no camera, microphone, or
   location). Every page also gets a **Content-Security-Policy** (built in
   `lib/security/csp.ts`, sent by `proxy.ts`): scripts must carry a fresh secret
   code (a "nonce") made for that page view, pictures may only come from us and
   ESPN, and the browser may only talk to our own site, so an injected script
   would be refused.

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

### Security checks I ran

- [`docs/security-review.md`](docs/security-review.md): **the Security Review**, one document that combines everything below: what I checked, what I tried to break, what I found and fixed, the AI-suggestion table, and the risks that remain.
- [`docs/security-audit.md`](docs/security-audit.md): the pre-ship checklist, checked against the code.
- [`docs/penetration-test.md`](docs/penetration-test.md): five attacks on my own app (no token, tampered token, another user's data, bad or injection input, oversized requests), with the exact requests and results. Re-run them with `npm run pentest` (see the file's header) and `npm test`, or import `postman/penetration-test.postman_collection.json`.

### Known limits

- **The CSP allows `style="..."` attributes** (`style-src-attr 'unsafe-inline'`),
  because React writes one for the "Chance of winning" bar. Scripts are strict.
- **ESPN's API is unofficial** and not meant for commercial use, which is fine
  for a non-commercial school project. It can change without warning, and the
  app checks every answer with zod for that reason.
- **`npm audit` is clean today** (0 known vulnerabilities), but new ones are found
  all the time, so it is re-run before every release.
- **Caesars** was removed (it had no odds in The Odds API). `npm run caesars:remove -- --db <database>` moves anyone still on it to Hard Rock Bet
  instead of showing a page of dashes.

### When an AI tool suggested something unsafe

This app was built with an AI coding assistant (Claude Code). These are the
times an AI tool or an example it worked from would have done something
unsafe, and what was done instead:

| What was suggested or considered                                                                                                             | Why it was unsafe                                                                                                                          | What we did instead                                                                                                 |
| -------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------- |
| The Next.js docs' CORS example uses `Access-Control-Allow-Origin: *`                                                                         | Any website could call the API from a visitor's browser                                                                                    | An allowlist (`ALLOWED_ORIGINS`) that never accepts `*`                                                             |
| Letting the Bet Slips page call its own API using the address from the incoming request (the `Host` header)                                  | A faked `Host` could make the server send a user's login cookie to another website                                                         | The address always comes from `APP_URL` in the settings                                                             |
| An early code comment claimed TypeScript would stop the password hash from being sent to the browser                                         | TypeScript types don't exist when the app runs, so they can't stop anything                                                                | `toUser()` copies only safe fields, and the database never loads the password hash unless asked (`select: false`)   |
| Allowing pictures from any website through Next.js's image resizer                                                                           | Strangers could use our server to fetch and resize any picture                                                                             | Only ESPN's `a.espncdn.com/i/...` is allowed; news pictures load straight from ESPN                                 |
| Showing ESPN news as it arrives (it can contain HTML)                                                                                        | HTML from another site could run in our pages (XSS)                                                                                        | All news is turned into plain text on the server; no `dangerouslySetInnerHTML`                                      |
| Logging full Odds API request addresses while debugging                                                                                      | The address includes the API key, which would end up in logs                                                                               | The app logs only the number of credits left, never the address                                                     |
| Two pages (team page, New Slip) relied only on the page guard's cookie check                                                                 | A valid cookie for a deleted account would still pass                                                                                      | Both pages also check the account still exists (`requireUser`)                                                      |
| A news link from ESPN would have been used as-is                                                                                             | A `javascript:` link would run code when tapped                                                                                            | Only `https://` links are kept                                                                                      |
| The first after-login redirect guard only blocked `//` and `/\` at the start                                                                 | A hidden tab or line break (`/%09/evil.com`) slipped through, and the browser turned it into `//evil.com`: an open redirect to a fake site | The guard refuses all hidden characters and backslashes and checks the final address stays on this site, with tests |
| The public database health check (`/api/health/db`) answered "Check MONGODB_URI and MongoDB Atlas Network Access" when the database was down | It told any stranger which database the app uses and the name of a secret setting                                                          | It now says only "The database isn't available right now."; the details go to the server log                        |
| The ESPN address builder trusted that callers had checked IDs                                                                                | If a future page forgot to check, an ID like `..` could make the server fetch a different ESPN address (path traversal)                    | Every address is checked for `.`, `..`, and hidden slashes before it's used, with tests                             |
| `process.env.MONGODB_DB ?? "backroom-vegas"`: if the database name setting was missing, quietly use the live database                        | A forgotten setting on a Preview or on a laptop would point testing and tests at real users' data                                          | Only Vercel's production environment may fall back; anywhere else a missing name is an error, with a test           |
| News pictures allowed from any `https` website (the first `isSafeImage`)                                                                     | A story could make visitors' browsers load a picture from any server (tracking, or content we never chose)                                 | Only `*.espncdn.com` pictures are shown, matching the Content-Security-Policy                                       |
| Logging whole error objects when ESPN or the Odds API failed (`console.error("...", error)`)                                                 | An error object can carry the request address (with the API key) or a connection string into the logs                                      | Seven places now use `logServerError`, which prints one cleaned-up line and hides connection strings                |

<!-- Add any other time an AI tool suggested something unsafe that you rejected: -->

---

## Data sources and credits

- **ESPN**: stats, scores, injuries, news, logos, and photos, through ESPN's public, unofficial API. This is a non-commercial school project; ESPN content belongs to ESPN.
- **The Odds API**: live odds and props.
- Made for learning. Not affiliated with ESPN, the NFL, Hard Rock Bet, or BetMGM.
