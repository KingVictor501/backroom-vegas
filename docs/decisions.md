# Decisions and the reasons for them

Each row is a choice that could have gone another way, what I chose, and why. Where a choice had a downside, the downside is named too.

## How the app is built and run

| Decision | What I chose | Why | The trade-off |
|---|---|---|---|
| One app or a separate backend | **One Next.js app on Vercel.** Pages, API routes and Server Actions live in the same project and share one web address | Less to set up and keep in sync, no cross-site (CORS) problems between a frontend and a backend, and one deploy. A beginner can trace a request in one codebase | If the app got very large, the backend would be harder to scale on its own |
| Database | **MongoDB Atlas** with Mongoose | Slips hold a list of picks, which fits a document well. Atlas is free to start and works with Vercel | Fewer built-in links between records than a SQL database, so the code has to check ownership itself |
| Pages load data on the server | Server components first; `"use client"` only for the interactive parts | Pages show in the page source with JavaScript off, load fast, and keep API keys on the server | Anything interactive needs a client piece, which is more files |
| Forms | **Server Actions** for sign up, login, invite, profile and settings | The form posts straight to server code, so validation and errors run on the server where they can be trusted | Server Actions can't be called by Postman as easily as a plain API route |
| Shared types | One type per main thing (bet slip, game), imported everywhere. TypeScript only, no `any` | A change to a field is caught everywhere at once | A little more typing up front |

## Security choices

| Decision | What I chose | Why | The trade-off |
|---|---|---|---|
| Where the login token lives | A signed JWT in an **httpOnly cookie** (`bv_session`), 7 days | JavaScript on the page can't read an httpOnly cookie, so a script injected into the page can't steal it. I looked at keeping the token in browser storage and rejected it for that reason | The cookie rides along on every request, so the app also checks the request's origin |
| Password storage | **bcrypt**, cost 12 | It is slow on purpose, so guessing is expensive. The database holds a hash, never the password | Login takes a fraction of a second longer |
| Who can see what | **Every slip query includes the user's ID.** Another user's slip comes back "not found" (`404`), not "forbidden" | Hiding buttons isn't security. The server decides. `404` also doesn't reveal that the slip exists | None worth naming |
| Invite codes and login lockout stored in the **database**, not memory | Counters and codes live in MongoDB | Vercel can run the app on many servers at once, so memory on one server can't count attempts across all of them | One extra database read on login |
| Lockout design | 5 wrong passwords per email and 20 per IP lock for 15 minutes. The keys are scrambled with a secret | Counting per email and per IP stops both guessing one account and spraying many. Counting unknown emails too means the lockout doesn't reveal which emails have accounts | A real user who mistypes five times waits 15 minutes |
| Content-Security-Policy | A **nonce** (a one-time code per page view) built in `proxy.ts` | It lets our own scripts run and blocks injected ones, without allowing "unsafe-inline" scripts | Every page has to be built per visit, so none is cached as a static file. I accepted that for the safety |
| Input and size limits | Every POST, PUT, PATCH, DELETE and Server Action checks input with **zod** on the server. JSON bodies cap at 100,000 characters (`413`); Server Action bodies at 100 kB | A bad or huge request is refused before it reaches the database | Legitimate slips are far below the limits (name ≤ 50, ≤ 25 picks, wager $0.01–$10,000) |
| Database name safety | Only Vercel **Production** may fall back to the live database. Anywhere else, a missing name is an error | A forgotten setting on a laptop or Preview used to point testing at real users' data | A missing setting stops the app instead of quietly working |
| Separate databases | Live = `backroom-vegas`. Preview and local = `backroom-vegas-dev` | Testing and attack scripts never touch real accounts | Two sets of environment variables to keep correct in Vercel |

## Data and features

| Decision | What I chose | Why | The trade-off |
|---|---|---|---|
| Saving odds | Odds are cached (6 hours); Preview uses made-up "practice odds" | The Odds API free plan has a request limit. The browser never calls it directly, and a server cache means many visitors share one request | Odds can be hours old |
| Live scores | From **ESPN's free scoreboard**, refreshed about every 30 seconds, only while a live game is on screen and the tab is open | Costs no Odds API credits, and nothing runs when nobody is watching | ESPN's API is unofficial and could change |
| Showing the Feed | Pages of 3 rows, live games behind a tick box, and only this week's games | Keeps the page short and focused. Paging is a display change, so it doesn't reduce the (cached) Odds API requests | NBA needs one ESPN request per remaining day, because ESPN refuses a date range |
| What "this week" means | A setting per league in `config/leagues.ts` (`weekEndsOn`): the NFL week ends Monday night; every other league runs Sunday to Saturday | League rules belong in one config file, so adding a sport doesn't mean changing code | Eastern time is used for every league |
| Errors | Loud red messages from one component (`ErrorMessage.tsx`); friendly text only; details go to the server log, never the screen | A mistake should be impossible to miss, and a stranger should never see internals | None worth naming |
| No historical odds | Historical data is player and team stats only. The app shows current lines only | A project rule from the start. The app's job is comparing today's prices, so it doesn't need past ones | Can't show how a line moved |
| Parked features | AI Insights, other leagues, password reset and email verification are not built | Finishing and securing the core journey mattered more than adding features | Listed as remaining risks in `security-review.md` |

## Where each decision is checked
- Security choices: `docs/security-audit.md`, `docs/penetration-test.md`, `docs/security-review.md`.
- How it all connects: `docs/system-diagram.md`. Where code and state live: `docs/component-tree.md`.
