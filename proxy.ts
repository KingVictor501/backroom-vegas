/*
  FILE: proxy.ts
  WHAT IT'S FOR: A quick check that runs BEFORE any page or API route:
  1. API routes (/api/...): applies the CORS rules (see lib/api/cors.ts). Only
     our own website may use the API from a browser. Any other website gets
     "403 Forbidden". Login for API routes is checked inside each route, which
     answers with JSON instead of redirecting.
  2. Pages:
     - The invite code is only needed to CREATE AN ACCOUNT. Not logged in, and opening
       /signup without a valid invite cookie → go to /invite first.
     - /privacy and /terms (Privacy Policy, Terms of Use) are open to everyone.
     - /login and /invite are always open to logged-out visitors. Anyone who already has an
       account can log in on any device without a code. (Whether an email is allowed in is
       decided at login: an email that isn't in the database can't log in.)
     - Not logged in, and trying to open an app page → go to /login (and remember where they
       were going, so they land there after logging in).
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
// The Content-Security-Policy text and the per-page-view nonce, from lib/security/csp.ts.
import { buildCsp, makeNonce } from "@/lib/security/csp";

/** Pages only for visitors who are NOT logged in (a logged-in visitor is sent to the Feed). */
const LOGGED_OUT_ONLY_PATHS = ["/login", "/signup", "/invite"];

/** Pages anyone can read, logged in or not (the legal pages, linked from the footer). */
const PUBLIC_PATHS = ["/privacy", "/terms"];

/** Where a visitor enters an invite code (needed only before creating an account). */
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
  guardPage: decides whether to let a page request through or send the visitor elsewhere.
  `next` makes the "let it through" answer (it carries the Content-Security-Policy, see proxy below).
*/
async function guardPage(request: NextRequest, next: () => NextResponse): Promise<NextResponse> {
  const { pathname, search } = request.nextUrl;

  const session = await readSessionToken(
    request.cookies.get(SESSION_COOKIE_NAME)?.value,
  );
  const isLoggedOutPage = LOGGED_OUT_ONLY_PATHS.includes(pathname);

  // Logged in but on /login, /signup, or /invite → send to the Feed.
  if (session && isLoggedOutPage) {
    return NextResponse.redirect(new URL("/", request.url));
  }

  if (!session) {
    // The invite page and the login page are always open to logged-out visitors.
    if (pathname === INVITE_PATH || pathname === "/login") return next();

    // The Privacy Policy and Terms of Use are public: people read them before they sign up.
    if (PUBLIC_PATHS.includes(pathname)) return next();

    // Sign up is the ONE page that needs an invite. No valid invite cookie → enter a code first
    // (keeping ?next=, so they still end up in the right place afterwards).
    if (pathname === "/signup") {
      const invite = await readInviteToken(request.cookies.get(INVITE_COOKIE_NAME)?.value);
      if (invite) return next();
      const inviteUrl = new URL(INVITE_PATH, request.url);
      const wanted = request.nextUrl.searchParams.get("next");
      if (wanted) inviteUrl.searchParams.set("next", wanted);
      return NextResponse.redirect(inviteUrl);
    }

    // Any app page while logged out → /login?next=<where they were going>.
    const loginUrl = new URL("/login", request.url);
    if (pathname !== "/") loginUrl.searchParams.set("next", pathname + search);
    return NextResponse.redirect(loginUrl);
  }

  return next();
}

/*
  proxy: the entry point Next.js calls.
  - API routes: only the CORS rules (their answers are JSON, not pages, so a CSP adds nothing).
  - Pages: first make this page view's CSP (with a fresh nonce), then run the login and invite checks.
    Every page that is allowed through gets the CSP header, and Next.js is told the nonce through the request
    headers so it can stamp it on its own scripts. Redirects don't need one.
*/
export async function proxy(request: NextRequest) {
  if (request.nextUrl.pathname.startsWith("/api/")) return handleApiCors(request);

  const nonce = makeNonce();
  const csp = buildCsp(nonce, process.env.NODE_ENV === "development");
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-nonce", nonce);
  requestHeaders.set("Content-Security-Policy", csp);

  return guardPage(request, () => {
    const response = NextResponse.next({ request: { headers: requestHeaders } });
    response.headers.set("Content-Security-Policy", csp);
    return response;
  });
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
