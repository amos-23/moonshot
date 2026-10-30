import "server-only";
import { readFile } from "fs/promises";
import path from "path";

// Shared bits for the link-preview images (1200×630) X and WhatsApp show when a link is shared.

export const OG_SIZE = { width: 1200, height: 630 };
export const BRAND = { flame: "#e8502a", sun: "#f6a821", ink: "#121116", canvas: "#fff8f1" };

let fonts: Promise<{ name: string; data: Buffer; weight: 500 | 700 | 800; style: "normal" }[]> | null = null;
/** Outfit, the site's font (the WOFF files; the preview renderer can't read WOFF2). */
export function ogFonts() {
  fonts ??= Promise.all(
    ([500, 700, 800] as const).map(async (weight) => ({
      name: "Outfit",
      data: await readFile(path.join(process.cwd(), `node_modules/@fontsource/outfit/files/outfit-latin-${weight}-normal.woff`)),
      weight,
      style: "normal" as const,
    })),
  );
  return fonts;
}

/** Downloads an image hosted by X as a data URL (so a slow or blocked fetch can't break the preview). */
export async function fetchAsDataUrl(url: string): Promise<string | null> {
  if (!/^https:\/\/pbs\.twimg\.com\//.test(url)) return null;
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(4000) });
    const type = res.headers.get("content-type") ?? "";
    if (!res.ok || !/^image\/(jpeg|png)/.test(type)) return null;
    return `data:${type.split(";")[0]};base64,${Buffer.from(await res.arrayBuffer()).toString("base64")}`;
  } catch {
    return null;
  }
}

export const clip = (text: string | null | undefined, max: number) => {
  const t = (text ?? "").replace(/\s+/g, " ").trim();
  return t.length > max ? `${t.slice(0, max - 1).trimEnd()}…` : t;
};

export const ogHeaders = { "Cache-Control": "public, max-age=3600, s-maxage=3600" };
