# System diagram

The Vegas Backroom is **one app** with three parts that talk to each other: what you see (the **frontend**), the code that does the work (the **backend**), and where information is saved (the **database**). The backend also gets sports data from two outside websites. It all lives in one Next.js project on Vercel, so one web address serves both the screens and the backend.

## The big picture

```mermaid
flowchart LR
  Browser["<b>FRONTEND</b><br/>Your browser<br/>(the screens you see)"]
  Guard["<b>BACKEND: the guard</b><br/>proxy.ts<br/>checks who you are"]
  subgraph App["<b>BACKEND: the app</b> (does the work)"]
    direction TB
    Pages["Pages<br/>build the screens"]
    API["API routes<br/>answer data requests"]
    Forms["Server Actions<br/>handle forms"]
  end
  DB[("<b>DATABASE</b><br/>MongoDB<br/>users, bet slips,<br/>invite codes")]
  ESPN["<b>OUTSIDE</b><br/>ESPN<br/>scores, stats, news"]
  Odds["<b>OUTSIDE</b><br/>The Odds API<br/>betting odds"]

  Browser -->|"1. Request + login token"| Guard
  Guard -->|"2. Allowed requests only"| App
  App -->|"3. Save or look up<br/>(only YOUR data)"| DB
  DB -.->|"4. The data"| App
  App -->|"Ask for sports data<br/>(secret key stays here)"| ESPN
  App -->|"Ask for odds<br/>(secret key stays here)"| Odds
  App -.->|"5. Answer: a page or data"| Browser
```

**How to read it:** solid arrows are asking for something. Dashed arrows are the answer coming back. Follow the numbers 1 to 5 to trace one trip from your browser to the database and back.

## What travels on each arrow

| Arrow | What travels | Plain-English example |
|---|---|---|
| Browser → Guard | A **request** plus your **login token** (a signed ticket kept in a cookie called `bv_session`) | "Show me my bet slips" and the ticket proving who I am |
| Guard → App | The same request, only if the ticket is real. If not, you are sent to the login page | A fake or missing ticket is turned away |
| App → Database | A **query**: a question for the database that always includes your user ID | "Find the slip with this ID **that belongs to this user**" |
| Database → App | The matching data | Your slip, never someone else's |
| App → ESPN / The Odds API | A request for sports data. The secret API key is added here, on the server, so your browser never sees it | "What are today's NFL odds?" |
| App → Browser | The **answer**: a finished page or data | The Bet Slips page with your slips on it |

## What each piece does

| Piece | Its job | Where it lives |
|---|---|---|
| **Browser (frontend)** | Shows the screens, and keeps your login ticket and invite ticket as cookies | `app/`, `components/` |
| **Guard** | Runs first on every request. Sends people without a login to the login page, only lets our own website use the API, and adds a safety rule for the page | `proxy.ts` |
| **Pages** | Build the screens on the server (Feed, Matchup, Team, Bet Slips, Profile) | `app/(main)/` |
| **API routes** | Answer data requests, like saving a bet slip | `app/api/` |
| **Forms (Server Actions)** | Handle log in, sign up, invite code, and profile changes | `app/actions/` |
| **Database** | Saves users, bet slips, invite codes, and wrong-password counts | MongoDB Atlas |
| **ESPN** | Free sports data: scores, stats, injuries, news, logos | outside website |
| **The Odds API** | Betting odds from the sportsbooks (limited free credits) | outside website |

**Three safety rules the picture shows**
- **The browser never talks to ESPN or The Odds API.** Only our server does, so the secret key stays secret and results are saved for a while to avoid using up the free limit.
- **Every request is checked.** The guard checks first, and the code next to the data checks again.
- **Every slip query includes your user ID,** so one user can never see another user's slips.

## One trip, step by step: saving a bet slip

You are logged in and you add a pick to your slip. This is what happens.

```mermaid
sequenceDiagram
  autonumber
  participant B as Browser
  participant G as Guard (proxy.ts)
  participant A as App (API route)
  participant D as Database

  B->>G: "Save these picks" + login token
  G->>A: Allowed, pass it on
  A->>A: Is the token real? Is the data valid?
  A->>D: "Update the slip with this ID that belongs to this user"
  D-->>A: The updated slip
  A-->>B: Saved! Here is your slip
```

In words:
1. **Browser:** you tap a pick. The browser sends "save these picks" and automatically includes your login token.
2. **Guard:** `proxy.ts` makes sure the request comes from our own website, then passes it on.
3. **App:** the API route (`app/api/betslips/[id]/route.ts`) checks the token is real (no token or a fake one gets a `401` error) and checks the picks are valid (bad data gets a `400` error, and picks that can't both win get a `409` error).
4. **Database:** the app asks MongoDB to update the slip **only if it belongs to you**. If it belongs to someone else, it is simply "not found" (`404`).
5. **Answer:** the database returns the saved slip, the app sends it back, and your screen updates.

## Other trips, in one line each

- **Sign up:** enter an invite code → the code is checked and an invite ticket is saved in your browser → sign up form → the code is checked again and one use is counted as your account is created → you get a login ticket.
- **Log in:** email and password → the app checks for too many wrong tries (5 wrong passwords means a 15-minute wait) → the password is compared safely → you get a login ticket.
- **Live scores:** while a game is on, your browser asks our app for scores about every 30 seconds, and our app asks ESPN (and remembers the answer for 15 seconds).

## Where it runs (deployment)

The code lives on GitHub and Vercel builds and publishes it. There is **one app** and **two environments**, each with its own database.

```mermaid
flowchart LR
  Dev["<b>You</b><br/>write code<br/>and push it"]
  GH["<b>GitHub</b><br/>KingVictor501/<br/>backroom-vegas"]
  subgraph Vercel["<b>VERCEL</b> (builds and hosts the one app)"]
    direction TB
    Prod["<b>Production</b><br/>backroom-vegas.vercel.app<br/>built from <b>main</b>"]
    Prev["<b>Preview</b><br/>a link for the <b>week-7</b> branch<br/>practice odds"]
  end
  LiveDB[("<b>MongoDB Atlas</b><br/>backroom-vegas<br/>real accounts")]
  DevDB[("<b>MongoDB Atlas</b><br/>backroom-vegas-dev<br/>test accounts")]

  Dev -->|"git push"| GH
  GH -->|"push to main: builds automatically"| Prod
  GH -->|"push to week-7: builds automatically"| Prev
  Prod -->|"MONGODB_DB = backroom-vegas"| LiveDB
  Prev -->|"MONGODB_DB = backroom-vegas-dev"| DevDB
```

- **One address serves everything.** The screens, API routes and forms are the same project, so there is no separate backend to point at. The app's own address is set in `APP_URL`, and `ALLOWED_ORIGINS` lists the only website allowed to use the API.
- **Each environment has its own settings** in Vercel (database name, keys, `APP_URL`, `ALLOWED_ORIGINS`). Production and Preview are set separately, and the code refuses to guess a database name outside Production.
- **Secrets never live in the code.** They are Vercel environment variables, and `.env.local` on the laptop is not in git.

**Proof that pushing to `main` deploys automatically:** commit `b688853` ("add NBA Sunday to Saturday week") was pushed to `main` on 2026-10-30 at 12:41 PM ET. GitHub's status for that commit then shows **Vercel: success, "Deployment has completed"** at 12:42 PM ET, with nothing deployed by hand. The same check is on the `week-7` branch for the same commit.

You can repeat it: `gh api repos/KingVictor501/backroom-vegas/commits/main/status`.
