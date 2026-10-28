/*
  FILE: tests/protected.test.ts
  WHAT IT'S FOR: Automatic tests proving that protected things refuse visitors
  who aren't logged in:
  - API routes answer "401 Please log in." with no bv_session cookie, a tampered
    cookie, or a valid cookie for an account that no longer exists
  - proxy.ts (the guard that runs before pages) sends a logged-out visitor to
    /login, remembers where they were going, and bounces a logged-in visitor away
    from /login and /signup
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
import { createSessionToken, SESSION_COOKIE_NAME } from "@/lib/auth/token";
import { UserModel } from "@/lib/db/models/User";
import { cookieJar } from "./support/cookies";
import { createTestUser, logInAs, resetDatabase } from "./support/db";
import { jsonRequest, slipContext } from "./support/factories";

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
    // Change one character in the signature.
    const last = token.slice(-1);
    cookieJar.set(SESSION_COOKIE_NAME, token.slice(0, -1) + (last === "A" ? "B" : "A"));

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

/* page: builds a request for a page address, with an optional bv_session cookie. */
function pageRequest(path: string, token?: string): NextRequest {
  return new NextRequest(`http://localhost:3000${path}`, {
    headers: token ? { cookie: `${SESSION_COOKIE_NAME}=${token}` } : {},
  });
}

describe("proxy.ts (the guard that runs before pages)", () => {
  it("sends a logged-out visitor from a protected page to /login and remembers the page", async () => {
    const response = await proxy(pageRequest("/betslips"));
    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe("http://localhost:3000/login?next=%2Fbetslips");
  });

  it("sends a logged-out visitor from the Feed to /login (no 'next' needed for the home page)", async () => {
    const response = await proxy(pageRequest("/"));
    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe("http://localhost:3000/login");
  });

  it("protects every main page", async () => {
    for (const path of ["/settings", "/betslips/new", "/betslips/abc", "/league/nfl", "/matchup/1", "/team/1", "/player/1"]) {
      const response = await proxy(pageRequest(path));
      expect(response.status, path).toBe(307);
      expect(response.headers.get("location"), path).toContain("/login");
    }
  });

  it("treats a tampered cookie as logged out", async () => {
    const token = await createSessionToken(SOME_ID);
    const last = token.slice(-1);
    const response = await proxy(pageRequest("/betslips", token.slice(0, -1) + (last === "A" ? "B" : "A")));
    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toContain("/login");
  });

  it("lets a logged-out visitor see /login and /signup", async () => {
    for (const path of ["/login", "/signup"]) {
      const response = await proxy(pageRequest(path));
      // NextResponse.next() means "carry on to the page": no redirect, no location.
      expect(response.headers.get("location"), path).toBeNull();
      expect(response.status, path).toBe(200);
    }
  });

  it("lets a logged-in visitor through to protected pages", async () => {
    const response = await proxy(pageRequest("/betslips", await createSessionToken(SOME_ID)));
    expect(response.headers.get("location")).toBeNull();
    expect(response.status).toBe(200);
  });

  it("sends a logged-in visitor away from /login and /signup to the Feed", async () => {
    const token = await createSessionToken(SOME_ID);
    for (const path of ["/login", "/signup"]) {
      const response = await proxy(pageRequest(path, token));
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
