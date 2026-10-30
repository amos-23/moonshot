import { ImageResponse } from "next/og";
import { EVENT, eventOver } from "@/lib/constants";
import { BRAND, OG_SIZE, ogFonts, ogHeaders } from "@/lib/og";

// The site's default preview image, in the hero's colours.
export async function GET(req: Request) {
  const over = eventOver();
  const host = new URL(req.url).host;
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", position: "relative", fontFamily: "Outfit", color: "white", background: BRAND.flame, overflow: "hidden" }}>
        <div style={{ position: "absolute", bottom: -560, left: 100, width: 1000, height: 1000, borderRadius: 1000, background: BRAND.sun, display: "flex" }} />
        <div style={{ display: "flex", fontSize: 26, fontWeight: 800, letterSpacing: 6 }}>{over ? "MOONSHOT 2026 · THANKS FOR COMING" : `${EVENT.dates.toUpperCase()} · LAGOS`}</div>
        <div style={{ display: "flex", fontSize: 104, fontWeight: 800, letterSpacing: -2, lineHeight: 1, marginTop: 14, textAlign: "center" }}>{over ? "FIND THE PEOPLE YOU MET" : "WHO'S AT MOONSHOT"}</div>
        <div style={{ display: "flex", fontSize: 32, fontWeight: 500, marginTop: 20 }}>Search a name and follow up. No sign-up.</div>
        <div style={{ position: "absolute", bottom: 44, display: "flex", fontSize: 28, fontWeight: 800, color: BRAND.ink }}>MOONSHOT CONNECT · {host}</div>
      </div>
    ),
    { ...OG_SIZE, fonts: await ogFonts(), headers: ogHeaders },
  );
}
