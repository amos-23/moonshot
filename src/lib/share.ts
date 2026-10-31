// Share links and ready-made posts. Every shared link carries utm tags, so Stats shows which shares
// bring people back (Stats → Campaign links).

export type ShareChannel = "x" | "whatsapp" | "copy" | "native";

/** Adds ?utm_source=<channel>&utm_campaign=<campaign> to a link (keeping any #hash). */
export function withUtm(url: string, channel: ShareChannel, campaign: string): string {
  const [base, hash] = url.split("#");
  const sep = base.includes("?") ? "&" : "?";
  return `${base}${sep}utm_source=${channel}&utm_campaign=${encodeURIComponent(campaign)}${hash ? `#${hash}` : ""}`;
}

/** X's compose window with the post typed in. */
export function xIntent(text: string, url: string): string {
  return `https://x.com/intent/post?${new URLSearchParams({ text, url })}`;
}


/** A short, natural post about a moment, ending with the event's hashtag (or name). */
export function momentPost(m: { text: string | null; who: string; fromX: boolean }, tag: string): string {
  const words = m.text?.replace(/\s+/g, " ").trim();
  const quote = words ? `“${words.length > 120 ? `${words.slice(0, 117).trimEnd()}…` : words}”` : "";
  return quote ? `${quote} — ${m.fromX ? m.who : "a moment"} from ${tag} 📸` : `A moment from ${tag} 📸`;
}

/** Post text without X's leftover links (pic.twitter.com/…, t.co/…) and stray spacing, for display. */
export function cleanPostText(text: string | null | undefined): string {
  return (text ?? "")
    .replace(/\s*(?:https?:\/\/)?(?:pic\.twitter\.com|t\.co)\/\S+/gi, "")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]{2,}/g, " ")
    .trim();
}
