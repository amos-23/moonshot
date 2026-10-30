import { MessageCircle } from "lucide-react";
import { withUtm, xIntent } from "@/lib/share";
import { CopyButton } from "./client";

/** X's logo (lucide has none), for the "Post on X" buttons. */
export function XLogo({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
    </svg>
  );
}

/**
 * Share a message + link on X, WhatsApp, or by copying it. Each button is tracked, and each link is
 * tagged with where it was shared (utm_source) and what (utm_campaign), so Stats shows what comes back.
 */
export function ShareButtons({ text, url, track, campaign }: { text: string; url: string; track: string; campaign: string }) {
  const btn = "inline-flex h-9 items-center gap-1.5 rounded-full px-4 text-sm font-semibold";
  const wa = withUtm(url, "whatsapp", campaign);
  return (
    <div className="flex flex-wrap items-center gap-2">
      <a href={xIntent(text, withUtm(url, "x", campaign))} target="_blank" rel="noopener noreferrer" data-track={`${track}_x`} className={`${btn} bg-ink text-white hover:bg-black`}>
        <XLogo /> Post on X
      </a>
      <a href={`https://wa.me/?${new URLSearchParams({ text: `${text} ${wa}` })}`} target="_blank" rel="noopener noreferrer" data-track={`${track}_whatsapp`} className={`${btn} border border-line bg-white hover:border-ink/30`}>
        <MessageCircle size={15} aria-hidden /> WhatsApp
      </a>
      <span data-track={`${track}_copy`}>
        <CopyButton text={withUtm(url, "copy", campaign)} label="Copy link" />
      </span>
    </div>
  );
}
