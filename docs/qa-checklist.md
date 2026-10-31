# Manual QA checklist

A walk through the whole app by hand, on a **computer** and on a **phone**. Automatic tests check the code; this checks that the app feels right to a real person. Tick each box as you go. If anything is wrong, write down the page and what you saw.

**Where to test**
- First on the **preview**: `https://backroom-vegas-git-week-7-doc-s-digital-consulting.vercel.app` (uses the `backroom-vegas-dev` database and practice odds).
- After going live, repeat the short **Live smoke test** at the bottom on `https://backroom-vegas.vercel.app`.

**You need:** a **throwaway email** you make up (like `qa-test-1@example.com`), a password with 8+ characters, a letter, and a number, and an invite code made with `npm run invite:create -- --db backroom-vegas-dev`.

**Sizes to check:** use a real phone, plus Safari's Responsive Design Mode (Develop → Enter Responsive Design Mode, or Option+Cmd+R) for phone, tablet, and desktop. Phone = 1 column, tablet = 2 columns, desktop = left sidebar + slip panel on the right. No sideways scrolling at any size.

---

## 1. Invite code
- [ ] In a Private window, open the site. You land on the **invite page** first.
- [ ] Type a wrong code (`BRV-0000-0000`). A **loud red** message appears: "That invite code isn't valid."
- [ ] Try going straight to `/signup`. You are sent back to the invite page.
- [ ] `/login` is reachable without a code.
- [ ] Type a valid code. You continue to sign up.

## 2. Sign up
- [ ] Submit the empty form. Each box with a problem turns **red** with a message.
- [ ] Try a weak password (`password`). It is refused with a clear reason.
- [ ] Try mismatched passwords. Refused.
- [ ] Sign up with the throwaway email. You land on the Feed, logged in.

## 3. Log out and back in
- [ ] Settings → Log out. You land on the login page.
- [ ] Press the browser Back button. You are **not** let back into the app.
- [ ] Log in with the right email and password. You land on the Feed.

## 4. Login lockout (use a different throwaway email so you don't lock yourself out)
- [ ] Sign up a second throwaway account, log out.
- [ ] Try the **wrong password 5 times**. On the 5th/6th try you see the red message: "Too many attempts. Try again in a few minutes."
- [ ] Try the **right** password now. It is still refused (locked for 15 minutes).
- [ ] After 15 minutes, the right password works. (You can skip waiting; the automatic tests cover this.)
- [ ] The message is the same for an email that has no account.

## 5. Feed (all four looks)
- [ ] Games appear with Spread / Total / Winner buttons. Team logos load.
- [ ] League tabs: NFL and NBA work; the others say "Coming soon".
- [ ] Filters (This Week, Today) change the list instantly. This Week ends Monday night (Eastern) for the NFL and Saturday night for the NBA (the NBA week runs Sunday to Saturday). The "Show live games" box sits above the cards and starts unchecked.
- [ ] News box: normal, then use the "For testing" links: **Slow** (loading look), **Bad URL** (red error with Retry), **Empty**, **Normal**.
- [ ] Practice odds banner shows on the preview only.

## 6. Matchup
- [ ] Open a game. Both teams, records, and time show. Tabs switch (Game Lines, Player Props, ...).
- [ ] Both teams' injury reports show on Game Lines.
- [ ] The **game stats** box (live or final) is closed at first and opens/closes.
- [ ] A fake address like `/matchup/99999999` shows a friendly "not found", not a crash.

## 7. Team and player pages
- [ ] A team page shows record, last 5 games, **Remaining schedule** (closed until tapped), key players, injuries, news.
- [ ] NBA team page works with `?league=nba`.
- [ ] A player page shows photo, stats, last games, news.
- [ ] A fake team or player ID shows "not found".

## 8. Add picks and the conflict popup
- [ ] Tap an odds button. A slip starts and the slip bar/panel appears.
- [ ] Tap the same (gold) button again. The pick is removed.
- [ ] Add both sides of one bet (for example the Over and the Under). A **popup** explains the conflict with **Cancel** and **Start new slip**. The popup works with the keyboard (Tab, Enter, Esc).
- [ ] **Cancel** keeps your slip unchanged. **Start new slip** starts a fresh one.

## 9. Same game parlay
- [ ] Add two picks from one game. The slip becomes an **SGP** and says its odds are **Estimated**.
- [ ] Try a pick from a different game on the SGP. It is refused.
- [ ] "Build your own SGP" on a matchup page works.

## 10. Wager and estimated payout
- [ ] The wager box defaults to **$10**.
- [ ] Change the wager. Profit and total return update **instantly**.
- [ ] Refresh the page. The wager you set is still there.
- [ ] Type `-5`, `0`, `abc`, or `100000`. Red error, nothing saved.
- [ ] Compare one straight bet and one parlay with an online payout calculator.

## 11. Bet slip CRUD
- [ ] **Create:** New slip appears in the list.
- [ ] **Edit:** Rename it; remove a pick. Saved after refresh.
- [ ] **Delete:** Confirm the popup; the slip is gone.
- [ ] Search and the type filter on the list update instantly.
- [ ] A fake slip address shows "not found".

## 12. Copy a slip
- [ ] "Copy slip" on the detail page and on a list item both work.
- [ ] The copy is named "Copy of ..." and becomes the active slip.
- [ ] If picks were skipped (game started/finished), you are told how many and why.
- [ ] Odds that changed are shown.

## 13. Live scores
- [ ] While a game is on (or when a finished game is on screen), the score, quarter, and clock show on the game card, matchup page, and slip.
- [ ] Picks show Winning / Losing / Push / Pending (or Won / Lost after the game).
- [ ] Turn off your Wi-Fi briefly: a small "Scores delayed" note appears and the last score stays.

## 14. Profile
- [ ] Reachable from the menu and Settings.
- [ ] **Change email:** wrong current password is refused (red). An email already used is refused. A valid change works.
- [ ] **Change password:** wrong current password refused; mismatched new passwords refused; a valid change works and you stay logged in here.
- [ ] **Delete account:** the popup needs you to type DELETE (and your password). After deleting, you land on the invite page, and the account can no longer log in.

## 15. Settings, footer, and legal
- [ ] Choose a sportsbook; the odds everywhere switch to it.
- [ ] The footer shows the "for reference only" notice, the 21+ notice, 1-800-GAMBLER, and links to **Privacy Policy** and **Terms of Use**; both pages open.

## 16. Logged-out protection
- [ ] In a Private window, open `/betslips`, `/profile`, `/settings`. Each sends you to the login page.
- [ ] After logging in you land where you were going.

## 17. Phone, tablet, desktop
- [ ] Phone: 1 column, no sideways scrolling, buttons easy to tap, menu reaches every page including Profile.
- [ ] Tablet: 2 columns.
- [ ] Desktop: left sidebar and the slip panel on the right.
- [ ] Wide tables scroll inside their own box instead of widening the page.

## 18. Console check (Safari: Option+Cmd+C)
- [ ] No red "Refused to..." lines on the Feed, a matchup, a team page, `/betslips`, `/profile`. (On the preview, Vercel's own toolbar may print one harmless message; check in a Private window.)

---

## Postman run (done)

Both Postman collections were run by hand on **2026-10-30** against the app on `http://localhost:3000`, using the `backroom-vegas-dev` database and a throwaway account. Every status matched what was expected.

**Collection 1: The Vegas Backroom API** (`docs/backroom-vegas.postman_collection.json`)

| Check | Expected | Result |
|---|---|---|
| Login (sets cookie) | 200 and a user object with no password or hash | 200, no password or hash in the body |
| Create slip | 201 | 201 |
| Get slip | 200 | 200 |
| Rename slip | 200 | 200 |
| Copy slip | 201 | 201 |
| Delete slip | 200 | 200 |
| Get slip again after delete | 404 (it's gone) | 404 |
| Games (NBA) | 200 | 200 |
| Logout, then List my slips | 401 | 401 |
| Log back in, then Get slip with a made-up ID (`aaaaaaaaaaaaaaaaaaaaaaaa`) | 404 | 404 |

**Collection 2: Login lockout** (`postman/login-lockout.postman_collection.json`, 13 requests)

| Folder | Check | Expected | Result |
|---|---|---|---|
| 1. Real account | Wrong password #1 to #5 | 401 each | 401 each |
| 1. Real account | Wrong password #6 | 429 with a `Retry-After` header | 429, `Retry-After: 896` (seconds; about 15 minutes minus a few seconds) |
| 1. Real account | RIGHT password during the lockout | 429 | 429 |
| 2. Email with no account | Wrong #1 to #5 | 401 each | 401 each |
| 2. Email with no account | Wrong #6 | 429 | 429 |

All the built-in checks under Test Results passed. The unknown email locks out exactly like the real one, which shows the lockout does not reveal which emails have accounts. The throwaway account unlocked by itself after 15 minutes.

---

## Live smoke test (after the merge, on `https://backroom-vegas.vercel.app`)
- [ ] The invite page shows first.
- [ ] The **grader invite code** works (and it was made in the **live** `backroom-vegas` database).
- [ ] Sign up, log out, log in.
- [ ] The Feed shows **real odds** (no "practice odds" banner).
- [ ] Add a pick, change the wager, copy the slip, delete the slip.
- [ ] Delete the test account from Profile.
