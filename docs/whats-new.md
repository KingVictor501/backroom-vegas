# What's new in Week 7

Everything added to The Vegas Backroom this week, in plain English: what it does, where to see it, and which files hold it. Week 6 (tag `w6-capstone`) was the starting point: sign up and login, the Feed, matchup, team and player pages, bet slips with full create/edit/delete, the conflict rules, and the NFL news widget.

## 1. New features

| Feature | What it does | Where to see it | Main files |
|---|---|---|---|
| **Invite codes** | A new visitor must enter a valid code before reaching sign up or login. Codes look like `BRV-XXXX-XXXX`, are hard to guess, and are only used up when an account is created (not when the code is typed). A bad code always gets the same red message, and too many wrong tries in a row are blocked | `/invite` is the first page a logged-out visitor sees | `app/actions/invite.ts`, `lib/db/inviteCodes.ts`, `lib/db/models/InviteCode.ts`, `scripts/create-invite-code.ts` (makes codes) |
| **Login protection** | 5 wrong passwords for one email, or 20 from one network address, locks login for 15 minutes. The message is the same whether or not the account exists. A good login resets the count. Counts are saved in the database | `/login` | `lib/auth/loginAttempt.ts`, `lib/db/models/AttemptCounter.ts` |
| **Profile page** | Change email (needs the current password), change password (logs out your other devices), or delete the account and all its slips | `/profile`, reached from the menu and Settings | `app/actions/profile.ts`, `components/profile/` |
| **Copy a slip** | Starts a new slip from an old one. Picks for games that already started are skipped (and you're told how many), odds are refreshed to your sportsbook's current lines, and the copy becomes your active slip | "Copy slip" on `/betslips` and on a slip's page | `app/api/betslips/[id]/copy/route.ts`, `lib/betting/copySlip.ts`, `lib/db/betslipCopy.ts` |
| **Estimated payout** | A pretend wager (default $10, $0.01 to $10,000) shows profit and total return from each pick's saved odds. Parlay and SGP odds are multiplied, and SGPs are labeled "Estimated". Shows which sportsbook the odds came from | The slip page, the slip bar, and the desktop slip panel | `components/betslip/PayoutBox.tsx`, `lib/betting/payout.ts` (the math) |
| **Live scores** | Score, quarter and clock on game cards, matchup pages and slips, refreshed about every 30 seconds, only while a live game is on screen and the tab is open. Each pick shows Winning, Losing, Push or Pending. If scores can't load, the last score stays with a "Scores delayed" note | Feed, matchup page, slip page | `app/api/live/route.ts`, `components/live/useLiveScores.ts`, `components/live/livePoller.ts`, `lib/betting/grading.ts` |
| **NBA** | Odds, matchup, team and player pages work for the NBA as well as the NFL, and a matchup has a collapsible box of live or final game stats | The NBA tab on the Feed | `config/leagues.ts`, `lib/services/espn/basketball.ts`, `components/basketball/` |
| **Product basics** | A "for reference only" notice, a 21+ notice, a responsible-gambling link (1-800-GAMBLER), and template Privacy and Terms pages (marked as templates to review, not legal advice) | The footer and `/privacy`, `/terms` | `components/SiteFooter.tsx`, `app/(legal)/` |
| **Automated tests** | One command, `npm test`, runs 661 tests on a throwaway in-memory database: conflict rules, parlay and payout math, auth, invite codes, lockout, profile, slip CRUD and ownership, live-score grading, and the attack tests | Terminal | `tests/`, `lib/**/*.test.ts` |

## 2. Feed upgrades (added after the first build)

| Change | What it does | Main files |
|---|---|---|
| **3 rows per page with a page indicator** | The Feed shows 3 rows of game cards (3 cards on a phone, 6 on a tablet or wider) with Previous, numbered pages and Next under the cards. Live games come first, then upcoming games by soonest start | `lib/feed/paging.ts`, `components/feed/GameBrowser.tsx` |
| **Show live games tick box** | Sits above the cards, unchecked at first, so live games are hidden until it's ticked. Live scores only refresh for the cards on the page you're looking at | `components/feed/GameBrowser.tsx` |
| **Only this week's games** | The list runs from now to the end of the league's week: Monday night for the NFL, Saturday for the NBA and other leagues (Sunday to Saturday). The filter buttons are now This Week and Today. The week setting lives in `config/leagues.ts` (`weekEndsOn`) | `lib/format/gameTime.ts`, `config/leagues.ts` |
| **NBA full week** | ESPN's plain NBA scoreboard returns only today, so the app asks for each remaining day of the week and combines them | `lib/services/espn/games.ts` |
| **Remaining schedule on team pages** | A collapsed "Remaining schedule" under Last 5 games (NFL and NBA) | `components/team/TeamSections.tsx`, `lib/services/espn/schedule.ts` |

## 3. Security and shipping

| Change | What it does | Main files |
|---|---|---|
| **Content-Security-Policy** | Each page view gets a one-time code (a nonce) so only our own scripts run. Also added: HSTS, no `X-Powered-By` header | `lib/security/csp.ts`, `proxy.ts`, `next.config.ts` |
| **Size limits** | JSON bodies are capped at 100,000 characters (`413`), Server Action bodies at 100 kB, and a slip name at 50 characters, 25 picks and a $10,000 wager | `lib/api/respond.ts`, `next.config.ts`, `lib/betting/validation.ts` |
| **Safe logging** | One logging helper prints short, cleaned-up lines and never passwords, tokens, invite codes or connection strings | `lib/logging/safeLog.ts` |
| **Open-redirect fix** | The after-login redirect refuses hidden characters and backslashes (an AI-suggested guard had let `/%09/evil.com` through) | `lib/auth/validation.ts`, `tests/pentest.test.ts` |
| **Image allow-list** | News pictures only load from `*.espncdn.com` | `components/feed/NewsWidget.tsx` |
| **Separate databases** | Live uses `backroom-vegas`; Preview and local use `backroom-vegas-dev`. Only Vercel Production may fall back to the live database; anywhere else a missing name is an error | `lib/db/mongodb.ts` |
| **Practice odds on Preview** | The Preview site shows made-up odds (with a banner) so testing spends no Odds API credits | `lib/services/odds/dummyOdds.ts`, `components/PracticeOddsNotice.tsx` |
| **Security audit and pen test** | A 15-item audit checked against the code, and a 101-check attack script covering no token, tampered token, another user's data, injection input and oversized requests (`npm run pentest`) | `docs/security-audit.md`, `scripts/pentest.ts` |

## 4. Documents added

| Document | What it covers |
|---|---|
| [`value-statement.md`](value-statement.md) | What the app does, who it's for, the problem and the value |
| [`system-diagram.md`](system-diagram.md) | How the pieces connect, one request step by step, and where it's deployed |
| [`data-model.md`](data-model.md) | Every collection, field and relationship |
| [`api-design.md`](api-design.md) | Every route and Server Action, with whether login is needed |
| [`component-tree.md`](component-tree.md) | The page and component hierarchy, and where state and API calls live |
| [`decisions.md`](decisions.md) | The choices made and the reasons for them |
| [`security-audit.md`](security-audit.md), [`penetration-test.md`](penetration-test.md), [`security-review.md`](security-review.md) | The audit, the five attacks, and the combined Security Review with the risks that remain |
| [`qa-checklist.md`](qa-checklist.md) | The manual walk-through on phone and desktop |
| [`wiring-log.md`](wiring-log.md) | Which pages call which endpoints, how the four states were forced, and one diff changed before approving |
| Postman collections | `postman/` and `docs/` hold importable collections for the routes and the attacks |

## 5. Still parked (not built this week, on purpose)
AI Insights, other leagues (NHL, MLB and the rest are in the config but turned off), password reset and email verification. Each is listed as a remaining risk or limit in [`security-review.md`](security-review.md).
