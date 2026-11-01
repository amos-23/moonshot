import { ImageResponse } from "next/og";
import { getDb } from "@/lib/db";
import { eventPhase, getEvent } from "@/lib/events";
import { BRAND, OG_SIZE, clip, ogFonts, ogHeaders } from "@/lib/og";
import { eventTheme, themeKind } from "@/lib/theme";

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
  const kind = event ? themeKind(event) : null;
  // Each event in its own colours (see lib/theme.ts); Event Connect itself is dark with warm light.
  const look = {
    moonshot: { bg: BRAND.flame, kicker: "#ffffff", foot: BRAND.ink },
    admarp: { bg: "#171834", kicker: "#1dc2ef", foot: "#c9a84c" },
    ogun: { bg: "#0e1411", kicker: "#03be5e", foot: "#b9fbc0" },
    default: { bg: BRAND.ink, kicker: BRAND.sun, foot: BRAND.sun },
  }[kind ?? "default"];
  // Events with their own colour (set by organisers, or taken from their site) use it as the background.
  if (event && kind === "default" && event.brandColor) {
    const t = eventTheme(event);
    if (t.onPrimary === "#ffffff") Object.assign(look, { bg: t.primary, kicker: "#ffffff", foot: "#ffffff" });
    else Object.assign(look, { kicker: t.primary, foot: t.primary });
  }
  const sub = event ? "Search a name and follow up. No sign-up." : "Find people worth meeting, reach them directly, and relive the moments.";
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", position: "relative", fontFamily: "Outfit", color: "white", background: look.bg, overflow: "hidden", padding: "0 60px" }}>
        {kind === "moonshot" ? (
          <div style={{ position: "absolute", bottom: -560, left: 100, width: 1000, height: 1000, borderRadius: 1000, background: BRAND.sun, display: "flex" }} />
        ) : kind === "admarp" ? (
          <div style={{ display: "flex", position: "absolute", inset: 0 }}>
            <div style={{ position: "absolute", top: -300, right: -200, width: 800, height: 800, borderRadius: 800, background: "radial-gradient(circle, rgba(29,194,239,0.35), rgba(29,194,239,0) 70%)", display: "flex" }} />
            <div style={{ position: "absolute", bottom: -350, left: -200, width: 800, height: 800, borderRadius: 800, background: "radial-gradient(circle, rgba(201,168,76,0.3), rgba(201,168,76,0) 70%)", display: "flex" }} />
          </div>
        ) : kind === "ogun" ? (
          // A row of Ogun Digital's circle tiles along the bottom.
          <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: 60, display: "flex" }}>
            {Array.from({ length: 20 }, (_, i) => (
              <div key={i} style={{ width: 60, height: 60, display: "flex", alignItems: "center", justifyContent: "center", background: ["#9be29c", "#08a7d6", "#ffffff", "#0d3b1e"][i % 4] }}>
                <div style={{ width: i % 2 ? 44 : 26, height: i % 2 ? 44 : 26, borderRadius: 60, background: ["#2a0a40", "#ffffff", "#0fbf5f", "#9be29c"][i % 4], display: "flex" }} />
              </div>
            ))}
          </div>
        ) : (
          // Event Connect: a warm glow from the top and its linked rings.
          <div style={{ position: "absolute", top: -500, left: 100, width: 1000, height: 900, borderRadius: 1000, background: "radial-gradient(circle, rgba(232,80,42,0.55), rgba(232,80,42,0) 70%)", display: "flex" }} />
        )}
        {!event && (
          <div style={{ display: "flex", position: "relative", width: 120, height: 70, marginBottom: 26 }}>
            <div style={{ position: "absolute", left: 0, top: 0, width: 70, height: 70, borderRadius: 70, border: `10px solid ${BRAND.flame}`, display: "flex" }} />
            <div style={{ position: "absolute", left: 50, top: 0, width: 70, height: 70, borderRadius: 70, border: `10px solid ${BRAND.sun}`, display: "flex" }} />
          </div>
        )}
        <div style={{ display: "flex", fontSize: 26, fontWeight: 800, letterSpacing: 6, textAlign: "center", color: look.kicker }}>{clip(kicker, 60).toUpperCase()}</div>
        <div style={{ display: "flex", fontSize: title.length > 24 ? 84 : 104, fontWeight: 800, letterSpacing: -2, lineHeight: 1, marginTop: 14, textAlign: "center" }}>{title.toUpperCase()}</div>
        <div style={{ display: "flex", fontSize: 32, fontWeight: 500, marginTop: 20, textAlign: "center" }}>{sub}</div>
        <div style={{ position: "absolute", bottom: kind === "ogun" ? 84 : 44, display: "flex", fontSize: 28, fontWeight: 800, color: look.foot }}>
          {`${event ? event.short : "Event"} Connect`.toUpperCase()} · {event ? `${host}/${event.slug}` : host}
        </div>
      </div>
    ),
    { ...OG_SIZE, fonts: await ogFonts(), headers: ogHeaders },
  );
}
