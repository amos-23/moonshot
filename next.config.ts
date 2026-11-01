import type { NextConfig } from "next";

// Before multi-event support everything was Moonshot's, at the top level. Old links (many shared on
// X) keep working by moving to /moonshot/…; the query string comes along, and #hashes stay in the browser.
const moved = ["moments", "card", "meet", "update"].map((page) => ({ source: `/${page}`, destination: `/moonshot/${page}`, permanent: true }));
const oldHome = ["q", "f", "sort", "added"].map((key) => ({ source: "/", has: [{ type: "query" as const, key }], destination: "/moonshot", permanent: true }));

// The old Moonshot Connect domain moves to the Moonshot event on the new domain: every request that
// arrives on moonshot.latars.xyz (any path, over HTTP or HTTPS) gets a 301 to events.latars.xyz/moonshot.
// It only matches that exact host, so events.latars.xyz and every other domain are untouched, and the
// destination is on a different host, so it can't loop.
export const LEGACY_HOST = "moonshot.latars.xyz";
export const LEGACY_DESTINATION = "https://events.latars.xyz/moonshot";
const legacyDomain = [{ source: "/:path*", has: [{ type: "host" as const, value: LEGACY_HOST }], destination: LEGACY_DESTINATION, statusCode: 301 as const }];

const nextConfig: NextConfig = {
  serverExternalPackages: ["@electric-sql/pglite"],
  images: { remotePatterns: [{ protocol: "https", hostname: "**" }] },
  experimental: { serverActions: { bodySizeLimit: "4mb" } },
  async redirects() {
    // The old domain goes first, so it's a single hop.
    return [...legacyDomain, ...moved, ...oldHome];
  },
};

export default nextConfig;
