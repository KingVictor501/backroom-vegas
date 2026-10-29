# The Vegas Backroom: data model (Week 6, archived)

> **ARCHIVED (Week 6).** This is the old Week 6 data model and data-sources picture. It is kept for history only and is **out of date** (it has no invite codes, login lockout, wagers, payouts, or copied slips). For the current versions, see [`docs/data-model.md`](../../data-model.md) and [`docs/system-diagram.md`](../../system-diagram.md).


How the app's data is organized: what's **stored in MongoDB** (users and bet
slips), how those records connect, and where the **sports data** comes from.

> GitHub draws these diagrams automatically. Picture versions are next to this
> file: `week6-capstone-database-diagram.png` / `.svg` (database) and
> `week6-capstone-data-sources-diagram.png` / `.svg` (where the data comes from).

---

## 1. What's stored in the database (MongoDB Atlas)

The database (`backroom-vegas`) has two collections: **users** and **betslips**.
Each bet slip holds its **picks** inside it (they aren't a separate collection),
and each pick holds a small **participant** (who the bet is about).

How to read the lines: a user **owns** any number of bet slips (0 or more), and
has **at most one active slip** (the one in the slip bar). A slip contains 0 to
25 picks, and each pick is about exactly one participant (the game, a team, or a player).

```mermaid
erDiagram
    USER ||--o{ BET_SLIP : "owns"
    USER |o--o| BET_SLIP : "active slip"
    BET_SLIP ||--o{ BET_PICK : "contains, inside the slip"
    BET_PICK ||--|| PARTICIPANT : "is about, inside the pick"

    USER {
        ObjectId _id PK "made by MongoDB"
        string email UK "lowercase, unique, common ending (.com .org ...)"
        string passwordHash "bcrypt (cost 12), hidden from every read"
        string preferredSportsbook "hardrock / betmgm / caesars"
        ObjectId activeBetSlipId FK "the slip in the slip bar, or null"
        date createdAt "automatic"
        date updatedAt "automatic"
    }

    BET_SLIP {
        ObjectId _id PK "made by MongoDB"
        ObjectId userId FK "the owner; every query filters by it"
        string name "1 to 50 characters, unique per user"
        string type "straight / parlay / sgp (worked out by the server)"
        string sgpGameId "the one game an SGP is locked to, or null"
        number combinedOdds "American odds (server math), or null if empty"
        boolean oddsAreEstimated "true for SGPs"
        date createdAt "automatic"
        date updatedAt "automatic"
    }

    BET_PICK {
        string id "game + market + who + side + line"
        string gameId "ESPN game ID"
        string league "nfl"
        string gameLabel "like KC @ SEA"
        string gameStartsAt "kickoff time (marks Started picks)"
        string marketKey "Odds API market, like spreads"
        string marketCategory "game-lines / player-props / ..."
        string marketLabel "like Spread"
        string period "full-game / first-half / q1 ..."
        string side "home / away / over / under / yes / no"
        number line "like -3 or 274.5, or null"
        number odds "American odds, like -110"
        string sportsbook "the book the price came from"
        string label "like Chiefs -3"
        string addedAt "when it was added"
    }

    PARTICIPANT {
        string kind "game / team / player"
        string id "ESPN team or player ID, or null"
        string name "like Patrick Mahomes"
    }
```

**Key rules the database enforces**

| Rule | How |
|---|---|
| One account per email | `email` is **unique** (and saved in lowercase) |
| Passwords are never stored | Only `passwordHash` (bcrypt). It's left out of every read unless the login check asks for it |
| No two slips with the same name for one user | A **unique index** on `userId + name` |
| A user's slips load fast, newest first | An **index** on `userId + updatedAt` |
| A slip can't grow huge | At most **25 picks** |
| Only real values | Sportsbook, league, market group, part of the game, and side must each be one of the allowed values. Odds must be real American odds |
| You only see your own slips | Every bet slip query includes `userId`, which always comes from the login cookie |

**Why picks are stored inside the slip:** a pick saves a copy of everything
needed to show it (team names, kickoff time, price, sportsbook). So a slip still
makes sense weeks later, after the game is over and the live odds are gone.

---

## 2. Where the data comes from

Only **users** and **bet slips** are saved in our database. Everything about
games, teams, players, odds, and news is fetched from outside services **by
the server**, checked, and cached (saved for a while).

```mermaid
flowchart LR
    Browser["Your browser<br/>(pages, odds buttons, slip bar)"]

    subgraph Server["The Vegas Backroom server (Next.js on Vercel)"]
        Pages["Pages built on the server"]
        API["API routes (app/api)"]
        Actions["Server Actions<br/>(sign up, log in, settings)"]
        Cache["Cache<br/>(saved answers)"]
    end

    subgraph Outside["Outside services"]
        ESPN["ESPN API (no key)<br/>games, scores, teams, players,<br/>stats, injuries, news, logos"]
        Odds["The Odds API (key stays on the server)<br/>live odds and props for<br/>Hard Rock Bet, BetMGM, Caesars"]
    end

    Mongo[("MongoDB Atlas<br/>users + bet slips")]

    Browser -->|"pages, /api requests,<br/>login cookie"| Pages
    Browser --> API
    Browser --> Actions
    Pages --> Cache
    API --> Cache
    Cache -->|"5 min to 24 h"| ESPN
    Cache -->|"60 min"| Odds
    Pages --> Mongo
    API --> Mongo
    Actions --> Mongo
```

**How the outside data connects to ours**

| Our data | Comes from | Linked by |
|---|---|---|
| A game (matchup) | ESPN | ESPN's game ID, used in addresses like `/matchup/401873022` and saved on each pick (`gameId`) |
| That game's odds | The Odds API | Matched to the ESPN game by **team names + kickoff time** (the two services use different IDs) |
| A team or player | ESPN | ESPN's team and player IDs (`/team/12`, `/player/3139477`), saved in a pick's `participant.id` |
| Player names in props | The Odds API (names only) | Matched to ESPN players by name, using both teams' rosters |
| Your sportsbook | Your account (`preferredSportsbook`) | Picks which of the three books' prices you see |

**Not stored on purpose:** games, odds, stats, and news are never saved in our
database, and no old (historical) betting lines are kept anywhere. Past games
show **stats only**.
