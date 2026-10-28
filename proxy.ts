/*
  FILE: proxy.ts
  WHAT IT'S FOR: A quick check that runs BEFORE any page or API route:
  1. API routes (/api/...): applies the CORS rules (see lib/api/cors.ts). Only
     our own website may use the API from a browser. Any other website gets
     "403 Forbidden". Login for API routes is checked inside each route, which
     answers with JSON instead of redirecting.
  2. Pages:
     - No valid invite cookie (and not logged in), and opening ANY page except
       /invite → go to /invite. That includes /login and /signup, so nobody
       reaches them without entering an invite code first.
     - Has the invite cookie, not logged in, and trying to open an app page → go to
       /login (and remember where they were going, so they land there after logging in).
     - Already logged in, and opening /login, /signup, or /invite → go to the Feed instead.
  This is a fast "first guard" that only looks at the cookies and headers, not
  the database. (So it can tell an invite cookie is genuine, but not whether the
  code has since been used up. Sign up checks that again against the database.) The real checks still happen next to the data (lib/auth/dal.ts
  and every API route), as the Next.js docs recommend.
  WHO USES IT: Next.js runs it automatically on every matching request.
  WHY THIS NAME: Next.js 16 requires the exact name "proxy" (older versions
  called it "middleware"), in the project's main folder next to "app". It ends
  in .ts because it shows nothing on screen.
*/

import { NextResponse, type NextRequest } from "next/server";
// The cookie name and token checker from lib/auth/token.ts, the same ones used when logging in.
import { INVITE_COOKIE_NAME, readInviteToken, readSessionToken, SESSION_COOKIE_NAME } from "@/lib/auth/token";
// The CORS allowlist from lib/api/cors.ts (read from ALLOWED_ORIGINS in .env.local / Vercel).
import { corsHeaders, isAllowedOrigin } from "@/lib/api/cors";

/** Pages only for visitors who are NOT logged in (a logged-in visitor is sent to the Feed). */
const LOGGED_OUT_ONLY_PATHS = ["/login", "/signup", "/invite"];

/** The one page a visitor can see without an invite cookie: where they enter the code. */
const INVITE_PATH = "/invite";

/*
  handleApiCors: the CORS step for /api requests.
  - No "Origin" header: the request isn't from another website's page (it's
    from our own page, from Postman, or from a server), so CORS doesn't apply. Let it through.
  - Origin on our list: let it through, with the "you're allowed" headers.
  - Origin NOT on our list: block it with 403 and no "allowed" headers, so the
    browser refuses to hand the answer to that other website.
  - "OPTIONS" is a browser's "may I?" question (a preflight) before some
    requests. We answer it right here.
*/
function handleApiCors(request: NextRequest): NextResponse {
  const origin = request.headers.get("origin");
  // Our own website calling its own API is always fine (browsers allow
  // same-site requests anyway). This keeps the app working even if
  // ALLOWED_ORIGINS has a small typo, or when you open the app by a different
  // address on your Wi-Fi (like http://192.168.x.x:3000 from your phone).
  const isSameSite = origin === request.nextUrl.origin;

  if (origin && !isSameSite && !isAllowedOrigin(origin)) {
    return NextResponse.json(
      { error: { code: "forbidden", message: "This website isn't allowed to use this API." } },
      { status: 403 },
    );
  }

  const headers = origin ? corsHeaders(origin) : {};
  if (request.method === "OPTIONS") {
    // 204 = "No Content": the answer is just the permission headers.
    return new NextResponse(null, { status: 204, headers });
  }

  const response = NextResponse.next();
  for (const [name, value] of Object.entries(headers)) response.headers.set(name, value);
  return response;
}

/*
  proxy: decides whether to let the request through or send the visitor elsewhere.
*/
export async function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;

  if (pathname.startsWith("/api/")) return handleApiCors(request);

  const session = await readSessionToken(
    request.cookies.get(SESSION_COOKIE_NAME)?.value,
  );
  const isLoggedOutPage = LOGGED_OUT_ONLY_PATHS.includes(pathname);

  // Logged in but on /login, /signup, or /invite → send to the Feed.
  if (session && isLoggedOutPage) {
    return NextResponse.redirect(new URL("/", request.url));
  }

  if (!session) {
    // The invite page itself is always open to logged-out visitors.
    if (pathname === INVITE_PATH) return NextResponse.next();

    const invite = await readInviteToken(request.cookies.get(INVITE_COOKIE_NAME)?.value);

    // No valid invite → everything leads to /invite first. We remember where
    // they were going (but not /login or /signup, which are not real destinations).
    if (!invite) {
      const inviteUrl = new URL(INVITE_PATH, request.url);
      if (pathname !== "/" && !isLoggedOutPage) inviteUrl.searchParams.set("next", pathname + search);
      return NextResponse.redirect(inviteUrl);
    }

    // A valid invite but not logged in, trying to open an app page → /login?next=<where they were going>.
    if (!isLoggedOutPage) {
      const loginUrl = new URL("/login", request.url);
      if (pathname !== "/") loginUrl.searchParams.set("next", pathname + search);
      return NextResponse.redirect(loginUrl);
    }
  }

  return NextResponse.next();
}

/*
  config.matcher: which addresses this runs on. It's every address EXCEPT:
  - /logout: must always work, even with a broken cookie
  - _next/static, _next/image, favicon.ico, and image files: the app's own
    files. Blocking these would break the login page's look, and phones
    asking for a home-screen icon shouldn't be sent to /login.
  (API routes ARE included now, for the CORS check above.)
*/
export const config = {
  matcher: ["/((?!logout|_next/static|_next/image|favicon.ico|.*\\.(?:png|jpg|jpeg|svg|ico|webp)$).*)"],
};
