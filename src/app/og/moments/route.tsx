import { ImageResponse } from "next/og";
import { and, desc, eq, sql } from "drizzle-orm";
import { getDb, schema } from "@/lib/db";
import { BRAND, OG_SIZE, fetchAsDataUrl, ogFonts, ogHeaders } from "@/lib/og";

// The preview image for /moments: a strip of the latest photos under a big "Moments".
export async function GET(req: Request) {
  const db = await getDb();
  const rows = await db
    .select({ id: schema.moments.id, uploaded: sql<boolean>`${schema.moments.photoCount} > 0 or ${schema.moments.hasPhoto}`, xMedia: schema.moments.xMedia })
    .from(schema.moments)
    .where(and(eq(schema.moments.hidden, false), sql`(${schema.moments.photoCount} > 0 or ${schema.moments.hasPhoto} or cardinality(${schema.moments.xMedia}) > 0)`))
    .orderBy(desc(schema.moments.createdAt))
    .limit(6);
  const imgs: string[] = [];
  for (const r of rows) {
    if (imgs.length === 3) break;
    if (r.uploaded) {
      const [p] = await db.select().from(schema.momentPhotos).where(and(eq(schema.momentPhotos.momentId, r.id), eq(schema.momentPhotos.position, 0))).limit(1);
      if (p) imgs.push(`data:${p.mime};base64,${p.data}`);
    } else if (r.xMedia[0]) {
      const d = await fetchAsDataUrl(r.xMedia[0]);
      if (d) imgs.push(d);
    }
  }
  const host = new URL(req.url).host;
  const tilt = [-4, 2, -2];

  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", alignItems: "center", position: "relative", fontFamily: "Outfit", color: "white", background: BRAND.ink, overflow: "hidden" }}>
        <div style={{ position: "absolute", top: -420, left: 200, width: 800, height: 800, borderRadius: 800, background: "radial-gradient(circle, rgba(232,80,42,0.6), rgba(232,80,42,0) 70%)", display: "flex" }} />
        <div style={{ display: "flex", marginTop: 44, fontSize: 24, fontWeight: 800, letterSpacing: 6, color: BRAND.sun }}>MOONSHOT 2026 · LAGOS</div>
        <div style={{ display: "flex", fontSize: 120, fontWeight: 800, letterSpacing: -2, lineHeight: 1 }}>MOMENTS</div>
        <div style={{ display: "flex", fontSize: 28, fontWeight: 500, opacity: 0.75, marginTop: 6 }}>Photos and highlights, shared by the people who were there</div>
        <div style={{ display: "flex", gap: 28, marginTop: 34 }}>
          {(imgs.length ? imgs : [null, null, null]).map((src, i) =>
            src ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img key={i} src={src} alt="" width={320} height={220} style={{ width: 320, height: 220, objectFit: "cover", borderRadius: 24, transform: `rotate(${tilt[i]}deg)`, border: "4px solid rgba(255,255,255,0.15)" }} />
            ) : (
              <div key={i} style={{ width: 320, height: 220, borderRadius: 24, transform: `rotate(${tilt[i]}deg)`, background: i === 1 ? BRAND.sun : BRAND.flame, display: "flex" }} />
            ),
          )}
        </div>
        <div style={{ position: "absolute", bottom: 26, display: "flex", fontSize: 24, fontWeight: 700, opacity: 0.7 }}>{host}/moments</div>
      </div>
    ),
    { ...OG_SIZE, fonts: await ogFonts(), headers: ogHeaders },
  );
}
