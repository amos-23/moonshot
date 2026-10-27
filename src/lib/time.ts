// All event times are entered and shown in Lagos time (WAT, UTC+1, no daylight saving),
// so in-person and remote attendees see the same clock as the venue.

export const EVENT_TZ = "Africa/Lagos";
export const EVENT_TZ_LABEL = "WAT";

/** Parse a datetime-local value ("2026-10-28T10:30") as Lagos time. */
export function parseLagosLocal(value: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value)) return null;
  const d = new Date(`${value}:00+01:00`);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function toLagosInput(d: Date): string {
  const shifted = new Date(d.getTime() + 60 * 60_000);
  return shifted.toISOString().slice(0, 16);
}

export function formatWhen(d: Date | string, opts: { withTz?: boolean } = { withTz: true }): string {
  const date = typeof d === "string" ? new Date(d) : d;
  const s = new Intl.DateTimeFormat("en-GB", {
    timeZone: EVENT_TZ,
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
  return opts.withTz ? `${s} ${EVENT_TZ_LABEL}` : s;
}

export function formatDate(d: Date | string): string {
  const date = typeof d === "string" ? new Date(d) : d;
  return new Intl.DateTimeFormat("en-GB", { timeZone: EVENT_TZ, day: "numeric", month: "short", year: "numeric" }).format(date);
}

export function formatTime(d: Date | string): string {
  const date = typeof d === "string" ? new Date(d) : d;
  return new Intl.DateTimeFormat("en-GB", { timeZone: EVENT_TZ, hour: "2-digit", minute: "2-digit" }).format(date);
}

export function timeAgo(d: Date | string): string {
  const date = typeof d === "string" ? new Date(d) : d;
  const s = Math.round((Date.now() - date.getTime()) / 1000);
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  if (s < 86400 * 7) return `${Math.floor(s / 86400)}d ago`;
  return formatDate(date);
}
