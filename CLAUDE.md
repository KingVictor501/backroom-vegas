# CLAUDE.md — Week 7 working rules for The Vegas Backroom

This file tells Claude Code how to work on this project. It carries over every rule from the Week 6 capstone and adds this week's assignment, rubric, and build plan. Next.js-specific notes live in @AGENTS.md.

## Where things stand

- Week 6 as submitted is tagged **`w6-capstone`** (commit `b3ac7a3`).
- Week 7 work happens on the **`week-7`** branch. `main` is the live site (https://backroom-vegas.vercel.app) and only changes when Week 7 is merged.
- Local `.env.local` uses the test database **`backroom-vegas-dev`**. The live site uses **`backroom-vegas`**. Never point local testing, automated tests, or the Week 7 preview at the live database.
- I created new environment variable values for the Week 7 preview site on Vercel.
- Most of Week 6's work is already done, but it needs to be double-checked on this branch. **Do not rebuild anything that already works.** Check first, report what you find, and only fix or build what I approve.

## What this week is

The Week 7 assignment is to extend what I shipped: new features, deeper functionality, real polish, and security hardening, so the app is ready to ship.

## How to work with me

- I'm new to coding. Explain everything in plain English, like I've never coded. I need to understand everything well enough to explain it to my instructor.
- Work **one section at a time**, only the one I ask for. Don't rebuild or restyle finished sections unless I ask.
- After each section:
  1. Show the diff.
  2. Explain what you built and what each new or changed file is for.
  3. Tell me exactly how to test it and what I should see.
  4. Tell me how to check it at phone, tablet, and desktop sizes in DevTools.
  5. Run the test suite (once it exists) and tell me the result.
  6. Wait for me to say **"next section."**
- Commit to git after every section or major change, on the `week-7` branch.
- At the end of every reply, restate my remaining to-do steps.
- When a step is mine (API sign-up, adding a key, Vercel, Postman, creating an invite code), tell me exactly how, ask a yes/no question, and wait for my answer.
- If something didn't work, fix it before moving on.
- Never ask me to paste a real API key, password, invite code, or connection string into the chat. Tell me which file or dashboard to put it in.
- If something won't work, breaks the rubric, or is a bad idea, say so before building it.
- Check the current Next.js docs (https://nextjs.org/docs) and React docs (https://react.dev/versions) before writing code, and tell me which pages you checked.
- Before writing code for a new API or endpoint, ask me for a real sample response from Postman.
- Postman: give drag-and-drop or copy-paste steps, or generate collection files I can import. Menu-by-menu steps are often out of date.

## Safety check on every diff

Before I approve a diff, check for these four problems:

1. A login or user route that sends back the password hash.
2. A GET route that doesn't filter by the logged-in user.
3. A POST, PUT, PATCH, or DELETE route (or Server Action) that doesn't check the data it receives.
4. A secret (API key, password, invite code, or connection string) pasted into the code instead of kept in `.env.local`.

If you find one, explain it and fix it. If none, say:
**"Safety check: none of the four problems found."**

## Comments in the code

- Top of every file: what it's for, which files use it, and why it has its name and ending (`.tsx`, `.ts`, `route.ts`).
- Above every function, component, and object: what it does in plain English.
- When code uses something from another file: where it comes from and why.
- Explain confusing lines, especially security, database, and API code.
- Keep comments simple. No jargon unless you explain the word.
- `null` only means "missing on purpose" and always has a comment saying why.

## Rules to follow every time

- App Router (`app` folder) only. Never the old `pages` folder.
- TypeScript only. Never use `any`. No `.js` or `.jsx` files. Files that show something on screen end in `.tsx`; API routes are `route.ts`; everything else is `.ts`.
- One shared type per main thing (for example the bet slip), imported everywhere. New fields go in the shared type and the database model together.
- Pages load data on the server. Only interactive parts use `"use client"`.
- API keys stay on the server. The browser never calls an outside API directly.
- Check every form and request for bad or missing data, on the server. Errors are **loud red** through `components/ErrorMessage.tsx`, and invalid inputs turn red.
- Users can only see, edit, copy, or delete their own data. Enforce it on the server, not just by hiding buttons.
- Never use `dangerouslySetInnerHTML`. Turn outside HTML into plain text.
- Errors never show stack traces or internal details. Never log passwords, tokens, invite codes, or connection strings.
- Cache outside API results so request limits aren't used up.
- If an outside API fails, show a friendly message, never a crash or white screen.
- Every page or widget that loads data has all four states: loading, error, empty, and data.
- League settings stay in `config/leagues.ts`.
- Show times in the user's own time zone.
- Responsive: 1 column on phones, 2 on tablets, left sidebar + right slip panel on desktop, no sideways scrolling.
- Accessible: labels, alt text, keyboard-friendly popups and menus, readable text.
- CORS allows only our own site (`ALLOWED_ORIGINS`), never `*`.
- On-screen name is always **"The Vegas Backroom."** Backend names (repo, package, database, `bv_session` cookie) stay "backroom-vegas."
- Every new environment variable goes in `.env.example` (name only), `.env.local`, and Vercel for the right environment (**Preview** for `week-7`, **Production** when merged to `main`).
- Never use historical odds. Historical data is player and team stats only.
- Every new feature gets automated tests (after Section 2 sets up testing).

## Lessons learned (Week 6)

- Next 16: middleware is `proxy.ts`, and the `error.tsx` prop is `retry`.
- `APP_URL` and `ALLOWED_ORIGINS` must have no trailing slash.
- The Bet Slips page fetches its own API through `APP_URL`, so Vercel Preview needs its own `APP_URL` (the branch's preview link).
- Turbopack sometimes misses edits made from the shell. Restart the dev server if you see "is not a function."
- Grid items with wide tables need `min-w-0` / `grid-cols-1` or they widen the page on phones.
- ESPN times look like `...T00:20Z` and The Odds API uses `...:00Z`, so normalize them before matching games.
- The raw ESPN injuries feed is about 17 MB, so cache it hard.
- Caesars has had no odds in The Odds API, and the app says so.
- Only one dev server at a time, or use another port (`npx next dev -p 3100`).
- Keep adding to the README table "When an AI tool suggested something unsafe."

## The app (what already exists)

- **The Vegas Backroom** helps sports bettors compare odds from Hard Rock Bet, BetMGM, and Caesars, read NFL news, look up team and player stats, and build bet slips for straight bets, parlays, and same game parlays (SGPs). Slips are saved to the user's account. It's a reference tool only: nobody places real bets or spends real money.
- **Built with:** Next.js 16 (App Router) and TypeScript, MongoDB, hosted on Vercel. One Vercel project: the pages and API routes live in the same app, so one URL serves both the frontend and the backend.
- **Data:** NFL Football API (RapidAPI), The Odds API (live odds and props, limited free requests), ESPN's unofficial API (stats, injuries, news, logos, scores).
- **Already built:** email/password sign up and login (Server Actions, bcrypt-hashed passwords, signed JWT in the `bv_session` cookie), Feed, league page, matchup page with market tabs and player props, team page, player page, bet slip pages with full CRUD, conflict rules and popup, Build your own SGP, Settings with sportsbook choice, NFL news widget with four states, CORS, README with a Security section.
- When you need details about how something works, read the existing code instead of guessing.

## New features this week

1. **Invite codes.** Before anyone reaches the login or sign up page, they must enter a valid invite code. Graders get a code in the README.
2. **Login protection.** After 5 wrong passwords, the user has to wait a few minutes. Limit attempts per account and per IP.
3. **Profile page.** Change email, change password, and delete the account.
4. **Copy a slip.** Duplicate an old slip as a starting point for this week.
5. **Estimated payout.** Bet slips show an estimated payout based on the odds from the sportsbook each pick came from.
6. **Live scores on game cards.** While a game is on, show the score and quarter, and mark picks as "winning" or "losing" in real time.
7. **Automated tests.** A test suite that runs the conflict rules, auth, and API routes with one command.

Also this week, from the Week 6 "make it shippable" list: a Content-Security-Policy header, separate databases for Preview, and product basics (a "for reference only" disclaimer, a 21+ notice, a responsible-gambling link, a privacy policy, and terms of use).

**Not this week (stay parked):** the Insights tab (AI), other leagues (NBA, NHL, and the rest), password reset, and email verification. Don't build these.

## Grading rubric (Week 7)

Architecture & Planning
1. Value statement: one paragraph on what the app does, who it's for, the problem, and the value. (Done when: a stranger reads it and understands why the app should exist.)
2. System diagram: frontend, backend, database, and how they connect. (Done when: someone can trace a request from the browser to the database and back.)
3. Data model: every entity, field, type, and relationship, including the link that ties data to a user. (Done when: the schemas match this model field-for-field.)
4. API design: every endpoint's method, URL, body, response, and whether it requires auth. (Done when: I could hand this list to Postman and test every route from it.)
5. Component tree: frontend hierarchy, where state lives, and where API calls happen. (Done when: the folder structure mirrors the tree.)

Full-Stack Implementation
6. At least 3 frontend routes, one protected, on top of the auth pages. (Done when: three-plus content routes are reachable from the nav, and a logged-out visitor is bounced from the protected one.)
7. At least 1 protected route: sign up and login work, passwords hashed, sessions use a signed JWT, auth middleware (`proxy.ts`) protects routes. (Done when: I can sign up, log out, log back in, and the database shows a hash, not a password.)
9. Full CRUD on at least 1 user-owned resource. (Done when: create, edit, and delete all work from the UI and survive a server restart.)
10. User-scoped data, enforced on the server. (Done when: logged in as user A, requesting user B's record by ID is refused.)
11. Frontend wired to backend: real data, and four states on every view. The auth token rides along on protected requests. (Done when: I can walk the main journey end to end with real data.)
12. Feature-complete and polished, responsive. (Done when: the full journey looks finished on desktop and a phone.)

Security & QA
13. Security audit passed: no hardcoded secrets, .env gitignored, JWT secret in an env var with an expiration, hashed passwords, all POST/PUT routes validate input, auth middleware on every protected route, CORS locked to a specific origin in production, no stack traces in errors, no logging of sensitive data, npm audit shows no critical vulnerabilities. (Done when: every item is checked against the actual code and fixed.)
14. Penetration test: five attacks run and documented (no token, tampered token, another user's data, bad/injection input, oversized upload or request). (Done when: all five are refused with the right status, nothing bad happens in the database, and the results are written down.)
15. Security Review document: what I checked, what I tried to break, what I found, what I fixed, and the risks that remain. (Done when: it reads as one coherent document.)
16. Tests passing and QA pass on auth and core CRUD. (Done when: the suite is all green and I've walked the journey by hand without surprises.)
17. Deployed live on public URLs, with production env vars and database. (Done when: a classmate on a different device and network runs the full journey on my live URL.)

## Week 6 rubric (must keep working)

Nothing this week may break these.

| Item | Done when |
|---|---|
| App Router scaffold: TypeScript, app folder, 3+ routes | All three URLs load with no errors |
| API route (GET) at `app/api/betslips/route.ts` | Visiting it in the browser shows JSON |
| Server-rendered list (no `useEffect`) | The list shows in page source with JavaScript off |
| Client filter, sort, or search (`"use client"`) | The list updates instantly with no reload |
| Dynamic `[id]` detail route | A real ID shows the slip; a fake ID shows "not found" |
| Full CRUD | Create → it appears, edit → it saves, delete → it's gone |
| Shared layout + `loading.tsx` + `error.tsx` | Menu stays put; slow page shows loading; broken page shows a friendly error |
| Deployed to Vercel | A stranger in incognito can sign up and use bet slips |
| Four-states fetch widget | Loading, error, empty, and normal can each be shown |
| Security review README section | Section exists; no `dangerouslySetInnerHTML` on user input |
| Consistent TypeScript types | One bet slip type imported everywhere, no `any` |
| One advanced feature (Server Actions) | Works on the live site |

## Pre-ship security audit

- [ ] Every secret is in a `.env` file, not the code.
- [ ] `.env` files are in `.gitignore`.
- [ ] A search for keys, passwords, and connection strings comes up clean (including git history).
- [ ] Passwords are bcrypt-hashed before they're saved.
- [ ] The JWT signing secret comes from an environment variable, and sessions expire.
- [ ] Every POST, PUT, PATCH, and DELETE route and Server Action validates input on the server.
- [ ] A login check guards every route that needs a logged-in user.
- [ ] Every query checks ownership, so users only reach their own data.
- [ ] Third-party API keys are used only on the server.
- [ ] File uploads allow only certain types and have a maximum size (the app has no uploads; confirm requests have size limits instead).
- [ ] CORS allows only the frontend's exact origin.
- [ ] Error messages show only what the user needs: no stack traces or internal details.
- [ ] Nothing logs passwords, tokens, invite codes, or connection strings.
- [ ] A Content-Security-Policy header is set.
- [ ] `npm audit` shows no critical vulnerabilities.

## Checklists

**Works locally but not live? Check in this order:**
1. A missing or mistyped Vercel environment variable (in the right environment), or Atlas not allowing `0.0.0.0/0`.
2. CORS only allowing localhost (`ALLOWED_ORIGINS` must exactly match the URL, no trailing slash).
3. `APP_URL` still pointing at localhost or the wrong URL (Preview needs the branch's preview link).

**Final ship check:** the build passes, all tests are green, no keys on GitHub, every variable is in Vercel, an incognito invite → sign-up works, create/rename/delete works, and someone new tries it.

## Known risks (for the Security Review)

- ESPN's API is unofficial and not for commercial use.
- The Parlay API needs a signed agreement before its data can be shown publicly.
- The Odds API free plan has a request limit (upgrade planned).
- Caesars has had no odds in The Odds API.

## BUILD ORDER

I'll ask for one section at a time. Every section ends the same way: **show the diff**, run the safety check, run the tests (once they exist), explain it in plain English, tell me how to test it on phone, tablet, and desktop, commit, restate my to-do steps, and wait for me.

### Section 0: Double-check the Week 7 branch (no code changes)

Don't change any code in this section. Just look and report.

1. Confirm we're on the `week-7` branch, and that `w6-capstone` and `main` are untouched.
2. Check that `.env.local` exists, is in `.gitignore`, and points at `backroom-vegas-dev` (never show me values). Check that `.env.example` lists every variable name the app uses.
3. Walk me through checking Vercel for the Week 7 preview:
   - Every variable from `.env.local` exists in Vercel for the **Preview** environment (scoped to `week-7` if I set it up that way).
   - Preview uses `backroom-vegas-dev` or its own preview database, never the live `backroom-vegas` database.
   - `APP_URL` and `ALLOWED_ORIGINS` for Preview are the stable `week-7` branch preview link, with no trailing slash. Explain how to find that link, since normal preview URLs change every deploy.
   - Whether Vercel's Deployment Protection is on for previews. If it is, graders and classmates hit a Vercel login screen instead of the app, so explain my options (turn it off for previews, use a shareable link, or grade the merged live site).
4. Run the app, the existing tests (if any), `npm run build`, and `npm audit`.
5. Check every Week 7 rubric item (6, 7, 9, 10, 11, 12, 13, 17) and every Week 6 rubric item against the actual code.

Then give me a table with three columns: rubric item, status (✅ done, ⚠️ partly done, ❌ missing), and what you found. Suggest which section of this plan fixes each problem.

Done when: I have the table and the Vercel checklist. No code has changed.

**Next step:** go through the Vercel checklist with me one item at a time and confirm each one. Confirm with me before Section 1.

### Section 1: Fix what Section 0 found

Fix only the problems from the Section 0 table that I approve. Don't start new features yet. For each fix, tell me which rubric item it helps.

Done when: everything I approved is fixed, the build passes, and the preview site works. Show the diff.

**Next step:** push `week-7`, wait for the preview to redeploy, and test the fixes on the preview link. Confirm with me before Section 2.

### Section 2: Set up automated tests

Set up a test system that runs everything with one command: `npm test`. Use a separate test database (for example, an in-memory MongoDB that starts and stops with the tests) so tests never touch `backroom-vegas-dev` or the live database. Explain in plain English what a unit test and an API test are.

Write the first tests for things that already exist:
- The parlay math and slip type rules (Straight, Parlay, SGP).
- Each conflict rule, the "allowed" same-game case, and the SGP same-game rule.
- Auth: sign up saves a bcrypt hash (not the password), login works with the right password and fails with the wrong one, and a protected route refuses a request with no `bv_session` cookie.
- Bet slip CRUD: create, read, update, delete, and user A being refused when requesting user B's slip.

Done when: `npm test` runs all tests and they pass, and I understand what each test file checks. Show the diff.

**Next step:** run `npm test` myself and confirm it's all green. Confirm with me before Section 3.

### Section 3: Invite codes

Before anyone reaches the login or sign up page, they must enter a valid invite code.

- Create an InviteCode model with: the code, how many sign ups it allows, how many times it has been used for sign up, an optional expiration date, whether it's active, and a short note (like "graders"). Save which invite code each new user signed up with.
- Add an invite page that is the first thing a visitor sees. A valid code is remembered in a secure, httpOnly cookie (for example, for 30 days), then the visitor continues to login or sign up. Use `proxy.ts` to send anyone without a valid invite cookie back to the invite page if they try to reach /login or /signup directly.
- Entering the code on the invite page doesn't use it up. A code is only used up when someone creates an account. Check the code again on the server at sign up, and count the use in the same step that creates the account so two people can't use the last spot at once.
- If a code is wrong, used up, expired, or turned off, show one loud red message through `ErrorMessage.tsx`: "That invite code isn't valid." Don't say which part failed.
- Make codes hard to guess (like BRV-7K2M-Q9XD), and limit how many codes someone can try in a row.
- Make a simple script I can run from the terminal to create a code, choosing how many uses it gets and an optional expiration date. It must create codes in whichever database I choose (dev or live).
- Add tests for valid, fake, used-up, expired, and turned-off codes, and for skipping the invite page.

Done when: a new visitor sees the invite page first, a valid code leads to login/sign up, bad codes are refused, the use count only goes up on sign up, and the tests pass. Show the diff.

**Next step:** create a grader code with at least 10 uses and a code for myself in the dev database. Test the full flow in an incognito window on the preview link. Confirm with me before Section 4.

### Section 4: Login protection

After 5 wrong passwords, make the user wait a few minutes before trying again.

- Track failed attempts per email address and per IP, whether or not the account exists, so the lockout doesn't reveal which emails have accounts.
- After 5 failures, block login for 15 minutes and show a loud red message: "Too many attempts. Try again in a few minutes." A successful login resets the count.
- Store attempts in the database, not just in memory, since Vercel can run the app on many servers.
- Add tests: 5 wrong passwords locks the account, the right password is refused during the lockout, and login works again after the wait.

Done when: the lockout works in the browser and in Postman, and the tests pass. Show the diff.

**Next step:** try 6 wrong passwords on the preview link, confirm I'm locked out, then confirm I can log in after the wait. Confirm with me before Section 5.

### Section 5: Profile page

Add a protected Profile page, reachable from Settings and the menu.

- **Change email:** requires the current password. Check the new email isn't already used.
- **Change password:** requires the current password and the new password twice, with the same rules as sign up. Save it bcrypt-hashed. Keep the user logged in on this device.
- **Delete account:** a confirmation popup where the user types DELETE (or their password). Delete the user and all their bet slips, clear the `bv_session` cookie, and send them to the invite page.
- All three use Server Actions, validate on the server, show errors through `ErrorMessage.tsx`, and never send back the password hash.
- Add tests for each, including a wrong current password and one user trying to change another user's account.

Done when: all three work from the UI, changes show up in MongoDB, a deleted account can't log in, and the tests pass. Show the diff.

**Next step:** test all three on the preview link with a throwaway account. Confirm with me before Section 6.

### Section 6: Copy a slip

Add a "Copy slip" button on the slip detail page and on each slip in the list.

- The copy belongs to the same user and gets a name like "Copy of Sunday Parlay" (50 characters or less).
- Picks for games that already started or finished aren't copied. Tell the user how many were skipped and why.
- Copied picks get refreshed to the current line from the user's sportsbook, and the slip shows which odds changed. If the book has no odds for a pick (for example, Caesars), say so.
- The copy becomes the active slip.
- Add tests: copying works, finished-game picks are skipped, and a user can't copy someone else's slip.

Done when: copying works from both places, the copy shows up in MongoDB, and the tests pass. Show the diff.

**Next step:** copy an old slip on the preview link and check the skipped picks and updated odds. Confirm with me before Section 7.

### Section 7: Estimated payout

Show an estimated payout on bet slips using the odds saved on each pick (which come from that pick's sportsbook).

- Add a "Wager amount" box to the slip detail page, the slip bar, and the desktop slip panel. Default it to $10 and save it on the slip. It's a pretend amount for reference only.
- Show the profit and the total return (wager plus profit). For parlays and SGPs, multiply the picks' odds together. Label SGP payouts "Estimated," since real SGP prices are lower.
- Show which sportsbook the odds came from. If a slip mixes books, say so.
- Validate the wager on the server (a positive number with a sensible maximum).
- Add tests for straight, parlay, and SGP payouts with real example numbers.

Done when: the payout updates instantly when the wager or picks change, matches the tests, and is saved after a refresh. Show the diff.

**Next step:** check a straight, a parlay, and an SGP on the preview link and compare the payouts to an online payout calculator. Confirm with me before Section 8.

### Section 8: Live scores on game cards

While a game is on, show the score and quarter on its game card, and mark picks as winning or losing in real time.

- Use ESPN's free scoreboard so it doesn't use Odds API requests. Before writing code, ask me to test the ESPN scoreboard and game summary in Postman and paste a sample response. Normalize ESPN times before matching games (see Lessons learned).
- Show the score, quarter, and game clock on game cards, the matchup page, and slip pages. Show "Final" when the game ends.
- Refresh about every 30 seconds, but only while a live game is on screen and the browser tab is open.
- For each pick in a live game, show Winning, Losing, Push, or Pending. Work it out from the score for spreads, totals, and moneylines. For player props, use ESPN's live box score if available; otherwise show "Live." When final, show Won, Lost, or Push.
- If scores can't load, keep the last known score and show a small "Scores delayed" note instead of breaking the page.
- Add tests for the winning/losing logic with example scores (a spread, a total, a moneyline, and a prop).

Done when: during a live game the score updates without refreshing, statuses change correctly, and the tests pass. If no game is live while I'm building, show me how to test with a finished game or a saved sample response. Show the diff.

**Next step:** watch a live game on the preview link (or use the test method you gave me) and confirm the statuses change. Confirm with me before Section 9.

### Section 9: Four states everywhere, polish, and product basics

- Go through every page and widget that loads data (Feed, league page, matchup page, market pages, team page, player page, bet slips list and detail, profile, live scores) and make a checklist of which of the four states each one has. Add any missing state, styled to match the theme.
- Check every page at phone, tablet, and desktop sizes and fix anything unfinished: spacing, long names, empty lists, wide tables (`min-w-0`), buttons too small to tap.
- Make sure the menu reaches every main page, including Profile.
- Add the product basics: a "for reference only" disclaimer, a 21+ notice, a responsible-gambling link (for example, 1-800-GAMBLER and its website), and simple Privacy Policy and Terms of Use pages linked from the footer or Settings. Mark any legal wording as a template for me to review, not as legal advice.

Done when: the checklist shows all four states on every view, the full journey looks finished on a phone and desktop, and the product basics are linked. Show the diff.

**Next step:** walk the whole journey on my phone and computer on the preview link and note anything that looks off. Confirm with me before Section 10.

### Section 10: Architecture documents

Create a `docs` folder with these documents, written from the actual finished code so they match it exactly. Use plain English and Markdown, with diagrams in Mermaid so they show up on GitHub.

1. **Value statement** (`docs/value-statement.md`): one paragraph on what The Vegas Backroom does, who it's for, the problem it solves, and the value it creates. Write a draft and let me edit it in my own words.
2. **System diagram** (`docs/system-diagram.md`): the browser, pages and components, API routes and Server Actions, `proxy.ts` (auth, invite gate), CORS, MongoDB, and the three outside APIs, with arrows showing how a request travels from the browser to the database and back. Include one example request traced step by step.
3. **Data model** (`docs/data-model.md`): every entity (User, BetSlip, Selection, InviteCode, login attempts, and anything else) with every field, its type, whether it's required, and how entities relate. Point out the field that ties each record to a user.
4. **API design** (`docs/api-design.md`): every API route and Server Action with method, URL, request body, response, and whether it requires login. Mark public vs. protected. Also generate a Postman collection file I can import to test every route.
5. **Component tree** (`docs/component-tree.md`): the page and component hierarchy, where state lives (for example, the bet slip provider), and where API calls happen, matching the folder structure.

Done when: all five documents exist, match the code field-for-field and route-for-route, and the diagrams render on GitHub. Show the diff.

**Next step:** rewrite any part of the value statement that doesn't sound like me, and import the Postman collection and test a few routes. Confirm with me before Section 11.

### Section 11: Security audit

Go through every item in the **Pre-ship security audit** checklist above against the actual code, and fix what fails. Add a Content-Security-Policy header that doesn't break the app (team logos, fonts, and any outside images still load). If fixing an `npm audit` issue would break something, explain the trade-off before changing it.

Give me the checklist with ✅ or ❌, where in the code you checked, and what you fixed.

Done when: every item is ✅, the build passes, and the tests still pass. Show the diff.

**Next step:** read the checklist and ask about anything I can't explain yet. Confirm with me before Section 12.

### Section 12: Penetration test

Run these five attacks against my own app, locally against `backroom-vegas-dev` and on the preview link, and give me a Postman collection file for them:

1. **No token:** call protected routes with no `bv_session` cookie. Expect 401 (or a redirect to login for pages).
2. **Tampered token:** change a character in the cookie, or sign a fake one with the wrong secret. Expect 401.
3. **Another user's data:** logged in as user A, read, edit, copy, and delete user B's slip by ID. Expect 403 or 404, and confirm nothing changed in MongoDB.
4. **Bad or injection input:** send wrong types, missing fields, script tags, and MongoDB-style injection like {"$gt": ""} to login, sign up, invite code, profile, and slip routes. Expect 400 and no database change.
5. **Oversized request:** the app has no file uploads, so send huge requests instead: a giant slip name, thousands of picks, a huge wager, and a very large body. Expect 400 or 413, not a crash.

Fix every hole, and every 500 where a clean 400, 401, 403, or 404 was expected. Turn each attack into an automated test. Write the results in `docs/penetration-test.md`: the attack, the exact request, the expected result, the actual result, and what I fixed.

Done when: all five attacks are refused correctly, the database is unchanged, the attack tests pass, and the write-up exists. Show the diff.

**Next step:** run at least two attacks myself in Postman so I can describe them in my presentation. Confirm with me before Section 13.

### Section 13: Security Review document

Write `docs/security-review.md` as one coherent document combining Sections 11 and 12:

- What I checked (the audit checklist).
- What I tried to break (the five attacks).
- What I found.
- What I fixed.
- The risks that remain, named honestly. Include the **Known risks** above, plus anything new (for example: free API limits, the unofficial ESPN API, no email verification or password reset yet).
- Every time an AI tool suggested something unsafe, and what I did instead (from the README table).

Link it from the README's Security section.

Done when: it reads clearly start to finish and matches the code. Show the diff.

**Next step:** read it out loud and fix anything that doesn't sound like me. Confirm with me before Section 14.

### Section 14: Tests, QA, merge, and live deploy

1. Run the full test suite and `npm run build`. Everything must be green before deploying.
2. Give me a manual QA checklist for the whole journey: invite code → sign up → log out → log in → lockout after 5 wrong passwords → Feed → matchup → add picks → conflict popup → SGP → payout → copy slip → live scores → profile changes → delete account. Include phone and desktop.
3. Update the README with: the value statement, the live URL, the grader invite code, how to run the tests, the new Week 7 features, and links to everything in `docs`.
4. Walk me through going live:
   - Add every new Week 7 variable to Vercel **Production**.
   - Create the grader invite code in the **live** `backroom-vegas` database.
   - Merge `week-7` into `main` only after I confirm, then check the live site.
5. If anything works on the preview but not live, use the **Works locally but not live** checklist above.
6. Run the **Final ship check** above.

Done when: the suite is green, I've walked the QA checklist by hand, the live site works, and the final ship check passes. Show the diff.

**Next step:** send the live URL and grader invite code to a classmate on a different device and network, and ask them to run the full journey. Confirm it worked, then the project is ready to submit.
