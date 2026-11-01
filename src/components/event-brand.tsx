import type { CSSProperties, ReactNode } from "react";
import { eventTheme, type EventTheme } from "@/lib/theme";
import { ConnectMark, SunriseMark } from "./chrome-marks";
import { Sunburst } from "./ui";
import { cx } from "./ui";

type Ev = { id: string; slug: string; short: string; name: string; brandColor?: string | null; logo?: string | null; logoBg?: string | null };

/** The event's own logo (from its site), on a backing of its colour when the logo is light. */
export function EventLogo({ event, className }: { event: Ev; className?: string }) {
  if (!event.logo) return null;
  return (
    <span className={cx("inline-flex shrink-0 items-center", event.logoBg && "rounded-lg px-2 py-1")} style={event.logoBg ? { background: event.logoBg } : undefined}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={event.logo} alt={event.name} className={cx("w-auto object-contain", className ?? "h-8 max-w-[150px]")} />
    </span>
  );
}

export const displayFont = (t: EventTheme): CSSProperties | undefined =>
  t.display === "playfair" ? { fontFamily: "'Playfair Display', Georgia, serif" } : t.display === "platypi" ? { fontFamily: "Platypi, Georgia, serif" } : undefined;

const connectWord = (color: string, hideSmall?: boolean) => (
  <span className={cx("text-[13px] font-extrabold uppercase tracking-[0.18em]", hideSmall && "hidden min-[420px]:inline")} style={{ color }}>
    Connect
  </span>
);

/** The event's own logo in the header, then "Connect". */
export function EventWordmark({ event }: { event: Ev }) {
  const t = eventTheme(event);
  if (t.kind === "admarp")
    return (
      <span className="inline-flex items-center gap-2.5">
        <span className="text-[22px] font-black leading-none tracking-tight" style={{ ...displayFont(t), color: "#171834" }}>
          AD<span style={{ color: "#0b8cb0" }}>MARP</span>
        </span>
        <span aria-hidden className="hidden h-5 w-px bg-line min-[420px]:block" />
        {connectWord("#0b8cb0", true)}
      </span>
    );
  if (t.kind === "ogun")
    return (
      <span className="inline-flex items-center gap-2.5">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/brands/ogun-digital-summit.svg" alt="Ogun Digital Summit" width={33} height={40} className="h-10 w-auto" />
        <span aria-hidden className="hidden h-5 w-px bg-line min-[420px]:block" />
        {connectWord("#178a2d", true)}
      </span>
    );
  const accent = t.kind === "default" && event.brandColor ? (t.onPrimary === "#ffffff" ? t.primary : "#1e1f26") : "#c23f1c";
  if (t.kind === "default" && event.logo)
    return (
      <span className="inline-flex items-center gap-2.5">
        <EventLogo event={event} className="h-7 max-w-[120px] min-[420px]:max-w-[150px]" />
        <span aria-hidden className="hidden h-5 w-px bg-line min-[420px]:block" />
        {connectWord(accent, true)}
      </span>
    );
  return (
    <span className="inline-flex items-center gap-2">
      {t.kind === "moonshot" ? <SunriseMark /> : <ConnectMark />}
      <span className="hidden text-[15px] font-extrabold uppercase tracking-[0.12em] min-[440px]:inline">
        {event.short} <span style={{ color: accent }}>Connect</span>
      </span>
    </span>
  );
}

/** Ogun Digital's look: tiles of circles and quarter circles in its greens, purple and blue. */
export function OgunPattern({ className, rows = 2 }: { className?: string; rows?: number }) {
  const C = { purple: "#2a0a40", blue: "#08a7d6", mint: "#9be29c", green: "#0fbf5f", deep: "#0d3b1e", white: "#ffffff" };
  const cols = 24;
  const tiles: ReactNode[] = [];
  for (let r = 0; r < rows; r++)
    for (let c = 0; c < cols; c++) {
      const k = (c * 7 + r * 5 + ((c * r) % 3)) % 6;
      const x = c * 40;
      const y = r * 40;
      const key = `${r}-${c}`;
      if (k === 0) tiles.push(<g key={key}><rect x={x} y={y} width="40" height="40" fill={C.mint} /><circle cx={x + 20} cy={y + 20} r="18" fill={C.purple} /><circle cx={x + 20} cy={y + 20} r="7" fill={C.green} /></g>);
      else if (k === 1) tiles.push(<g key={key}><rect x={x} y={y} width="40" height="40" fill={C.blue} /><circle cx={x + 20} cy={y + 20} r="18" fill={C.white} /><circle cx={x + 20} cy={y + 20} r="7" fill={C.blue} /></g>);
      else if (k === 2) tiles.push(<g key={key}><rect x={x} y={y} width="40" height="40" fill={C.white} /><path d={`M${x} ${y}h40v40A40 40 0 0 1 ${x} ${y}z`} fill={C.purple} /></g>);
      else if (k === 3) tiles.push(<g key={key}><rect x={x} y={y} width="40" height="40" fill={C.mint} /><path d={`M${x} ${y + 40}V${y}A40 40 0 0 1 ${x + 40} ${y + 40}z`} fill={C.blue} /></g>);
      else if (k === 4) tiles.push(<g key={key}><rect x={x} y={y} width="40" height="40" fill={C.deep} /><circle cx={x + 20} cy={y + 20} r="12" fill={C.mint} /></g>);
      else tiles.push(<g key={key}><rect x={x} y={y} width="40" height="40" fill={C.white} /><path d={`M${x + 40} ${y}V${y + 40}H${x}A40 40 0 0 1 ${x + 40} ${y}z`} fill={C.green} /></g>);
    }
  return (
    <svg viewBox={`0 0 ${cols * 40} ${rows * 40}`} preserveAspectRatio="xMidYMid slice" className={className} aria-hidden>
      {tiles}
    </svg>
  );
}

/** The decorative layer behind an event's hero, in its own style. */
export function EventHeroBackdrop({ event }: { event: Ev }) {
  const t = eventTheme(event);
  if (t.kind === "moonshot") return <Sunburst className="absolute inset-x-0 bottom-0 h-full w-full" />;
  if (t.kind === "admarp")
    return (
      <>
        <span aria-hidden className="absolute -right-24 -top-32 h-[28rem] w-[28rem] rounded-full" style={{ background: "radial-gradient(circle, rgba(29,194,239,0.16) 0%, transparent 70%)" }} />
        <span aria-hidden className="absolute -bottom-40 -left-24 h-[26rem] w-[26rem] rounded-full" style={{ background: "radial-gradient(circle, rgba(201,168,76,0.14) 0%, transparent 70%)" }} />
      </>
    );
  if (t.kind === "ogun")
    return (
      <>
        <span aria-hidden className="absolute inset-0 opacity-60" style={{ backgroundImage: "linear-gradient(#eef2ee 1px, transparent 1px), linear-gradient(90deg, #eef2ee 1px, transparent 1px)", backgroundSize: "56px 56px" }} />
        <OgunPattern className="absolute inset-x-0 bottom-0 h-8 w-full sm:h-10" rows={1} />
      </>
    );
  return (
    <>
      <span aria-hidden className="absolute -left-20 -top-28 h-80 w-80 rounded-full opacity-40 blur-3xl" style={{ background: t.primary === "#c23f1c" ? "#e8502a" : t.primary }} />
      <span aria-hidden className="absolute -bottom-32 right-0 h-80 w-80 rounded-full opacity-30 blur-3xl" style={{ background: t.accent }} />
    </>
  );
}

/** Hub card cover for an event with no photo yet, in its own colours. */
export function EventCover({ event }: { event: Ev }) {
  const t = eventTheme(event);
  if (t.kind === "ogun")
    return (
      <span aria-hidden className="absolute inset-0" style={{ background: "#0e1411" }}>
        <OgunPattern className="absolute inset-x-0 top-0 h-[38%] w-full" rows={2} />
        <span className="absolute right-4 top-[46%] rounded-xl bg-white px-2 py-1.5">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/brands/ogun-digital-summit.svg" alt="" className="h-9 w-auto" />
        </span>
      </span>
    );
  if (t.kind === "admarp")
    return (
      <span aria-hidden className="absolute inset-0" style={{ background: "#171834" }}>
        <span className="absolute -right-16 -top-20 h-64 w-64 rounded-full" style={{ background: "radial-gradient(circle, rgba(29,194,239,0.45) 0%, transparent 70%)" }} />
        <span className="absolute -bottom-24 -left-10 h-64 w-64 rounded-full" style={{ background: "radial-gradient(circle, rgba(201,168,76,0.45) 0%, transparent 70%)" }} />
        <span className="absolute right-5 top-4 text-3xl font-black tracking-tight text-white/90" style={displayFont(t)}>
          AD<span style={{ color: "#1dc2ef" }}>MARP</span>
        </span>
      </span>
    );
  if (t.kind === "moonshot")
    return (
      <span aria-hidden className="absolute inset-0" style={{ background: "#e8502a" }}>
        <Sunburst className="absolute inset-0 h-full w-full" />
      </span>
    );
  return (
    <span aria-hidden className="absolute inset-0" style={{ background: `linear-gradient(135deg, #1e1f26 10%, ${event.brandColor ? t.primary : "#7a5cff"})` }}>
      {event.logo && (
        <span className="absolute right-4 top-4 rounded-xl px-2.5 py-2 shadow-sm" style={{ background: event.logoBg ?? "#ffffff" }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={event.logo} alt="" className="h-9 w-auto max-w-[170px] object-contain" />
        </span>
      )}
    </span>
  );
}
