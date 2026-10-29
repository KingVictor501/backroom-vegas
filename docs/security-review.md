# Security Review: The Vegas Backroom

Reviewed on the `week-7` branch. This one document combines two pieces of work: the **security audit** (Section 11, checking the code against a checklist) and the **penetration test** (Section 12, attacking my own app). The detailed evidence is in [`security-audit.md`](security-audit.md) and [`penetration-test.md`](penetration-test.md).

**In one paragraph:** The app is a reference tool: nobody places real bets or spends real money. It still stores email addresses and password hashes, so it is built so that (1) only logged-in people reach data, (2) people only reach their own data, (3) everything typed or sent is checked on the server, and (4) secrets never touch the code. I checked all 15 audit items against the real code, fixed three problems (listed below), and ran 115 attacks. Every attack was refused, none produced a server crash, and the database never changed. The risks that remain are listed honestly at the end.

---

## 1. What I checked

The 15-item pre-ship audit, each checked against the actual code. Full evidence (file names and commands) is in [`security-audit.md`](security-audit.md).

| # | Check | Result |
|---|---|---|
| 1 | Every secret is in a `.env` file, not the code | ✅ |
| 2 | `.env` files are in `.gitignore` | ✅ |
| 3 | No keys, passwords or connection strings anywhere, including git history | ✅ |
| 4 | Passwords are bcrypt-hashed (cost 12) before saving; the hash is never sent to the browser | ✅ |
| 5 | JWT secret comes from an environment variable (32+ characters) and sessions expire (7 days) | ✅ |
| 6 | Every POST, PUT, PATCH and DELETE route and Server Action validates input on the server | ✅ |
| 7 | A login check guards every route that needs a user | ✅ |
| 8 | Every query checks ownership, so users only reach their own data | ✅ |
| 9 | Third-party API keys are used only on the server | ✅ |
| 10 | Requests have size limits (the app has no file uploads) | ✅ fixed |
| 11 | CORS allows only the frontend's exact origin, never `*` | ✅ |
| 12 | Error messages show only what the user needs | ✅ |
| 13 | Nothing logs passwords, tokens, invite codes or connection strings | ✅ fixed |
| 14 | A Content-Security-Policy header is set | ✅ new |
| 15 | `npm audit` shows no critical vulnerabilities (it shows none at all) | ✅ |

**Protections built earlier in Week 7 that the audit and attacks relied on:**
- **Invite codes** (hard to guess, counted only when an account is created, 5 wrong tries then a 15-minute wait).
- **Login lockout** (5 wrong passwords per email or 20 per network address, 15 minutes, stored in the database so every Vercel server agrees; the same message for emails with and without accounts).
- **Profile changes** need the current password; changing the password logs out older sessions on other devices; deleting an account removes its slips.
- **Safety headers** on every response: `X-Content-Type-Options`, `X-Frame-Options: DENY`, `Strict-Transport-Security`, `Referrer-Policy`, `Permissions-Policy`, and a Content-Security-Policy with a fresh random nonce for every page view.

## 2. What I tried to break

Five attacks, run against a production build with a throwaway pair of users in the dev database. Each one is explained step by step in [`penetration-test.md`](penetration-test.md).

| # | Attack | What I did | Expected | Actual |
|---|---|---|---|---|
| 1 | **No token** | 18 API requests and 10 page visits with no login cookie; the forms with no cookie | `401`, or redirect to login | All refused |
| 2 | **Tampered token** | 8 forged cookies: signature changed, user ID swapped, wrong secret, the "alg none" trick, signature removed, garbage, empty | `401` | All refused; the real cookie still worked |
| 3 | **Another user's data** | User B tried to read, rename, change the wager of, replace the picks of, copy, delete and activate user A's slip, and tried to take A's email | `404`, nothing changed | All `404`; A's records identical |
| 4 | **Bad or injection input** | MongoDB operators like `{"$gt":""}`, wrong types, impossible values, script tags, path traversal, smuggled `userId` and `_id` fields, another website's origin, open-redirect `next` addresses | `400` / `404` / `415` / `403` | All refused; extra fields ignored |
| 5 | **Oversized request** | Giant names, 5,000 picks, a $1 trillion wager, 2 MB and 5 MB bodies, 5,000-level-deep JSON, 20,000-character addresses, 1,000,000-character form fields | `400` / `413` / `431` | All refused; the app stayed healthy |

**Totals:** 101 of 101 web-request checks and 14 of 14 form attack tests passed. Zero `500` errors. No answer leaked a stack trace, a database error or a password hash. The whole suite is 639 automated tests and passes with `npm test`; `npm run pentest` re-runs the attacks.

**Not attacked on purpose:** wrong-password guessing in the attack script (it would lock my own network address). That is covered by the lockout tests and the Section 4 Postman collection. The live site was never attacked.

## 3. What I found

1. **The database name could silently fall back to the live database.** If `MONGODB_DB` was missing, the code used `backroom-vegas` (live). A forgotten setting on a Preview or a laptop would have pointed testing at real users' data.
2. **Server Actions accepted forms up to 1 MB.** Every form here is a few hundred characters.
3. **Seven server logs printed whole error objects**, which can carry request addresses (with API keys) or connection strings into logs.
4. **News pictures could come from any `https` website**, which the new Content-Security-Policy would have blocked anyway and which let a story pull a picture from a server we never chose.
5. **The 404 page could not receive the Content-Security-Policy nonce**, because it was prebuilt. Its scripts would have been blocked.
6. **The README was out of date**: it said there was no login limit and no Content-Security-Policy, and it still described an `npm audit` warning that no longer exists.
7. **One failed attack check** in my first pen-test run. This was a wrong expectation of mine, not an app problem: `?league[$ne]=nfl` returns `200` because the server only reads the exact key `league` and ignores the rest. The injection never reaches the database.
8. **Missing pages answer with status `200`.** A fake team, game or slip ID shows a correct "not found" message but is not a real `404` status. This is not a security hole, it was not caused by this week's changes, and I have not fixed it (see risks).

No attack found a way to read, change or delete another person's data, or to log in without a valid signed cookie.

## 4. What I fixed

| Finding | Fix | Proof |
|---|---|---|
| 1. Silent fallback to the live database | Only Vercel's production environment may fall back; anywhere else a missing name is an error | `tests/dbname.test.ts` |
| 2. 1 MB Server Action forms | `serverActions.bodySizeLimit: "100kb"` in `next.config.ts` | Attack 5 form tests |
| 3. Whole error objects in logs | They now use `logServerError`, which prints one cleaned-up line and hides connection strings | `lib/logging/safeLog.test.ts`, audit item 13 |
| 4. Pictures from any site | `isSafeImage` accepts only `https` and `*.espncdn.com`, matching the policy | `components/feed/NewsWidget.tsx` |
| 5. 404 page without a nonce | `await connection()` in the root layout makes every page render per visit; I checked every script tag on a production build carries the nonce | `lib/security/csp.test.ts` and header checks |
| 6. Stale README | Corrected the security section | `README.md` |
| 7. Wrong pen-test expectation | Fixed the script's expectation and explained it in the write-up | `docs/penetration-test.md` |
| 8. Soft 404 status | Not fixed. Recorded as a known limit | Risk list below |

I also confirmed the Content-Security-Policy in a real browser (Safari): no "Refused to…" messages on the preview.

## 5. Every time an AI tool suggested something unsafe

This app was built with an AI coding assistant (Claude Code). These are the times an AI tool, or an example it worked from, would have done something unsafe, and what I did instead. (Kept in sync with the same table in the README.)

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
| `process.env.MONGODB_DB ?? "backroom-vegas"`: if the database name setting was missing, quietly use the live database | A forgotten setting on a Preview or on a laptop would point testing and tests at real users' data | Only Vercel's production environment may fall back; anywhere else a missing name is an error, with a test |
| News pictures allowed from any `https` website (the first `isSafeImage`) | A story could make visitors' browsers load a picture from any server (tracking, or content we never chose) | Only `*.espncdn.com` pictures are shown, matching the Content-Security-Policy |
| Logging whole error objects when ESPN or the Odds API failed (`console.error("...", error)`) | An error object can carry the request address (with the API key) or a connection string into the logs | Seven places now use `logServerError`, which prints one cleaned-up line and hides connection strings |

**The lesson from the table:** an AI tool writes code that works and looks reasonable, so every suggestion that touches trust (who is the user, what is allowed, what gets logged, which website we talk to) has to be read and tested, not just run.

## 6. Risks that remain

I name these honestly. None is a known way to read or change someone else's data.

**Data and outside services**
- **ESPN's API is unofficial** and not meant for commercial use. It can change or disappear without warning. The app validates every ESPN answer with zod and shows a friendly message if it fails, but I cannot promise it keeps working.
- **The Odds API free plan has a request limit.** The app caches results (6 hours for odds) and Preview uses practice odds so it does not spend credits, but real odds can run out. An upgrade is planned.
- **The Parlay API** needs a signed agreement before its data can be shown publicly. The app does not fetch any data from it; only a name label exists in `config/sportsbooks.ts`. It must stay unused until that agreement exists.
- **Caesars** had no odds in The Odds API and was removed.

**Accounts and login**
- **No email verification and no password reset yet** (parked on purpose). Anyone with a valid invite code can sign up with an email they do not own, and a user who forgets their password cannot recover the account.
- **Sign up says when an email already has an account** ("An account with this email already exists"). That is clear for users, but it lets someone with an invite code test whether an email is registered. Login and the lockout say the same thing for existing and non-existing emails.
- **Sessions are stateless.** Logging out deletes the cookie on that device, but a copied cookie works until it expires (7 days) or the password is changed. A "log out everywhere" button would need a session list in the database.
- **Invite codes can be shared.** A code works for as many sign-ups as I set; anyone holding it can use up the uses.
- **Lockout uses the visitor's network address from Vercel's forwarded header.** Someone with many addresses could still try many different emails slowly. The per-email limit still holds for each account.

**Hosting and configuration**
- **Preview and live depend on correct Vercel settings.** `MONGODB_DB` must be `backroom-vegas` (Production only) and `backroom-vegas-dev` (Preview only). The code now refuses to guess outside production, but a wrong value in the wrong environment would still point at the wrong database.
- **MongoDB Atlas must allow connections from any address (`0.0.0.0/0`)** because Vercel does not have fixed addresses (this is a setting in Atlas, which I cannot check from the code). The database still needs the username and password in `MONGODB_URI`, which exists only in Vercel and `.env.local`.
- **`AUTH_SECRET` has no rotation plan.** Changing it logs everyone out, which is fine, but nothing reminds me to do it.
- **Vercel Preview deployment protection and toolbar** may show a Vercel login or toolbar to graders on the preview link. The toolbar can print a harmless Content-Security-Policy message there; the live site has no toolbar.

**Code and policy**
- **The Content-Security-Policy allows `style="..."` attributes** (`style-src-attr 'unsafe-inline'`) because React writes one for the "Chance of winning" bar. Scripts are strict (nonce plus `strict-dynamic`). Verified in Safari only, not every browser.
- **Missing pages return status `200`** with a correct "not found" message. Not a security hole. Search engines could index a "not found" page. Not fixed.
- **Rate limits live in MongoDB**, so they cost a database read per login. Fine for this size; a big launch would use a dedicated service.
- **Legal pages are templates.** The privacy policy and terms of use are marked as templates for review and are not legal advice. The app is 21+ and reference-only.
- **`npm audit` is clean today** but new problems are found all the time. Re-run it before every release.
- **No automatic security scanning in CI** (for example a dependency checker on every push).
