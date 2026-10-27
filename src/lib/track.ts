import "server-only";
import crypto from "crypto";
import { headers } from "next/headers";
import { getDb, schema } from "@/lib/db";

export const BOT_UA = /bot|crawl|spider|slurp|preview|facebookexternalhit|headless|lighthouse/i;

/** Anonymous visitor code: a hash of IP + browser that changes every day. */
export function visitorHash(ip: string, ua: string) {
  const day = new Date().toISOString().slice(0, 10);
  return crypto.createHash("sha256").update(`${process.env.ADMIN_KEY ?? "mc"}|${day}|${ip}|${ua}`).digest("hex").slice(0, 32);
}

export function clientIp(h: Headers) {
  return (h.get("x-forwarded-for")?.split(",")[0] ?? h.get("x-real-ip") ?? "").trim();
}

/** Records a search made on the home page. Never throws: stats must not break the page. */
export async function recordSearch(query: string, results: number) {
  try {
    const h = await headers();
    const ua = h.get("user-agent") ?? "";
    // Prefetches aren't real searches.
    if (BOT_UA.test(ua) || h.get("next-router-prefetch") || h.get("purpose") === "prefetch") return;
    const q = query.trim().toLowerCase().replace(/\s+/g, " ").slice(0, 80);
    if (!q) return;
    await (await getDb()).insert(schema.events).values({ type: "search", path: "/", query: q, results, visitor: visitorHash(clientIp(h), ua) });
  } catch (err) {
    console.error("recordSearch failed", err);
  }
}
