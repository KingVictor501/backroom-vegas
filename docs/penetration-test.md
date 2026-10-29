# Penetration test (Section 12)

A **penetration test** ("pen test") is when you attack your own app on purpose, the way a bad actor would, to find holes before a real attacker does. Each attack below has a plain-English name, how it was done, what it protects against, the expected result, and the actual result.

## How the testing was done (three layers)

| Layer | What it is | Where it lives | How to run it |
|---|---|---|---|
| 1. Attack script | 101 real web requests sent to the running app (a "production build", the same kind Vercel runs), covering attacks 1–5. It makes two throwaway users (A and B), attacks, checks the database, then deletes everything it made. It refuses to run against the live database or live site. | `scripts/pentest.ts` | Start the app (`npm run build && npx next start -p 3100`), then `npm run pentest -- --base http://localhost:3100 --db backroom-vegas-dev --out results.md` |
| 2. Automated attack tests | 14 tests for the **forms** (invite code, sign up, login, change email, change password, delete account, settings). Forms are Server Actions, so a web request can't reach them the same way. Runs inside `npm test` on a throwaway in-memory database. | `tests/pentest.test.ts` | `npm test` |
| 3. Postman collection | The same attacks as a file you can import, so you can run (and explain) them by hand. 53 requests, each with a pass/fail check. | `postman/penetration-test.postman_collection.json` | Import it into Postman, fill the `emailA`, `emailB`, `password` variables (current value only), and use the Collection Runner |

**What counts as "refused correctly":** the right status code (`401` not logged in, `403` forbidden, `404` not found, `400` bad input, `413` too big), no `500` crash, no stack trace, database error or password hash in the answer, and **the database unchanged**.

## Attack 1: "No token" (knocking on the door without a key)

- **Name:** No token.
- **How it was done:** Sent 18 API requests and 10 page visits with **no `bv_session` cookie**, as a stranger would: reading, creating, editing, copying and deleting slips, plus games, teams, news, injuries, search and live scores.
- **What it protects against:** Anyone using or changing data without logging in. Guards: `withUser` on every API route and `proxy.ts` on every page.
- **Expected:** API `401`; pages redirect (`307`) to `/login`.
- **Actual:** All 28 matched. Forms (change email/password, delete account, settings) with no cookie also redirect to `/login` and change nothing (`tests/pentest.test.ts`).

## Attack 2: "Tampered token" (a forged key)

- **Name:** Tampered token.
- **How it was done:** Took a real login cookie and broke it eight ways: one character of the signature changed; the user ID inside swapped for another user's while keeping the old signature; signed with a different secret; the **"alg: none"** trick (claims to be unsigned, a famous JWT attack) with A's and with B's identity; signature removed; random garbage; empty value. Each was sent to an API route and a page. A control request with the untouched cookie proved the real one still works.
- **What it protects against:** Someone pretending to be another user by editing their cookie. The cookie is signed with `AUTH_SECRET`, which only the server knows (`lib/auth/token.ts` accepts only `HS256`, and rejects invite-cookie tokens used as login cookies).
- **Expected:** `401` from the API, redirect to `/login` from pages.
- **Actual:** All 8 refused; the control returned `200`.

## Attack 3: "Another user's data" (reading your neighbour's mail)

- **Name:** Another user's data (also called broken access control or IDOR).
- **How it was done:** Logged in as **user B** and tried to read, rename, change the wager of, replace the picks of, **copy, delete**, and set as active **user A's slip**, using A's real slip ID. Then compared A's slips in MongoDB before and after, byte for byte.
- **What it protects against:** One user reaching another user's records by guessing or learning an ID. Every slip query includes the owner (`{ _id, userId }`), enforced on the server, not just by hiding buttons.
- **Expected:** `404` (not `200`, and not `403`, so B cannot even learn that the slip exists); A's data unchanged.
- **Actual:** All 7 attacks returned `404`; B's list never contained A's slip; A's records were identical; B's active slip was never pointed at A's. The form version (B adding A's ID or email to forms, trying to take A's email address) also changed nothing.

## Attack 4: "Bad or injection input" (feeding the app poison)

- **Name:** Bad or injection input.
- **How it was done (30+ requests):**
  - **MongoDB injection:** `{"$gt": ""}` and `{"$ne": null}` where text is expected (email, password, slip name, `sgpGameId`, pick ID, active slip ID, and in URLs).
  - **Wrong types:** numbers, arrays, objects, and a file instead of text; missing fields; broken JSON; plain text instead of JSON.
  - **Impossible values:** odds of `5`, a league called `evil`, a sportsbook that no longer exists, duplicate pick IDs, a negative wager, a wager of `1e999`, a wager as the word "ten".
  - **Script tags** in slip names, search words and game IDs (cross-site scripting, "XSS").
  - **Path traversal:** `../../etc/passwd` as an ID.
  - **Mass assignment:** adding extra `userId` and `_id` fields to create/update requests to hand a slip to someone else or choose its ID.
  - **Another website** (CORS): `Origin: https://evil.example`.
  - **Open redirect:** `next=https://evil.example` on login.
- **What it protects against:** Corrupt data, database tricks, scripts running in someone's browser, and users taking over records. Guards: zod validation on the server in every route and action, owner-scoped queries, React's automatic escaping (no `dangerouslySetInnerHTML`), the CORS list, and `safeNextPath`.
- **Expected:** `400` (or `404` for IDs that match nothing, `415` for non-JSON, `403` for CORS), no database change, nothing leaked.
- **Actual:** All refused. Two results worth explaining:
  - `GET /api/games?league[$ne]=nfl` returned `200`. This is **correct**: the server only reads the exact key `league`, so `league[$ne]` is an unrelated key that is ignored and the default league is used. The injection never reaches the database. (My first version of the script expected a `400` and flagged it; the expectation was wrong, not the app.)
  - A `<script>` tag saved as a slip *name* is stored as plain text and shown as harmless text. The test checks the page never contains a live `<script>alert` tag.
- Extra fields `userId` and `_id` were ignored: the slip was saved for A with a fresh ID, and a PATCH with `userId` did not change the owner.

## Attack 5: "Oversized request" (trying to overwhelm it)

- **Name:** Oversized request. (The app has no file uploads, so the attacks use huge requests instead.)
- **How it was done:** A 51-character slip name (1 over the limit); a 60,000-character name; a 2 MB body; 26 picks (1 over); 5,000 picks; wagers of $10,000.01, one trillion, and 12 decimal places; a 5 MB junk body to login; a 300,000-character update; JSON nested 5,000 levels deep; a 5,000-character search word; a 20,000-character web address; a live-scores request for 500 games; and for the forms, 1,000,000-character emails, passwords and invite codes, and a password over bcrypt's 72-byte limit.
- **What it protects against:** Crashes, memory exhaustion, slow requests, and bloated database records. Guards: the 100,000-character JSON body cap (`413`), per-field length limits, the 25-pick and 10,000-dollar limits, the 100 KB Server Action limit, and Next's own limit on very long addresses (`431`).
- **Expected:** `400` or `413` (or `431` for a huge address), never a crash.
- **Actual:** All 14 refused with the right codes; no oversized slip was saved; the app and database were still healthy afterwards.

## Overall results

- **Attack script:** 101 of 101 checks passed. No attack produced a `500` error. No answer leaked a stack trace, database error or password hash.
- **Automated attack tests:** 14 of 14 pass (part of `npm test`).
- **Holes found:** none that needed an app code change. The hardening this test relies on was added in Sections 2–11 (the 100,000-character body cap, owner-scoped queries, size limit for Server Actions, safe logging, strict token reading). The one failed check in the first run was a wrong expectation in my script (explained under Attack 4), not an app problem.
- **Not covered here, and why:** wrong-password login attempts. Running them from this script would lock out your own network address for 15 minutes. That attack is covered by `tests/login-lockout.test.ts` and `postman/login-lockout.postman_collection.json` (Section 4).
- **Not tested:** the live site (on purpose), and a browser check of the CSP (Section 14 checklist).

## Full results of the attack script run

Run against a production build on `http://localhost:3100` using the `backroom-vegas-dev` database. Every row is one request or check.

| Attack | Test | Request | Expected | Actual | Result |
|---|---|---|---|---|---|
| 1 | No token: GET /api/betslips | `GET /api/betslips with NO cookie` | 401 | 401 | PASS |
| 1 | No token: POST /api/betslips | `POST /api/betslips with NO cookie` | 401 | 401 | PASS |
| 1 | No token: GET /api/betslips/<slipId> | `GET /api/betslips/<slipId> with NO cookie` | 401 | 401 | PASS |
| 1 | No token: PATCH /api/betslips/<slipId> | `PATCH /api/betslips/<slipId> with NO cookie` | 401 | 401 | PASS |
| 1 | No token: DELETE /api/betslips/<slipId> | `DELETE /api/betslips/<slipId> with NO cookie` | 401 | 401 | PASS |
| 1 | No token: POST /api/betslips/<slipId>/copy | `POST /api/betslips/<slipId>/copy with NO cookie` | 401 | 401 | PASS |
| 1 | No token: GET /api/betslips/active | `GET /api/betslips/active with NO cookie` | 401 | 401 | PASS |
| 1 | No token: PUT /api/betslips/active | `PUT /api/betslips/active with NO cookie` | 401 | 401 | PASS |
| 1 | No token: GET /api/games | `GET /api/games?league=nfl with NO cookie` | 401 | 401 | PASS |
| 1 | No token: GET /api/games/401873022 | `GET /api/games/401873022?league=nfl with NO cookie` | 401 | 401 | PASS |
| 1 | No token: GET /api/games/401873022/props | `GET /api/games/401873022/props?league=nfl&category=passing with NO cookie` | 401 | 401 | PASS |
| 1 | No token: GET /api/live | `GET /api/live?league=nfl&games=401873022 with NO cookie` | 401 | 401 | PASS |
| 1 | No token: GET /api/teams | `GET /api/teams?league=nfl with NO cookie` | 401 | 401 | PASS |
| 1 | No token: GET /api/teams/12 | `GET /api/teams/12?league=nfl with NO cookie` | 401 | 401 | PASS |
| 1 | No token: GET /api/players/3139477 | `GET /api/players/3139477?league=nfl with NO cookie` | 401 | 401 | PASS |
| 1 | No token: GET /api/injuries | `GET /api/injuries?league=nfl with NO cookie` | 401 | 401 | PASS |
| 1 | No token: GET /api/news | `GET /api/news?league=nfl with NO cookie` | 401 | 401 | PASS |
| 1 | No token: GET /api/search | `GET /api/search?league=nfl&q=mahomes with NO cookie` | 401 | 401 | PASS |
| 1 | No token: page / bounces to login | `GET / with NO cookie` | 307 redirect to /login | 307 -> /login | PASS |
| 1 | No token: page /betslips bounces to login | `GET /betslips with NO cookie` | 307 redirect to /login | 307 -> /login | PASS |
| 1 | No token: page /betslips/new bounces to login | `GET /betslips/new with NO cookie` | 307 redirect to /login | 307 -> /login | PASS |
| 1 | No token: page /betslips/<slipId> bounces to login | `GET /betslips/<slipId> with NO cookie` | 307 redirect to /login | 307 -> /login | PASS |
| 1 | No token: page /profile bounces to login | `GET /profile with NO cookie` | 307 redirect to /login | 307 -> /login | PASS |
| 1 | No token: page /settings bounces to login | `GET /settings with NO cookie` | 307 redirect to /login | 307 -> /login | PASS |
| 1 | No token: page /league/nfl bounces to login | `GET /league/nfl with NO cookie` | 307 redirect to /login | 307 -> /login | PASS |
| 1 | No token: page /matchup/401873022 bounces to login | `GET /matchup/401873022 with NO cookie` | 307 redirect to /login | 307 -> /login | PASS |
| 1 | No token: page /team/12 bounces to login | `GET /team/12 with NO cookie` | 307 redirect to /login | 307 -> /login | PASS |
| 1 | No token: page /player/3139477 bounces to login | `GET /player/3139477 with NO cookie` | 307 redirect to /login | 307 -> /login | PASS |
| 2 | Tampered token (one character of the signature changed) | `GET /api/betslips and GET /betslips with Cookie: bv_session=<one character of the signature changed>` | API 401, page redirect to /login | API 401, page 307 | PASS |
| 2 | Tampered token (payload changed to user B's ID, old signature kept) | `GET /api/betslips and GET /betslips with Cookie: bv_session=<payload changed to user B's ID, old signature kept>` | API 401, page redirect to /login | API 401, page 307 | PASS |
| 2 | Tampered token (signed with a different (wrong) secret) | `GET /api/betslips and GET /betslips with Cookie: bv_session=<signed with a different (wrong) secret>` | API 401, page redirect to /login | API 401, page 307 | PASS |
| 2 | Tampered token (header says alg=none (unsigned) with A's real claims) | `GET /api/betslips and GET /betslips with Cookie: bv_session=<header says alg=none (unsigned) with A's real claims>` | API 401, page redirect to /login | API 401, page 307 | PASS |
| 2 | Tampered token (header says alg=none, user B's claims, no signature) | `GET /api/betslips and GET /betslips with Cookie: bv_session=<header says alg=none, user B's claims, no signature>` | API 401, page redirect to /login | API 401, page 307 | PASS |
| 2 | Tampered token (signature removed) | `GET /api/betslips and GET /betslips with Cookie: bv_session=<signature removed>` | API 401, page redirect to /login | API 401, page 307 | PASS |
| 2 | Tampered token (random garbage text) | `GET /api/betslips and GET /betslips with Cookie: bv_session=<random garbage text>` | API 401, page redirect to /login | API 401, page 307 | PASS |
| 2 | Tampered token (empty cookie value) | `GET /api/betslips and GET /betslips with Cookie: bv_session=<empty cookie value>` | API 401, page redirect to /login | API 401, page 307 | PASS |
| 2 | Control: the untouched real cookie still works | `GET /api/betslips with A's real cookie` | 200 | 200 | PASS |
| 3 | Another user's data: B tries to read A's slip | `GET /api/betslips/<A's slipId> using B's cookie` | 404 (never 200, never A's data) | 404 | PASS |
| 3 | Another user's data: B tries to rename A's slip | `PATCH /api/betslips/<A's slipId> using B's cookie` | 404 (never 200, never A's data) | 404 | PASS |
| 3 | Another user's data: B tries to change A's wager | `PATCH /api/betslips/<A's slipId> using B's cookie` | 404 (never 200, never A's data) | 404 | PASS |
| 3 | Another user's data: B tries to replace A's picks | `PATCH /api/betslips/<A's slipId> using B's cookie` | 404 (never 200, never A's data) | 404 | PASS |
| 3 | Another user's data: B tries to copy A's slip | `POST /api/betslips/<A's slipId>/copy using B's cookie` | 404 (never 200, never A's data) | 404 | PASS |
| 3 | Another user's data: B tries to delete A's slip | `DELETE /api/betslips/<A's slipId> using B's cookie` | 404 (never 200, never A's data) | 404 | PASS |
| 3 | Another user's data: B tries to make A's slip B's active slip | `PUT /api/betslips/active using B's cookie` | 404 (never 200, never A's data) | 404 | PASS |
| 3 | Another user's data: B's slip list never contains A's slip | `GET /api/betslips using B's cookie` | 200, only B's slips | 200, contains A's slip: false | PASS |
| 3 | Another user's data: A's slips in MongoDB are byte-for-byte unchanged | `Read A's slips from MongoDB before and after the attacks` | identical | identical | PASS |
| 3 | Another user's data: B's active slip was not pointed at A's slip | `Read B's user record from MongoDB` | activeBetSlipId is not A's slip | null | PASS |
| 4 | Bad input: login with MongoDB injection in email and password | `POST /api/auth/login body {"email":{"$gt":""},"password":{"$gt":""}}` | 400 / 404 / 415 (or 200 when the odd part is ignored and harmless), no leak | 400 | PASS |
| 4 | Bad input: login with injection only in the password | `POST /api/auth/login body {"email":"pentest-a-mvszu07t@example.com","password":{"$ne":null}}` | 400 / 404 / 415 (or 200 when the odd part is ignored and harmless), no leak | 400 | PASS |
| 4 | Bad input: login with an array instead of text | `POST /api/auth/login body {"email":["pentest-a-mvszu07t@example.com"],"password":["Pent3st-mvszu07t"]}` | 400 / 404 / 415 (or 200 when the odd part is ignored and harmless), no leak | 400 | PASS |
| 4 | Bad input: login with missing fields | `POST /api/auth/login body {}` | 400 / 404 / 415 (or 200 when the odd part is ignored and harmless), no leak | 400 | PASS |
| 4 | Bad input: login with broken JSON | `POST /api/auth/login body {not json` | 400 / 404 / 415 (or 200 when the odd part is ignored and harmless), no leak | 400 | PASS |
| 4 | Bad input: login sent as plain text, not JSON | `POST /api/auth/login body email=a&password=b` | 400 / 404 / 415 (or 200 when the odd part is ignored and harmless), no leak | 415 | PASS |
| 4 | Bad input: login with a 10,000-character password | `POST /api/auth/login body {"email":"pentest-a-mvszu07t@example.com","password":"pppppppppppppppppppppppppppppppppppp…` | 400 / 404 / 415 (or 200 when the odd part is ignored and harmless), no leak | 400 | PASS |
| 4 | Bad input: create slip with injection in the name | `POST /api/betslips body {"name":{"$gt":""}}` | 400 / 404 / 415 (or 200 when the odd part is ignored and harmless), no leak | 400 | PASS |
| 4 | Bad input: create slip with a number as the name | `POST /api/betslips body {"name":12345}` | 400 / 404 / 415 (or 200 when the odd part is ignored and harmless), no leak | 400 | PASS |
| 4 | Bad input: create slip with picks that are not a list | `POST /api/betslips body {"name":"x","picks":"all of them"}` | 400 / 404 / 415 (or 200 when the odd part is ignored and harmless), no leak | 400 | PASS |
| 4 | Bad input: create slip with a pick missing its fields | `POST /api/betslips body {"name":"x","picks":[{"id":"1"}]}` | 400 / 404 / 415 (or 200 when the odd part is ignored and harmless), no leak | 400 | PASS |
| 4 | Bad input: create slip with an impossible odds number | `POST /api/betslips body {"name":"x","picks":[{"id":"pentest-pick-1","gameId":"401873022","league":"nfl","gameLabel…` | 400 / 404 / 415 (or 200 when the odd part is ignored and harmless), no leak | 400 | PASS |
| 4 | Bad input: create slip with a league that does not exist | `POST /api/betslips body {"name":"x","picks":[{"id":"pentest-pick-1","gameId":"401873022","league":"evil","gameLabe…` | 400 / 404 / 415 (or 200 when the odd part is ignored and harmless), no leak | 400 | PASS |
| 4 | Bad input: create slip with an unknown sportsbook | `POST /api/betslips body {"name":"x","picks":[{"id":"pentest-pick-1","gameId":"401873022","league":"nfl","gameLabel…` | 400 / 404 / 415 (or 200 when the odd part is ignored and harmless), no leak | 400 | PASS |
| 4 | Bad input: create slip with duplicate pick IDs | `POST /api/betslips body {"name":"x","picks":[{"id":"pentest-pick-1","gameId":"401873022","league":"nfl","gameLabel…` | 400 / 404 / 415 (or 200 when the odd part is ignored and harmless), no leak | 400 | PASS |
| 4 | Bad input: create slip with a MongoDB operator in sgpGameId | `POST /api/betslips body {"name":"x","sgpGameId":{"$ne":null}}` | 400 / 404 / 415 (or 200 when the odd part is ignored and harmless), no leak | 400 | PASS |
| 4 | Bad input: create slip with a pick ID that is a MongoDB operator | `POST /api/betslips body {"name":"x","picks":[{"id":{"$gt":""},"gameId":"401873022","league":"nfl","gameLabel":"KC …` | 400 / 404 / 415 (or 200 when the odd part is ignored and harmless), no leak | 400 | PASS |
| 4 | Bad input: update slip with nothing to change | `PATCH /api/betslips/6ae2bfaeaedfd23002f33a14 body {}` | 400 / 404 / 415 (or 200 when the odd part is ignored and harmless), no leak | 400 | PASS |
| 4 | Bad input: update slip wager as text | `PATCH /api/betslips/6ae2bfaeaedfd23002f33a14 body {"wager":"ten"}` | 400 / 404 / 415 (or 200 when the odd part is ignored and harmless), no leak | 400 | PASS |
| 4 | Bad input: update slip wager as an infinite number (1e999) | `PATCH /api/betslips/6ae2bfaeaedfd23002f33a14 body {"wager":1e999}` | 400 / 404 / 415 (or 200 when the odd part is ignored and harmless), no leak | 400 | PASS |
| 4 | Bad input: update slip with a negative wager | `PATCH /api/betslips/6ae2bfaeaedfd23002f33a14 body {"wager":-5}` | 400 / 404 / 415 (or 200 when the odd part is ignored and harmless), no leak | 400 | PASS |
| 4 | Bad input: set active slip to an injection object | `PUT /api/betslips/active body {"slipId":{"$ne":null}}` | 400 / 404 / 415 (or 200 when the odd part is ignored and harmless), no leak | 400 | PASS |
| 4 | Bad input: read a slip whose ID is a MongoDB operator | `GET /api/betslips/%7B%22%24ne%22%3Anull%7D` | 400 / 404 / 415 (or 200 when the odd part is ignored and harmless), no leak | 404 | PASS |
| 4 | Bad input: read a slip with a path-traversal ID | `GET /api/betslips/..%2F..%2Fetc%2Fpasswd` | 400 / 404 / 415 (or 200 when the odd part is ignored and harmless), no leak | 404 | PASS |
| 4 | Bad input: games with a league that does not exist | `GET /api/games?league=../../etc` | 400 / 404 / 415 (or 200 when the odd part is ignored and harmless), no leak | 400 | PASS |
| 4 | Bad input: games with an injected league object | `GET /api/games?league[$ne]=nfl` | 400 / 404 / 415 (or 200 when the odd part is ignored and harmless), no leak | 200 | PASS |
| 4 | Bad input: game ID that is not a number | `GET /api/games/%3Cscript%3Ealert(1)%3C%2Fscript%3E?league=nfl` | 400 / 404 / 415 (or 200 when the odd part is ignored and harmless), no leak | 404 | PASS |
| 4 | Bad input: props with a category that does not exist | `GET /api/games/401873022/props?league=nfl&category=drop%20table` | 400 / 404 / 415 (or 200 when the odd part is ignored and harmless), no leak | 400 | PASS |
| 4 | Bad input: live scores with a non-numeric game list | `GET /api/live?league=nfl&games=1,abc,../2` | 400 / 404 / 415 (or 200 when the odd part is ignored and harmless), no leak | 400 | PASS |
| 4 | Bad input: search with a script tag | `GET /api/search?league=nfl&q=%3Cscript%3Ealert(1)%3C%2Fscript%3E` | 400 / 404 / 415 (or 200 when the odd part is ignored and harmless), no leak | 200 | PASS |
| 4 | Bad input: news with a huge limit | `GET /api/news?league=nfl&limit=999999` | 400 / 404 / 415 (or 200 when the odd part is ignored and harmless), no leak | 400 | PASS |
| 4 | Bad input: extra fields userId / _id sneaked into create-slip are ignored | `POST /api/betslips body {name, userId: <B's id>, _id: <chosen>}` | slip is saved for A (userId = A), not B, with a fresh _id | userId is A: true, _id kept: false | PASS |
| 4 | Bad input: an extra userId in an update does not hand the slip to someone else | `PATCH /api/betslips/<A's slipId> body {name, userId: <B's id>}` | slip stays A's | status 200, still A's: true | PASS |
| 4 | Bad input: a script tag typed as a slip name is shown as harmless text | `POST /api/betslips name=<script>alert(...)</script>, then GET /betslips` | page contains the escaped text, never a live script tag | create 201; raw tag in page: false | PASS |
| 4 | Bad input: a request claiming to come from another website (CORS) is refused | `GET /api/betslips with Origin: https://evil.example` | 403 | 403 | PASS |
| 4 | Bad input: no unexpected rows were added to MongoDB by the bad requests | `Count A's slips and the two users before and after` | slips +2 (only the two deliberate ones), users +0 | slips +2, users +0 | PASS |
| 5 | Oversized: a 51-character slip name (1 over the limit) | `POST /api/betslips` | 400 | 400 | PASS |
| 5 | Oversized: a 60,000-character slip name | `POST /api/betslips` | 400 | 400 | PASS |
| 5 | Oversized: a 2,000,000-character slip name (2 MB body) | `POST /api/betslips (body 2,000,011 characters)` | 413 | 413 | PASS |
| 5 | Oversized: 26 picks (1 over the limit of 25) | `POST /api/betslips` | 400 | 400 | PASS |
| 5 | Oversized: 5,000 picks | `POST /api/betslips` | 413 | 413 | PASS |
| 5 | Oversized: a wager of $10,000.01 (1 cent over the limit) | `PATCH /api/betslips/<slipId>` | 400 | 400 | PASS |
| 5 | Oversized: a wager of one trillion dollars | `PATCH /api/betslips/<slipId>` | 400 | 400 | PASS |
| 5 | Oversized: a wager with 12 decimal places | `PATCH /api/betslips/<slipId>` | 400 | 400 | PASS |
| 5 | Oversized: a 5,000,000-character body of junk to the login route | `POST /api/auth/login (body 5,000,000 characters)` | 400 or 413 | 413 | PASS |
| 5 | Oversized: a 300,000-character JSON body to the update route | `PATCH /api/betslips/<slipId> (body 300,024 characters)` | 413 | 413 | PASS |
| 5 | Oversized: JSON nested 5,000 levels deep | `POST /api/betslips` | 400 or 413 | 400 | PASS |
| 5 | Oversized: a search word of 5,000 characters | `GET /api/search?league=nfl&q=qqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqq…(5025 characters)` | 400 or 414 or 431 | 400 | PASS |
| 5 | Oversized: a request address of 20,000 characters | `GET /api/games?league=aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa…(20018 characters)` | 400 or 404 or 414 or 431 | 431 | PASS |
| 5 | Oversized: a live-scores request for 500 games | `GET /api/live?league=nfl&games=401873000,401873001,401873002,401…(5026 characters)` | 400 | 400 | PASS |
| 5 | Oversized: no oversized slip was saved | `Count A's slips before and after the oversized requests` | no change | 0 new slips | PASS |
| 5 | Oversized: the app is still healthy afterwards (no crash) | `GET /api/betslips after all the oversized requests` | 200 | 200 | PASS |
| 5 | Oversized: the database is still reachable afterwards | `GET /api/health/db` | 200 | 200 | PASS |
| 0 | Overall: no attack made the server answer with a 500 error | `Look through every result above` | none | 0 found | PASS |
