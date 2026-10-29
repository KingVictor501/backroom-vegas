import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* poweredByHeader: false stops every answer from announcing "X-Powered-By: Next.js" (no need to tell strangers what we run). */
  poweredByHeader: false,
  /*
    headers: safety settings sent with EVERY page and API answer (from the
    Next.js docs' security headers list):
    - X-Frame-Options DENY: other websites can't show our pages inside a frame
      (stops "clickjacking", where a hidden frame tricks you into tapping our buttons)
    - X-Content-Type-Options nosniff: the browser never guesses a file's type,
      so a file can't be passed off as a script
    - Referrer-Policy: other websites only see our domain, never full page addresses
    - Strict-Transport-Security: browsers only use https for us (ignored on http://localhost)
    - Permissions-Policy: the app never uses the camera, microphone, or location, so they're switched off
  */
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          // Strict-Transport-Security: once a browser has seen us over https, it refuses plain http for 2 years.
          { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), browsing-topics=()" },
        ],
      },
    ];
  },
  /*
    images.remotePatterns: the only outside website next/image may load pictures
    from. ESPN hosts the team logos (and later player photos) at a.espncdn.com/i/...
    Anything else is refused, so nobody can use our server to resize random images.
  */
  /*
    experimental.serverActions.bodySizeLimit: the biggest form a Server Action will accept. The default is 1 MB; every
    form here (login, sign up, invite code, profile, settings) is a few hundred characters, so 100 KB is plenty and
    a giant fake form is refused early. (Server Actions also refuse forms sent from other websites by default.)
  */
  experimental: {
    serverActions: { bodySizeLimit: "100kb" },
  },
  images: {
    remotePatterns: [new URL("https://a.espncdn.com/i/**")],
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
