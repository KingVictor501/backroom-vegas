# CLAUDE.md — working rules for The Vegas Backroom

This file tells Claude Code how to work on this project. It carries over the
rules from the Week 6 capstone so Week 7 (Course 2 capstone) follows the same
process. Next.js-specific notes live in @AGENTS.md.

## Where things stand
- Week 6 as submitted is tagged **`w6-capstone`** (commit `b3ac7a3`).
- Week 7 work happens on the **`week-7`** branch. `main` is the live site
  (https://backroom-vegas.vercel.app) and only changes when week 7 is merged.
- Local `.env.local` uses the test database **`backroom-vegas-dev`**. The live
  site uses `backroom-vegas`. Never point local testing at the live database.
- Week 7 goal: build on the Week 6 app, add features, and make it ready to ship.

## How to work with me
- I'm new to coding. Explain everything in plain English, like I've never coded.
- Build **one section at a time**, only the one I ask for. Don't rebuild or
  restyle finished sections unless I ask.
- After each section:
  1. Show the diff.
  2. Explain what you built and what each new file is for.
  3. Tell me exactly how to test it and what I should see.
  4. Tell me how to check it at phone, tablet, and desktop sizes in DevTools.
  5. Wait for me to say **"next section."**
- Commit to git after every section or major change.
- At the end of every reply, restate my remaining to-do steps.
- When a step is mine (API sign-up, adding a key, Vercel, Postman), tell me
  exactly how, ask a yes/no question, and wait for my answer.
- If something didn't work, fix it before moving on.
- Never ask me to paste a real API key, password, or connection string into the
  chat. Tell me which file to put it in.
- If something won't work, breaks the rubric, or is a bad idea, say so before
  building it.
- Check the current Next.js and React docs before writing code and tell me which
  pages you checked.
- Before writing code for a new API, ask me for a real sample response from Postman.
- Postman: give drag-and-drop or copy-paste steps, or generate collection files.
  Menu-by-menu steps are often out of date.

## Safety check on every diff
Before I approve a diff, check for these four problems:
1. A login or user route that sends back the password hash.
2. A GET route that doesn't filter by the logged-in user.
3. A POST, PUT, or PATCH route that doesn't check the data it receives.
4. A secret pasted into the code instead of kept in `.env.local`.

If you find one, explain it and fix it. If none, say:
**"Safety check: none of the four problems found."**

## Comments in the code
- Top of every file: what it's for and which files use it, and why it has its
  name and ending (`.tsx`, `.ts`, `route.ts`).
- Above every function, component, and object: what it does in plain English.
- When code uses something from another file: where it comes from and why.
- Explain confusing lines, especially security, database, and API code.
- Keep comments simple. No jargon unless you explain the word.
- `null` only means "missing on purpose" and always has a comment saying why.

## Rules to follow every time
- App Router (`app` folder) only. Never the old `pages` folder.
- TypeScript only. Never use `any`. No `.js` or `.jsx` files.
- One shared type per main thing (for example the bet slip), imported everywhere.
- Pages load data on the server. Only interactive parts use `"use client"`.
- API keys stay on the server. The browser never calls an outside API directly.
- Check every form and request for bad or missing data. Errors are **loud red**
  through `components/ErrorMessage.tsx`, and invalid inputs turn red.
- Users can only see, edit, or delete their own data.
- Never use `dangerouslySetInnerHTML`. Turn outside HTML into plain text.
- Cache outside API results so request limits aren't used up.
- If an outside API fails, show a friendly message, never a crash or white screen.
- League settings stay in `config/leagues.ts`.
- Show times in the user's own time zone.
- Responsive: 1 column on phones, 2 on tablets, left sidebar + right slip panel
  on desktop, no sideways scrolling.
- Accessible: labels, alt text, keyboard-friendly popups and menus, readable text.
- CORS allows only our own site (`ALLOWED_ORIGINS`), never `*`.
- On-screen name is always **"The Vegas Backroom."** Backend names (repo,
  package, database, `bv_session` cookie) stay "backroom-vegas."
- Every new environment variable goes in `.env.example` (name only),
  `.env.local`, and Vercel.
- Never use historical odds. Historical data is player and team stats only.

## Pre-ship security audit
- [ ] Every secret is in a `.env` file, not the code.
- [ ] `.env` files are in `.gitignore`.
- [ ] A search for keys, passwords, and connection strings comes up clean.
- [ ] Passwords are bcrypt-hashed before they're saved.
- [ ] The JWT signing secret comes from an environment variable.
- [ ] Every POST and PUT route validates input on the server.
- [ ] A login check guards every route that needs a logged-in user.
- [ ] Every query checks ownership, so users only reach their own data.
- [ ] Third-party API keys are used only on the server.
- [ ] File uploads allow only certain types and have a maximum size.
- [ ] CORS allows only the frontend's exact origin.
- [ ] Error messages show only what the user needs: no stack traces or
      internal details.

## Grading rubric (same as Week 6)
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

## Checklists
**Works locally but not live? Check in this order:**
1. A missing or mistyped Vercel environment variable, or Atlas not allowing
   `0.0.0.0/0`.
2. CORS only allowing localhost (`ALLOWED_ORIGINS` must exactly match the URL).
3. `APP_URL` still pointing at localhost.

**Final ship check:** the build passes, no keys on GitHub, every variable is in
Vercel, an incognito sign-up works, create/rename/delete works, and someone new
tries it.

## Lessons learned (Week 6)
- Next 16: middleware is `proxy.ts`, and the `error.tsx` prop is `retry`.
- `APP_URL` and `ALLOWED_ORIGINS` must have no trailing slash.
- The Bet Slips page fetches its own API through `APP_URL`, so Vercel Preview
  needs its own `APP_URL` (the branch's preview link).
- Turbopack sometimes misses edits made from the shell. Restart the dev server
  if you see "is not a function."
- Grid items with wide tables need `min-w-0` / `grid-cols-1` or they widen the
  page on phones.
- ESPN times look like `...T00:20Z` and The Odds API uses `...:00Z`, so
  normalize them before matching games.
- The raw ESPN injuries feed is about 17 MB, so cache it hard.
- Caesars has had no odds in The Odds API, and the app says so.
- Only one dev server at a time, or use another port (`npx next dev -p 3100`).
- Keep adding to the README table "When an AI tool suggested something unsafe."

## Make-it-shippable to-do list (from Week 6 "Known limits")
**Security gaps**
- Login rate limiting (limit attempts per account and per IP).
- Content-Security-Policy header.
- Separate test and live databases (done locally; set Vercel Preview too).

**Features parked in Week 6**
- The Insights tab (AI).
- Other leagues (NBA, NHL, and the rest).
- Password reset and email verification.

**Data and licensing**
- ESPN's API is unofficial and not for commercial use.
- Parlay API needs a signed agreement before its data can be shown publicly.
- The Odds API free plan (upgrade planned).

**Product basics**
- "For reference only" disclaimer, a 21+ notice, and a responsible-gambling link.
- Privacy policy and terms of use.
- A way for users to delete their account.
