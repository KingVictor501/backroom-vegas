/*
  FILE: tests/protected.test.ts
  WHAT IT'S FOR: Automatic tests proving that protected things refuse visitors
  who aren't logged in:
  - API routes answer "401 Please log in." with no bv_session cookie, a tampered
    cookie, or a valid cookie for an account that no longer exists
  - proxy.ts (the guard that runs before pages) sends a visitor with no invite
    cookie to /invite first (even for /login and /signup), sends a visitor with
    an invite but no login to /login, remembers where they were going, and
    bounces a logged-in visitor away from /login, /signup, and /invite
  - proxy.ts blocks other websites from using the API (CORS)
  WHO USES IT: Vitest, when you run `npm test`.
  WHY THIS NAME: It tests the protected (login-only) parts. It sits in tests/ because it needs the
  test database. It ends in .ts because it shows nothing on screen.
*/

import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it } from "vitest";
import { GET as activeGet, PUT as activePut } from "@/app/api/betslips/active/route";
import { DELETE as slipDelete, GET as slipGet, PATCH as slipPatch } from "@/app/api/betslips/[id]/route";
import { GET as slipsGet, POST as slipsPost } from "@/app/api/betslips/route";
import { GET as gamesGet } from "@/app/api/games/route";
import { GET as newsGet } from "@/app/api/news/route";
import { proxy } from "@/proxy";
import { createInviteToken, createSessionToken, INVITE_COOKIE_NAME, SESSION_COOKIE_NAME } from "@/lib/auth/token";
import { UserModel } from "@/lib/db/models/User";
import { cookieJar } from "./support/cookies";
import { createTestUser, logInAs, resetDatabase } from "./support/db";
import { jsonRequest, slipContext, tamperToken } from "./support/factories";

/* A valid-looking slip ID, for routes that need one in the address. */
const SOME_ID = "64b7f0c2a1b2c3d4e5f60718";

/*
  protectedCalls: every protected API route, as a name plus a function that calls it.
  Each one is called with the same pretend browser, so the cookie decides the answer.
*/
const protectedCalls: { name: string; call: () => Promise<Response> }[] = [
  { name: "GET /api/betslips", call: () => slipsGet() },
  { name: "POST /api/betslips", call: () => slipsPost(jsonRequest("POST", "/api/betslips", { name: "x" })) },
  { name: "GET /api/betslips/<id>", call: () => slipGet(jsonRequest("GET", "/api/betslips/x"), slipContext(SOME_ID)) },
  { name: "PATCH /api/betslips/<id>", call: () => slipPatch(jsonRequest("PATCH", "/api/betslips/x", { name: "y" }), slipContext(SOME_ID)) },
  { name: "DELETE /api/betslips/<id>", call: () => slipDelete(jsonRequest("DELETE", "/api/betslips/x"), slipContext(SOME_ID)) },
  { name: "GET /api/betslips/active", call: () => activeGet() },
  { name: "PUT /api/betslips/active", call: () => activePut(jsonRequest("PUT", "/api/betslips/active", { slipId: null })) },
  { name: "GET /api/games", call: () => gamesGet(jsonRequest("GET", "/api/games?league=nfl")) },
  { name: "GET /api/news", call: () => newsGet(jsonRequest("GET", "/api/news?league=nfl")) },
];

beforeEach(async () => {
  await resetDatabase();
});

describe("API routes with no login", () => {
  for (const { name, call } of protectedCalls) {
    it(`${name} answers 401 with no bv_session cookie`, async () => {
      const response = await call();
      expect(response.status).toBe(401);
      const body = await response.json();
      expect(body.error.code).toBe("unauthorized");
    });
  }

  it("refuses a tampered cookie", async () => {
    const user = await createTestUser("member@example.com");
    const token = await createSessionToken(user.id);
    // Change one character in the middle of the signature.
    cookieJar.set(SESSION_COOKIE_NAME, tamperToken(token));

    for (const { call } of protectedCalls) {
      expect((await call()).status).toBe(401);
    }
  });

  it("refuses a cookie that's just junk text", async () => {
    cookieJar.set(SESSION_COOKIE_NAME, "not-a-real-token");
    expect((await slipsGet()).status).toBe(401);
  });

  it("refuses a perfectly valid cookie once the account has been deleted", async () => {
    const user = await createTestUser("gone@example.com");
    await logInAs(user);
    expect((await slipsGet()).status).toBe(200);

    await UserModel.deleteOne({ _id: user.id });

    expect((await slipsGet()).status).toBe(401);
  });

  it("lets a logged-in user through", async () => {
    const user = await createTestUser("member@example.com");
    await logInAs(user);
    const response = await slipsGet();
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual([]);
  });

  it("never includes a password hash in what a route sends back", async () => {
    const user = await createTestUser("member@example.com");
    await logInAs(user);
    const text = await (await slipsGet()).text();
    expect(text).not.toMatch(/passwordHash|\$2[aby]\$/);
  });
});

/*
  pageRequest: builds a request for a page address. Optionally it carries a login
  cookie (session) and/or an invite cookie (invite), like a real browser would.
*/
function pageRequest(path: string, cookies: { session?: string; invite?: string } = {}): NextRequest {
  const parts: string[] = [];
  if (cookies.session) parts.push(`${SESSION_COOKIE_NAME}=${cookies.session}`);
  if (cookies.invite) parts.push(`${INVITE_COOKIE_NAME}=${cookies.invite}`);
  return new NextRequest(`http://localhost:3000${path}`, { headers: parts.length ? { cookie: parts.join("; ") } : {} });
}

/* The pages that need a login. */
const PROTECTED_PAGES = ["/", "/settings", "/profile", "/betslips", "/betslips/new", "/betslips/abc", "/league/nfl", "/matchup/1", "/team/1", "/player/1"];

describe("proxy.ts, a visitor with NO invite cookie (the invite page comes first)", () => {
  it("sends every page, including /login and /signup, to /invite", async () => {
    for (const path of [...PROTECTED_PAGES, "/login", "/signup"]) {
      const response = await proxy(pageRequest(path));
      expect(response.status, path).toBe(307);
      expect(new URL(response.headers.get("location") ?? "").pathname, path).toBe("/invite");
    }
  });

  it("remembers the protected page they wanted, but not /login, /signup, or the Feed", async () => {
    const betslips = await proxy(pageRequest("/betslips"));
    expect(betslips.headers.get("location")).toBe("http://localhost:3000/invite?next=%2Fbetslips");
    for (const path of ["/", "/login", "/signup"]) {
      expect((await proxy(pageRequest(path))).headers.get("location"), path).toBe("http://localhost:3000/invite");
    }
  });

  it("lets them see the invite page itself", async () => {
    const response = await proxy(pageRequest("/invite"));
    expect(response.headers.get("location")).toBeNull();
    expect(response.status).toBe(200);
  });

  it("does not accept a tampered invite cookie", async () => {
    const invite = tamperToken(await createInviteToken(SOME_ID));
    const response = await proxy(pageRequest("/login", { invite }));
    expect(new URL(response.headers.get("location") ?? "").pathname).toBe("/invite");
  });

  it("does not accept a LOGIN token pretending to be an invite cookie", async () => {
    const response = await proxy(pageRequest("/signup", { invite: await createSessionToken(SOME_ID) }));
    expect(new URL(response.headers.get("location") ?? "").pathname).toBe("/invite");
  });

  it("does not accept an INVITE token pretending to be a login cookie", async () => {
    const response = await proxy(pageRequest("/betslips", { session: await createInviteToken(SOME_ID) }));
    expect(new URL(response.headers.get("location") ?? "").pathname).toBe("/invite");
  });
});

describe("proxy.ts, a visitor WITH a valid invite cookie, not logged in", () => {
  it("sends protected pages to /login and remembers where they were going", async () => {
    const invite = await createInviteToken(SOME_ID);
    const betslips = await proxy(pageRequest("/betslips", { invite }));
    expect(betslips.status).toBe(307);
    expect(betslips.headers.get("location")).toBe("http://localhost:3000/login?next=%2Fbetslips");
    // The Feed doesn't need a "next".
    expect((await proxy(pageRequest("/", { invite }))).headers.get("location")).toBe("http://localhost:3000/login");
  });

  it("protects every main page", async () => {
    const invite = await createInviteToken(SOME_ID);
    for (const path of PROTECTED_PAGES) {
      const response = await proxy(pageRequest(path, { invite }));
      expect(response.status, path).toBe(307);
      expect(new URL(response.headers.get("location") ?? "").pathname, path).toBe("/login");
    }
  });

  it("lets them see /login, /signup, and /invite", async () => {
    const invite = await createInviteToken(SOME_ID);
    for (const path of ["/login", "/signup", "/invite"]) {
      const response = await proxy(pageRequest(path, { invite }));
      expect(response.headers.get("location"), path).toBeNull();
      expect(response.status, path).toBe(200);
    }
  });

  it("treats a tampered login cookie as logged out", async () => {
    const invite = await createInviteToken(SOME_ID);
    const session = tamperToken(await createSessionToken(SOME_ID));
    const response = await proxy(pageRequest("/betslips", { invite, session }));
    expect(response.status).toBe(307);
    expect(new URL(response.headers.get("location") ?? "").pathname).toBe("/login");
  });
});

describe("proxy.ts, a logged-in visitor", () => {
  it("is let through to protected pages, with or without an invite cookie", async () => {
    const session = await createSessionToken(SOME_ID);
    for (const path of ["/betslips", "/settings"]) {
      const response = await proxy(pageRequest(path, { session }));
      expect(response.headers.get("location"), path).toBeNull();
      expect(response.status, path).toBe(200);
    }
  });

  it("is sent away from /login, /signup, and /invite to the Feed", async () => {
    const session = await createSessionToken(SOME_ID);
    for (const path of ["/login", "/signup", "/invite"]) {
      const response = await proxy(pageRequest(path, { session }));
      expect(response.status, path).toBe(307);
      expect(response.headers.get("location"), path).toBe("http://localhost:3000/");
    }
  });
});

describe("proxy.ts CORS (which websites may use the API)", () => {
  it("blocks another website's browser request with 403", async () => {
    const request = new NextRequest("http://localhost:3000/api/betslips", { headers: { origin: "https://evil.example" } });
    const response = await proxy(request);
    expect(response.status).toBe(403);
    expect(response.headers.get("access-control-allow-origin")).toBeNull();
  });

  it("allows our own site, and answers with that exact site (never *)", async () => {
    const request = new NextRequest("http://localhost:3000/api/betslips", { headers: { origin: "http://localhost:3000" } });
    const response = await proxy(request);
    expect(response.status).toBe(200);
    expect(response.headers.get("access-control-allow-origin")).toBe("http://localhost:3000");
  });

  it("refuses to treat * in ALLOWED_ORIGINS as 'everyone'", async () => {
    const saved = process.env.ALLOWED_ORIGINS;
    process.env.ALLOWED_ORIGINS = "*";
    try {
      const request = new NextRequest("http://localhost:3000/api/betslips", { headers: { origin: "https://evil.example" } });
      expect((await proxy(request)).status).toBe(403);
    } finally {
      process.env.ALLOWED_ORIGINS = saved;
    }
  });
});
