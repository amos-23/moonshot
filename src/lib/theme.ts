import { MOONSHOT_EVENT_ID } from "@/lib/db/schema";

// Each event wears its own colours, taken from its official site, so its page feels like part of it:
// Moonshot keeps the sunrise, ADMARP its navy, blue and gold, Ogun Digital its greens and circle pattern.
// Events added later get the neutral Event Connect look. Plain values only, so share images can use them too.

export type ThemeKind = "moonshot" | "admarp" | "ogun" | "default";

export type EventTheme = {
  kind: ThemeKind;
  /** Main buttons and highlights. */
  primary: string;
  /** Text on `primary`. */
  onPrimary: string;
  /** Second colour: the Meet up button, small accents. */
  accent: string;
  onAccent: string;
  /** Hero background and text. */
  heroBg: string;
  heroText: string;
  /** A softer line under the headline. */
  heroMuted: string;
  /** Eyebrow / highlight colour inside the hero. */
  heroHighlight: string;
  /** Headline typeface. */
  display: "sans" | "playfair" | "platypi";
  /** Header buttons: [background, text]. */
  momentsBtn: [string, string];
  meetBtn: [string, string];
};

const THEMES: Record<ThemeKind, EventTheme> = {
  moonshot: {
    kind: "moonshot",
    primary: "#c23f1c",
    onPrimary: "#ffffff",
    accent: "#f6a821",
    onAccent: "#1e1f26",
    heroBg: "#e8502a",
    heroText: "#ffffff",
    heroMuted: "rgba(255,255,255,0.9)",
    heroHighlight: "#ffffff",
    display: "sans",
    momentsBtn: ["#c23f1c", "#ffffff"],
    meetBtn: ["#f6a821", "#1e1f26"],
  },
  admarp: {
    kind: "admarp",
    primary: "#171834",
    onPrimary: "#ffffff",
    accent: "#0b8cb0",
    onAccent: "#ffffff",
    heroBg: "#ffffff",
    heroText: "#171834",
    heroMuted: "#6b7280",
    heroHighlight: "#0b8cb0",
    display: "playfair",
    momentsBtn: ["#0b8cb0", "#ffffff"],
    meetBtn: ["#c9a84c", "#171834"],
  },
  ogun: {
    kind: "ogun",
    primary: "#178a2d",
    onPrimary: "#ffffff",
    accent: "#b9fbc0",
    onAccent: "#0d3b1e",
    heroBg: "#ffffff",
    heroText: "#101828",
    heroMuted: "#475467",
    heroHighlight: "#178a2d",
    display: "platypi",
    momentsBtn: ["#178a2d", "#ffffff"],
    meetBtn: ["#b9fbc0", "#0d3b1e"],
  },
  default: {
    kind: "default",
    primary: "#c23f1c",
    onPrimary: "#ffffff",
    accent: "#f6a821",
    onAccent: "#1e1f26",
    heroBg: "#15161c",
    heroText: "#ffffff",
    heroMuted: "rgba(255,255,255,0.72)",
    heroHighlight: "#f6a821",
    display: "sans",
    momentsBtn: ["#c23f1c", "#ffffff"],
    meetBtn: ["#f6a821", "#1e1f26"],
  },
};

export function themeKind(event: { id: string; slug: string }): ThemeKind {
  if (event.id === MOONSHOT_EVENT_ID) return "moonshot";
  if (event.slug.startsWith("admarp")) return "admarp";
  if (event.slug.startsWith("ogun-digital")) return "ogun";
  return "default";
}

/** Relative luminance of "#rrggbb" (0 dark … 1 light). */
function luminance(hex: string): number {
  const [r, g, b] = [1, 3, 5].map((i) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
/** Mix "#rrggbb" towards white by `amount` (0–1). */
function lighten(hex: string, amount: number): string {
  return `#${[1, 3, 5].map((i) => Math.round(parseInt(hex.slice(i, i + 2), 16) + (255 - parseInt(hex.slice(i, i + 2), 16)) * amount).toString(16).padStart(2, "0")).join("")}`;
}

/**
 * The event's look. Events without a built-in theme use the neutral dark look, tinted with their own brand
 * colour when they've set one (people who create events pick it).
 */
export function eventTheme(event: { id: string; slug: string; brandColor?: string | null }): EventTheme {
  const kind = themeKind(event);
  const base = THEMES[kind];
  const c = kind === "default" && event.brandColor && /^#[0-9a-f]{6}$/i.test(event.brandColor) ? event.brandColor.toLowerCase() : null;
  if (!c) return base;
  const onC = luminance(c) > 0.45 ? "#1e1f26" : "#ffffff";
  return { ...base, primary: c, onPrimary: onC, accent: lighten(c, 0.55), onAccent: "#1e1f26", heroHighlight: luminance(c) < 0.2 ? lighten(c, 0.45) : c, momentsBtn: [c, onC], meetBtn: [lighten(c, 0.7), "#1e1f26"] };
}
