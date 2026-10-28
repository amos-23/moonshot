// Validates a photo sent from the browser as a data URL (already resized there).

const MAX_BYTES = 600 * 1024;
const MAGIC: Record<string, (b: Buffer) => boolean> = {
  "image/jpeg": (b) => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff,
  "image/png": (b) => b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])),
  "image/webp": (b) => b.subarray(0, 4).toString("ascii") === "RIFF" && b.subarray(8, 12).toString("ascii") === "WEBP",
};

export function parsePhoto(dataUrl: string): { mime: string; data: string } | { error: string } {
  const m = dataUrl.match(/^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=]+)$/);
  if (!m) return { error: "That photo couldn't be read. Try a JPEG or PNG." };
  const bytes = Buffer.from(m[2], "base64");
  if (bytes.length > MAX_BYTES) return { error: "That photo is too large." };
  if (!MAGIC[m[1]](bytes)) return { error: "That file isn't a photo." };
  return { mime: m[1], data: m[2] };
}
