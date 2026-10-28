/*
  FILE: app/api/auth/login/route.ts
  WHAT IT'S FOR: Logging in with JSON, so Postman (and anything else that speaks
  JSON) can log in and test the lockout. The login FORM uses a Server Action
  (app/actions/auth.ts); this route and that action both call the same
  attemptLogin() in lib/auth/loginAttempt.ts, so they follow identical rules,
  including the lockout: 5 wrong passwords for one email (or 20 from one
  address) = 15 minutes of "Too many attempts."
  - POST /api/auth/login   Send JSON like { "email": "you@example.com", "password": "..." }
    · 200 → logged in. The bv_session cookie is set (Postman keeps it for later requests)
      and the body is { "user": { id, email, preferredSportsbook, ... } }, with no password hash
    · 400 → email or password missing or malformed (does NOT count as a try)
    · 401 → wrong email or password: ONE vague message for both
    · 413 → body over 100 KB;  415 → not sent as JSON
    · 429 → locked out. Has a Retry-After header: seconds until you may try again
  This route is PUBLIC (you can't be logged in yet), so it is the one API route
  without the login check. CORS in proxy.ts still applies: other websites are refused.
  WHO USES IT: Postman now (see postman/login-lockout.postman_collection.json).
  WHY THIS NAME: The folders app/api/auth/login become /api/auth/login. Route files
  must be named "route", and it ends in .ts because it sends back data, not a screen.
*/

// The shared route helpers from lib/api/respond.ts: the error shape and JSON body checking.
import { apiError, parseJsonBody } from "@/lib/api/respond";
// attemptLogin from lib/auth/loginAttempt.ts: the lockout and the password check, shared with the login form.
import { attemptLogin, type LoginResult } from "@/lib/auth/loginAttempt";
// createSession from lib/auth/session.ts: sets the signed bv_session cookie.
import { createSession } from "@/lib/auth/session";
// The login rules (email and password shape) and the one vague message, from lib/auth/validation.ts.
import { INVALID_LOGIN_MESSAGE, loginSchema } from "@/lib/auth/validation";
// logServerError (Section 1): logs only a short, cleaned-up error line.
import { logServerError } from "@/lib/logging/safeLog";
import { TOO_MANY_ATTEMPTS_MESSAGE } from "@/lib/security/attempts";

/* POST: public. See the list of answers at the top of this file. */
export async function POST(request: Request) {
  // parseJsonBody checks the content type, the size, that it's real JSON, and the loginSchema rules.
  const body = await parseJsonBody(request, loginSchema);
  if (!body.ok) return body.response;

  let result: LoginResult;
  try {
    result = await attemptLogin(body.data.email, body.data.password);
  } catch (error) {
    logServerError("API login failed:", error);
    return apiError("server-error", "Something went wrong on our side. Please try again.", 500);
  }

  if (!result.ok) {
    if (result.reason === "locked") {
      const response = apiError("too-many-requests", TOO_MANY_ATTEMPTS_MESSAGE, 429);
      // Retry-After is the standard header for "come back in this many seconds".
      response.headers.set("Retry-After", String(result.retryAfterSeconds));
      return response;
    }
    return apiError("unauthorized", INVALID_LOGIN_MESSAGE, 401);
  }

  await createSession(result.user.id);
  return Response.json({ user: result.user });
}
