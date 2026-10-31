import { ImageResponse } from "next/og";
import { getDb } from "@/lib/db";
import { eventPhase, getEvent } from "@/lib/events";
import { BRAND, OG_SIZE, clip, ogFonts, ogHeaders } from "@/lib/og";

// The default preview image, in the hero's colours: for an event (?e=<slug>), or for Event Connect.
export async function GET(req: Request) {
  const url = new URL(req.url);
  const host = url.host;
  const event = url.searchParams.get("e") ? await getEvent(await getDb(), url.searchParams.get("e")!) : null;
  const phase = event ? eventPhase(event) : null;
  const kicker = event
    ? phase === "after"
      ? `${event.short} · thanks for coming`
      : [event.dates, event.venue?.split(",").at(-1)?.trim()].filter(Boolean).join(" · ") || event.name
    : "Moonshot · ADMARP · Ogun Digital Summit · and more";
  const title = event ? (phase === "after" ? "Find the people you met" : phase === "before" ? `Who's going to ${event.short}` : `Who's at ${event.short}`) : "Meet the right people at events";
  const sub = event ? "Search a name and follow up. No sign-up." : "Find people worth meeting, reach them directly, and relive the moments.";
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", position: "relative", fontFamily: "Outfit", color: "white", background: BRAND.flame, overflow: "hidden", padding: "0 60px" }}>
        <div style={{ position: "absolute", bottom: -560, left: 100, width: 1000, height: 1000, borderRadius: 1000, background: BRAND.sun, display: "flex" }} />
        <div style={{ display: "flex", fontSize: 26, fontWeight: 800, letterSpacing: 6, textAlign: "center" }}>{clip(kicker, 60).toUpperCase()}</div>
        <div style={{ display: "flex", fontSize: title.length > 24 ? 84 : 104, fontWeight: 800, letterSpacing: -2, lineHeight: 1, marginTop: 14, textAlign: "center" }}>{title.toUpperCase()}</div>
        <div style={{ display: "flex", fontSize: 32, fontWeight: 500, marginTop: 20, textAlign: "center" }}>{sub}</div>
        <div style={{ position: "absolute", bottom: 44, display: "flex", fontSize: 28, fontWeight: 800, color: BRAND.ink }}>
          {`${event ? event.short : "Event"} Connect`.toUpperCase()} · {event ? `${host}/${event.slug}` : host}
        </div>
      </div>
    ),
    { ...OG_SIZE, fonts: await ogFonts(), headers: ogHeaders },
  );
}
