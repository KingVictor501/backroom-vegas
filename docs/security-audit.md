# Security audit (Section 11)

Every item of the pre-ship checklist, checked against the actual code. Section 13 combines this with the penetration test into the final Security Review.

| # | Check | Result | Where I checked / what I found |
|---|---|---|---|
| 1 | Every secret is in a `.env` file, not the code | ✅ | Pattern search of the whole codebase (connection strings with passwords, 32-character keys, private keys, `password = "..."`). Only fake strings inside `lib/logging/safeLog.test.ts` matched. Code reads `MONGODB_URI`, `AUTH_SECRET`, `ODDS_API_KEY` from `process.env` |
| 2 | `.env` files are in `.gitignore` | ✅ | `.gitignore` has `.env*` with `!.env.example`. `git ls-files` shows only `.env.example` tracked |
| 3 | No keys, passwords, or connection strings anywhere, including git history | ✅ | Searched every commit's added lines for env assignments and `mongodb+srv://user:pass@` strings. Nothing real. `.env.example` is the only env file ever committed (names only) |
| 4 | Passwords are bcrypt-hashed before saving | ✅ | `app/actions/auth.ts` (sign up) and `app/actions/profile.ts` (change password) use `bcrypt.hash(..., 12)`. `passwordHash` is `select: false` in the model and `toUser` never copies it |
| 5 | JWT secret from an env var, and sessions expire | ✅ | `lib/auth/token.ts`: `AUTH_SECRET` must be 32+ characters or sign-in throws; HS256 only; session tokens expire in 7 days, invite tokens in 30. Cookies are `httpOnly`, `secure` in production, `sameSite=lax` |
| 6 | Every POST/PUT/PATCH/DELETE route and Server Action validates input | ✅ | Routes: login, create/patch slip, active slip (zod), copy and delete (ID shape check, then owner-scoped query). Actions: invite, sign up, log in, settings, change email/password, delete account (zod; logout takes no input) |
| 7 | A login check guards every route that needs a user | ✅ | Every `app/api` route uses `withUser` except `POST /api/auth/login` (must be public) and `GET /api/health/db` (public, reveals only "connected/error"). Every page under `app/(main)` calls `requireUser`/`getCurrentUser`; `proxy.ts` is the first guard |
| 8 | Every query checks ownership | ✅ | All `BetSlipModel` queries in `lib/db/betslips.ts` and `betslipCopy.ts` include `userId` (get, update, delete, copy, set active). User updates use the logged-in user's own ID. Ownership tests in `tests/betslips.ownership.test.ts` |
| 9 | Third-party API keys used only on the server | ✅ | `ODDS_API_KEY` is read only in `lib/services/odds/client.ts` (`server-only`). No `NEXT_PUBLIC_` variables. The browser only calls our own `/api` |
| 10 | Uploads limited; requests have size limits | ✅ (fixed) | No uploads exist. JSON routes refuse bodies over 100,000 characters (`413`). **Fixed:** Server Actions had Next.js's 1 MB default; now `bodySizeLimit: "100kb"` in `next.config.ts` |
| 11 | CORS allows only the frontend's exact origin | ✅ | `lib/api/cors.ts` + `proxy.ts`: only `ALLOWED_ORIGINS` entries, `*` is ignored on purpose, others get `403` |
| 12 | Errors show only what the user needs | ✅ | `withUser` returns generic messages; error screens never print `error.message` or stacks; login says the same thing for a wrong email or password |
| 13 | Nothing logs passwords, tokens, invite codes, or connection strings | ✅ (fixed) | **Fixed:** seven server logs printed whole error objects; they now use `logServerError` (`lib/logging/safeLog.ts`), which cleans the text and hides connection strings. Remaining logs are short fixed messages. Attempt counters store only keyed hashes of emails and IPs |
| 14 | A Content-Security-Policy header is set | ✅ (new) | `lib/security/csp.ts` + `proxy.ts`. Each page view gets a fresh nonce. Checked on a production build: every script tag on login, invite, privacy, Feed, slips, settings, profile, matchup, team pages, and the 404 page carries the nonce, and every response has exactly one CSP header |
| 15 | `npm audit` shows no critical vulnerabilities | ✅ | `found 0 vulnerabilities` |

## Other things fixed in this section

- **Database name could silently fall back to the live database.** `lib/db/mongodb.ts` used `MONGODB_DB ?? "backroom-vegas"` everywhere. Now only Vercel's production environment may fall back; a missing name anywhere else is an error (test: `tests/dbname.test.ts`).
- **News pictures could come from any https site.** `isSafeImage` in `NewsWidget.tsx` now only accepts `*.espncdn.com`, matching the CSP.
- **Added `Strict-Transport-Security`** (https only for two years).
- **Made every page render per visit** (`await connection()` in the root layout), which a nonce needs; before, the 404 page was prebuilt and could not get one.
- **README** said there was no login limit and no CSP; both are now built, so those notes were corrected.

## Content-Security-Policy trade-offs

- `style-src-attr 'unsafe-inline'`: React writes a `style` attribute for the "Chance of winning" bar. Scripts stay strict (nonce plus `strict-dynamic`); `<style>` tags need the nonce.
- `connect-src 'self'`: the browser may only call our own site.
- `img-src` allows `https://*.espncdn.com` (logos, headshots, news pictures), `data:`, and `blob:`.
- Development only: `'unsafe-eval'` and web sockets, for React's debugging tools and hot reload. They are not sent in production.
- **Not browser-tested by me:** I verified the header and nonces with `curl` on a production build, but I did not watch a browser's console for blocked items. Do that check on the preview before merging (steps in the section 11 reply).

## Known remaining risks (carried into the Security Review)

- ESPN's API is unofficial; The Odds API free plan has a request limit.
- Public `GET /api/health/db` exists (shows only whether the database answers).
- The login page is open to anyone; guessing is limited by the lockout (5 per email, 20 per IP, 15 minutes).
- No password reset or email verification yet (parked on purpose).
- Rate limits live in MongoDB, so a determined attacker with many IP addresses could still try many emails.
