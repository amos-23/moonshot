import { AtSign, MessageCircle } from "lucide-react";
import { CopyButton } from "./client";

/** Share a message + link on X, WhatsApp, or by copying it. Each button is tracked. */
export function ShareButtons({ text, url, track }: { text: string; url: string; track: string }) {
  const full = `${text} ${url}`;
  const btn = "inline-flex h-9 items-center gap-1.5 rounded-full px-4 text-sm font-semibold";
  return (
    <div className="flex flex-wrap items-center gap-2">
      <a href={`https://x.com/intent/post?${new URLSearchParams({ text: full })}`} target="_blank" rel="noopener noreferrer" data-track={`${track}_x`} className={`${btn} bg-ink text-white hover:bg-black`}>
        <AtSign size={15} aria-hidden /> Share on X
      </a>
      <a href={`https://wa.me/?${new URLSearchParams({ text: full })}`} target="_blank" rel="noopener noreferrer" data-track={`${track}_whatsapp`} className={`${btn} border border-line bg-white hover:border-ink/30`}>
        <MessageCircle size={15} aria-hidden /> WhatsApp
      </a>
      <span data-track={`${track}_copy`}>
        <CopyButton text={url} label="Copy link" />
      </span>
    </div>
  );
}
