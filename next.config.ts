import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /*
    images.remotePatterns: the only outside website next/image may load pictures
    from. ESPN hosts the team logos (and later player photos) at a.espncdn.com/i/...
    Anything else is refused, so nobody can use our server to resize random images.
  */
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
