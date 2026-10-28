/*
  FILE: lib/auth/token.test.ts
  WHAT IT'S FOR: Automatic tests for the login token (the JWT in the bv_session
  cookie). They prove that a real token is accepted, and that a token which was
  changed, signed with the wrong secret, expired, unsigned, or carrying a junk
  user ID is rejected (treated as "not logged in").
  The same checks cover the invite cookie token, plus proof that an invite token
  can never pass for a login token (or the other way round).
  WHO USES IT: Vitest, when you run `npm test`.
  WHY THIS NAME: It tests token.ts, so it's token.test.ts, right next to it. It
  ends in .ts because it shows nothing on screen.
*/

import { randomBytes } from "node:crypto";
// SignJWT: the same signing tool the app uses. Tests use it to forge bad tokens on purpose.
import { SignJWT } from "jose";
import { describe, expect, it } from "vitest";
import {
  createInviteToken,
  createSessionToken,
  INVITE_DURATION_SECONDS,
  readInviteToken,
  readSessionToken,
  SESSION_DURATION_SECONDS,
} from "./token";
// tamperToken: edits one character of a token's signature, like an attacker would.
import { tamperToken } from "../../tests/support/factories";

/* A valid-looking MongoDB user ID (24 characters of 0-9 and a-f). */
const USER_ID = "64b7f0c2a1b2c3d4e5f60718";

/* secretBytes: the app's real test secret (set in tests/support/setup.ts), as the bytes jose needs. */
function secretBytes(): Uint8Array {
  return new TextEncoder().encode(process.env.AUTH_SECRET);
}

describe("login token", () => {
  it("a token we just made is accepted and gives back the user ID", async () => {
    const token = await createSessionToken(USER_ID);
    expect(await readSessionToken(token)).toEqual({ userId: USER_ID });
  });

  it("a missing token means not logged in", async () => {
    expect(await readSessionToken(undefined)).toBeNull();
    expect(await readSessionToken("")).toBeNull();
  });

  it("rejects a token with one character changed (tampered)", async () => {
    const token = await createSessionToken(USER_ID);
    // Change one character in the middle of the signature part.
    expect(await readSessionToken(tamperToken(token))).toBeNull();
  });

  it("rejects a token whose middle part was swapped for another user's", async () => {
    const [header, , signature] = (await createSessionToken(USER_ID)).split(".");
    const otherPayload = Buffer.from(JSON.stringify({ sub: "aaaaaaaaaaaaaaaaaaaaaaaa" })).toString("base64url");
    expect(await readSessionToken(`${header}.${otherPayload}.${signature}`)).toBeNull();
  });

  it("rejects a token signed with a different secret", async () => {
    const forged = await new SignJWT({})
      .setProtectedHeader({ alg: "HS256" })
      .setSubject(USER_ID)
      .setExpirationTime("1h")
      .sign(new TextEncoder().encode(randomBytes(32).toString("hex")));
    expect(await readSessionToken(forged)).toBeNull();
  });

  it("rejects an expired token", async () => {
    const expired = await new SignJWT({})
      .setProtectedHeader({ alg: "HS256" })
      .setSubject(USER_ID)
      // "exp" in the past: one hour ago.
      .setExpirationTime(Math.floor(Date.now() / 1000) - 3600)
      .sign(secretBytes());
    expect(await readSessionToken(expired)).toBeNull();
  });

  it("rejects an unsigned token (the 'alg: none' trick)", async () => {
    const header = Buffer.from(JSON.stringify({ alg: "none", typ: "JWT" })).toString("base64url");
    const payload = Buffer.from(JSON.stringify({ sub: USER_ID })).toString("base64url");
    expect(await readSessionToken(`${header}.${payload}.`)).toBeNull();
  });

  it("rejects a correctly signed token whose user ID isn't a MongoDB ID", async () => {
    for (const sub of ["not-an-id", "../etc/passwd", '{"$gt":""}', "A".repeat(24)]) {
      const token = await new SignJWT({})
        .setProtectedHeader({ alg: "HS256" })
        .setSubject(sub)
        .setExpirationTime("1h")
        .sign(secretBytes());
      expect(await readSessionToken(token)).toBeNull();
    }
  });

  it("tokens expire: logins last 7 days", () => {
    expect(SESSION_DURATION_SECONDS).toBe(7 * 24 * 60 * 60);
  });

  it("rejects random junk", async () => {
    expect(await readSessionToken("hello")).toBeNull();
    expect(await readSessionToken("a.b.c")).toBeNull();
  });
});

describe("invite cookie token", () => {
  it("a token we just made is accepted and gives back the invite code's record ID", async () => {
    expect(await readInviteToken(await createInviteToken(USER_ID))).toEqual({ inviteCodeId: USER_ID });
  });

  it("lasts 30 days", async () => {
    expect(INVITE_DURATION_SECONDS).toBe(30 * 24 * 60 * 60);
    const claims = JSON.parse(Buffer.from((await createInviteToken(USER_ID)).split(".")[1], "base64url").toString());
    expect(claims.exp - claims.iat).toBe(INVITE_DURATION_SECONDS);
  });

  it("rejects missing, junk, tampered, wrong-secret, expired, and unsigned tokens", async () => {
    expect(await readInviteToken(undefined)).toBeNull();
    expect(await readInviteToken("")).toBeNull();
    expect(await readInviteToken("a.b.c")).toBeNull();
    expect(await readInviteToken(tamperToken(await createInviteToken(USER_ID)))).toBeNull();

    const sign = (secret: Uint8Array, expiresAt: string | number) =>
      new SignJWT({}).setProtectedHeader({ alg: "HS256" }).setSubject(USER_ID).setAudience("invite").setExpirationTime(expiresAt).sign(secret);
    expect(await readInviteToken(await sign(new TextEncoder().encode(randomBytes(32).toString("hex")), "1h"))).toBeNull();
    expect(await readInviteToken(await sign(secretBytes(), Math.floor(Date.now() / 1000) - 3600))).toBeNull();
    // Sanity check on the helper: the same token with the right secret and a future date IS accepted.
    expect(await readInviteToken(await sign(secretBytes(), "1h"))).toEqual({ inviteCodeId: USER_ID });

    const header = Buffer.from(JSON.stringify({ alg: "none", typ: "JWT" })).toString("base64url");
    const payload = Buffer.from(JSON.stringify({ sub: USER_ID, aud: "invite" })).toString("base64url");
    expect(await readInviteToken(`${header}.${payload}.`)).toBeNull();
  });

  it("rejects a token whose ID isn't a MongoDB ID", async () => {
    const token = await new SignJWT({})
      .setProtectedHeader({ alg: "HS256" })
      .setSubject('{"$gt":""}')
      .setAudience("invite")
      .setExpirationTime("1h")
      .sign(secretBytes());
    expect(await readInviteToken(token)).toBeNull();
  });

  it("a LOGIN token is not accepted as an invite token", async () => {
    expect(await readInviteToken(await createSessionToken(USER_ID))).toBeNull();
  });

  it("an INVITE token is not accepted as a login token", async () => {
    expect(await readSessionToken(await createInviteToken(USER_ID))).toBeNull();
  });

  it("a token labeled for some other purpose is not accepted as an invite token", async () => {
    const other = await new SignJWT({})
      .setProtectedHeader({ alg: "HS256" })
      .setSubject(USER_ID)
      .setAudience("something-else")
      .setExpirationTime("1h")
      .sign(secretBytes());
    expect(await readInviteToken(other)).toBeNull();
    expect(await readSessionToken(other)).toBeNull();
  });
});
