import { ImageResponse } from "next/og";
import { and, eq } from "drizzle-orm";
import { getDb, schema } from "@/lib/db";
import { BRAND, OG_SIZE, clip, fetchAsDataUrl, ogFonts, ogHeaders } from "@/lib/og";

// The preview image X/WhatsApp show for a shared moment: the photo, full bleed, with its caption.
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const db = await getDb();
  const [row] = /^[0-9a-f-]{36}$/i.test(id)
    ? await db
        .select({ m: schema.moments, author: schema.people.name })
        .from(schema.moments)
        .leftJoin(schema.people, eq(schema.people.id, schema.moments.personId))
        .where(and(eq(schema.moments.id, id), eq(schema.moments.hidden, false)))
        .limit(1)
    : [];
  const m = row?.m;
  let img: string | null = null;
  if (m && (m.photoCount || m.hasPhoto)) {
    const [p] = await db.select().from(schema.momentPhotos).where(and(eq(schema.momentPhotos.momentId, m.id), eq(schema.momentPhotos.position, 0))).limit(1);
    if (p) img = `data:${p.mime};base64,${p.data}`;
  } else if (m?.xMedia[0]) img = await fetchAsDataUrl(m.xMedia[0]);
  const text = clip(m ? m.body || m.xText : "Photos and highlights from Moonshot 2026", img ? 110 : 160);
  const who = m ? (m.xPostUrl ? (m.xAuthorName ?? `@${m.xAuthorHandle}`) : (row.author ?? (m.xHandle ? `@${m.xHandle}` : m.name)) ?? "Someone at Moonshot") : "";
  const host = new URL(req.url).host;

  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", position: "relative", fontFamily: "Outfit", color: "white", background: img ? BRAND.ink : `linear-gradient(135deg, ${BRAND.flame}, ${BRAND.sun})` }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        {img && <img src={img} alt="" width={1200} height={630} style={{ position: "absolute", top: 0, left: 0, width: 1200, height: 630, objectFit: "cover" }} />}
        <div style={{ position: "absolute", top: 0, left: 0, width: 1200, height: 630, display: "flex", background: img ? "linear-gradient(to top, rgba(0,0,0,0.88) 0%, rgba(0,0,0,0.25) 55%, rgba(0,0,0,0.45) 100%)" : "linear-gradient(to top, rgba(0,0,0,0.35), rgba(0,0,0,0))" }} />
        <div style={{ position: "absolute", top: 48, left: 56, display: "flex", alignItems: "center", gap: 16 }}>
          <div style={{ width: 44, height: 44, borderRadius: 12, background: img ? BRAND.flame : BRAND.ink, display: "flex", alignItems: "flex-end", justifyContent: "center", overflow: "hidden" }}>
            <div style={{ width: 32, height: 32, borderRadius: 32, background: BRAND.sun, marginBottom: -8 }} />
          </div>
          <div style={{ display: "flex", fontSize: 26, fontWeight: 800, letterSpacing: 4, color: img ? BRAND.sun : "white" }}>MOMENTS · MOONSHOT 2026</div>
        </div>
        <div style={{ position: "absolute", left: 56, right: 56, bottom: 52, display: "flex", flexDirection: "column", gap: 18 }}>
          {text && <div style={{ display: "flex", fontSize: img ? 52 : 64, fontWeight: 800, lineHeight: 1.1 }}>{img ? text : `“${text}”`}</div>}
          <div style={{ display: "flex", fontSize: 28, fontWeight: 500, opacity: 0.8 }}>{who ? `${who} · ${host}` : host}</div>
        </div>
      </div>
    ),
    { ...OG_SIZE, fonts: await ogFonts(), headers: ogHeaders },
  );
}
