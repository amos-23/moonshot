import type { NextConfig } from "next";

// Before multi-event support everything was Moonshot's, at the top level. Old links (many shared on
// X) keep working by moving to /moonshot/…; the query string comes along, and #hashes stay in the browser.
const moved = ["moments", "card", "meet", "update"].map((page) => ({ source: `/${page}`, destination: `/moonshot/${page}`, permanent: true }));
const oldHome = ["q", "f", "sort", "added"].map((key) => ({ source: "/", has: [{ type: "query" as const, key }], destination: "/moonshot", permanent: true }));

const nextConfig: NextConfig = {
  serverExternalPackages: ["@electric-sql/pglite"],
  images: { remotePatterns: [{ protocol: "https", hostname: "**" }] },
  experimental: { serverActions: { bodySizeLimit: "4mb" } },
  async redirects() {
    return [...moved, ...oldHome];
  },
};

export default nextConfig;
