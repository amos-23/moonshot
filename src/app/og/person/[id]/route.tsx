import { ImageResponse } from "next/og";
import { and, eq } from "drizzle-orm";
import { getDb, schema } from "@/lib/db";
import { OFFERS, WANTS, labelFor } from "@/lib/constants";
import { BRAND, OG_SIZE, clip, ogFonts, ogHeaders } from "@/lib/og";

// The preview image for a shared card: a name card in Moonshot colours.
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const db = await getDb();
  const [row] = /^[0-9a-f-]{36}$/i.test(id)
    ? await db
        .select({ p: schema.people, short: schema.eventSpaces.short, eventName: schema.eventSpaces.name })
        .from(schema.people)
        .innerJoin(schema.eventSpaces, eq(schema.eventSpaces.id, schema.people.eventId))
        .where(and(eq(schema.people.id, id), eq(schema.people.hidden, false)))
        .limit(1)
    : [];
  const p = row?.p;
  const short = row?.short ?? "Event";
  const [photo] = p?.photoUpdatedAt ? await db.select().from(schema.photos).where(eq(schema.photos.personId, p.id)).limit(1) : [];
  const name = clip(p?.name ?? `${short} Connect`, 34);
  const sub = p ? clip(`${p.headline}${p.company ? ` · ${p.company}` : ""}`, 70) : "Find the people you met";
  const tags = p ? [...p.wants.map((w) => `Wants: ${labelFor(WANTS, w)}`), ...p.offers.map((o) => `Offers: ${labelFor(OFFERS, o)}`)].slice(0, 3) : [];
  const initials = name.split(/\s+/).slice(0, 2).map((w) => w[0]?.toUpperCase()).join("");
  const host = new URL(req.url).host;

  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", position: "relative", fontFamily: "Outfit", color: "white", background: BRAND.ink, overflow: "hidden" }}>
        <div style={{ position: "absolute", left: 380, top: 250, width: 1100, height: 1100, borderRadius: 1100, background: `radial-gradient(circle, ${BRAND.sun} 0%, ${BRAND.flame} 45%, rgba(232,80,42,0) 70%)`, opacity: 0.9, display: "flex" }} />
        <div style={{ position: "absolute", top: 56, left: 64, display: "flex", fontSize: 24, fontWeight: 800, letterSpacing: 4, color: BRAND.sun }}>{`${short} Connect`.toUpperCase()}{row ? ` · ${row.eventName.toUpperCase()}` : ""}</div>
        <div style={{ position: "absolute", top: 150, left: 64, right: 64, display: "flex", alignItems: "center", gap: 48 }}>
          {photo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={`data:${photo.mime};base64,${photo.data}`} alt="" width={230} height={230} style={{ width: 230, height: 230, borderRadius: 230, objectFit: "cover", border: `6px solid ${BRAND.sun}` }} />
          ) : (
            <div style={{ width: 230, height: 230, borderRadius: 230, background: BRAND.flame, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 96, fontWeight: 800, border: `6px solid ${BRAND.sun}` }}>{initials}</div>
          )}
          <div style={{ display: "flex", flexDirection: "column", gap: 10, flex: 1 }}>
            <div style={{ display: "flex", fontSize: 76, fontWeight: 800, lineHeight: 1 }}>{name}</div>
            <div style={{ display: "flex", fontSize: 34, fontWeight: 500, opacity: 0.85 }}>{sub}</div>
            {tags.length > 0 && (
              <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginTop: 12 }}>
                {tags.map((t) => (
                  <div key={t} style={{ display: "flex", fontSize: 24, fontWeight: 700, padding: "8px 18px", borderRadius: 999, background: "rgba(255,255,255,0.14)" }}>
                    {t}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
        <div style={{ position: "absolute", bottom: 52, left: 64, display: "flex", fontSize: 30, fontWeight: 700 }}>Find me on {short} Connect → {host}</div>
      </div>
    ),
    { ...OG_SIZE, fonts: await ogFonts(), headers: ogHeaders },
  );
}
