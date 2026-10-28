/*
  FILE: lib/auth/token.ts
  WHAT IT'S FOR: Creates and checks the login "token": a small piece of text,
  stored in a cookie, that proves which user is logged in. It's a JWT (JSON Web
  Token), which holds the user's ID plus an expiry date and is SIGNED with
  AUTH_SECRET. If anyone changes even one letter of it, the signature no longer
  matches and we reject it. Nobody can fake a login without knowing AUTH_SECRET.
  WHO USES IT: lib/auth/session.ts (to set and read the cookie in pages and
  Server Actions) and proxy.ts (to send logged-out visitors to /login).
  WHY THIS NAME: It handles the token itself, separately from the cookie code, so
  proxy.ts can use it too. It ends in .ts because it shows nothing on screen.
*/

// Makes the build fail if browser code ever imports this file. The secret stays on the server.
import "server-only";
// jose: a well-tested library for signing and checking JWTs. Using a library is much safer than writing crypto code ourselves.
import { jwtVerify, SignJWT } from "jose";

/** The cookie's name in the browser. "bv" = Backroom Vegas. */
export const SESSION_COOKIE_NAME = "bv_session";

/** How long a login lasts: 7 days, in seconds (7 × 24 hours × 60 minutes × 60 seconds). */
export const SESSION_DURATION_SECONDS = 7 * 24 * 60 * 60;

/*
  getSecretKey: reads AUTH_SECRET (from .env.local, or Vercel's dashboard) and
  turns it into the format jose needs. Stops with a clear message if it's
  missing or too short to be safe. The message never shows the secret itself.
*/
function getSecretKey(): Uint8Array {
  const secret = process.env.AUTH_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error(
      "AUTH_SECRET is missing or shorter than 32 characters. Set it in .env.local (and in Vercel's Environment Variables).",
    );
  }
  return new TextEncoder().encode(secret);
}

/*
  createSessionToken: makes a signed token for a user that expires in 7 days.
  It only holds the user's ID (in the "sub" or "subject" field), never their
  email or password, because the token sits in the browser.
*/
export async function createSessionToken(userId: string): Promise<string> {
  return new SignJWT({})
    // HS256: the signing method (a standard one that uses our secret).
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(userId)
    .setIssuedAt()
    .setExpirationTime(`${SESSION_DURATION_SECONDS}s`)
    .sign(getSecretKey());
}

/*
  readSessionToken: checks a token and gives back the user ID inside it, or null
  if it's missing, fake, changed, or expired (missing on purpose: null means
  "not logged in"). It never throws, so a bad cookie can't crash a page.
*/
export async function readSessionToken(
  token: string | undefined,
): Promise<{ userId: string } | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, getSecretKey(), {
      // Only accept the exact signing method we use, to block a known trick
      // where an attacker labels a token as "unsigned".
      algorithms: ["HS256"],
    });
    // A login token has no "aud" (audience) label. An invite-cookie token has one
    // (see below). Both are signed with the same secret, so this keeps one from
    // ever being accepted as the other.
    if (payload.aud !== undefined) return null;
    // A MongoDB ID is exactly 24 characters of 0-9 and a-f. Anything else is rejected.
    if (typeof payload.sub !== "string" || !/^[a-f0-9]{24}$/.test(payload.sub)) {
      return null;
    }
    return { userId: payload.sub };
  } catch {
    return null;
  }
}

/** The invite cookie's name in the browser. "bv" = Backroom Vegas. */
export const INVITE_COOKIE_NAME = "bv_invite";

/** How long a valid invite code is remembered: 30 days, in seconds. */
export const INVITE_DURATION_SECONDS = 30 * 24 * 60 * 60;

/*
  INVITE_AUDIENCE: the label stamped on every invite token ("aud" is short for
  "audience": who the token is meant for). A token labeled "invite" is only
  good as an invite cookie. readSessionToken above refuses any token that has a label.
*/
const INVITE_AUDIENCE = "invite";

/*
  createInviteToken: makes a signed token saying "this browser entered a valid
  invite code", good for 30 days. It holds only the ID of the invite code record
  (in "sub"), never the code itself. Sign up checks that record AGAIN on the
  server, so a code that was turned off or used up since then still can't be used.
*/
export async function createInviteToken(inviteCodeId: string): Promise<string> {
  return new SignJWT({})
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(inviteCodeId)
    .setAudience(INVITE_AUDIENCE)
    .setIssuedAt()
    .setExpirationTime(`${INVITE_DURATION_SECONDS}s`)
    .sign(getSecretKey());
}

/*
  readInviteToken: checks an invite token and gives back the invite code's record
  ID, or null if it's missing, fake, changed, expired, or really a login token
  (null is missing on purpose: "no valid invite"). It never throws.
  `audience: INVITE_AUDIENCE` makes jose reject any token without the invite label.
*/
export async function readInviteToken(token: string | undefined): Promise<{ inviteCodeId: string } | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, getSecretKey(), {
      algorithms: ["HS256"],
      audience: INVITE_AUDIENCE,
    });
    if (typeof payload.sub !== "string" || !/^[a-f0-9]{24}$/.test(payload.sub)) {
      return null;
    }
    return { inviteCodeId: payload.sub };
  } catch {
    return null;
  }
}
