import Link from "next/link";
import clsx from "clsx";
import type { ComponentProps, ReactNode } from "react";

export const cx = clsx;

type Variant = "primary" | "dark" | "secondary" | "ghost" | "danger";
const variants: Record<Variant, string> = {
  primary: "bg-flame-700 text-white hover:bg-flame shadow-sm",
  dark: "bg-ink text-white hover:bg-black",
  secondary: "bg-white text-ink border border-line hover:border-ink/30",
  ghost: "text-ink hover:bg-black/5",
  danger: "bg-white text-red-700 border border-red-200 hover:bg-red-50",
};
const sizes = { sm: "h-9 px-3 text-sm", md: "h-11 px-5 text-sm", lg: "h-13 px-7 text-base" };

export function buttonClass(variant: Variant = "primary", size: keyof typeof sizes = "md", extra?: string) {
  return cx(
    "inline-flex items-center justify-center gap-2 rounded-full font-semibold transition-colors disabled:opacity-50 disabled:pointer-events-none whitespace-nowrap",
    variants[variant],
    sizes[size],
    extra,
  );
}

export function Button({ variant = "primary", size = "md", className, ...p }: ComponentProps<"button"> & { variant?: Variant; size?: keyof typeof sizes }) {
  return <button className={buttonClass(variant, size, className)} {...p} />;
}

export function LinkButton({ variant = "primary", size = "md", className, ...p }: ComponentProps<typeof Link> & { variant?: Variant; size?: keyof typeof sizes }) {
  return <Link className={buttonClass(variant, size, className)} {...p} />;
}

export function Card({ className, ...p }: ComponentProps<"div">) {
  return <div className={cx("rounded-3xl border border-line bg-surface", className)} {...p} />;
}

export function Tag({ children, tone = "neutral" }: { children: ReactNode; tone?: "neutral" | "flame" | "sun" | "green" }) {
  const t = {
    neutral: "bg-canvas text-ink border-line",
    flame: "bg-flame-50 text-flame-700 border-flame/20",
    sun: "bg-sun-100 text-[#7a4b00] border-sun/40",
    green: "bg-emerald-50 text-emerald-800 border-emerald-200",
  }[tone];
  return <span className={cx("inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-medium", t)}>{children}</span>;
}

const palette = ["bg-flame text-white", "bg-sun text-ink", "bg-ink text-white", "bg-[#6a24c2] text-white"];

export function Avatar({ name, size = 48 }: { name: string; size?: number }) {
  const initials = name.split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0]?.toUpperCase()).join("");
  const color = palette[[...name].reduce((a, c) => a + c.charCodeAt(0), 0) % palette.length];
  return (
    <span aria-hidden style={{ width: size, height: size, fontSize: size * 0.38 }} className={cx("inline-flex shrink-0 items-center justify-center rounded-full font-bold", color)}>
      {initials || "?"}
    </span>
  );
}

export function Empty({ title, children, action }: { title: string; children?: ReactNode; action?: ReactNode }) {
  return (
    <div className="rounded-3xl border border-dashed border-line bg-surface px-6 py-12 text-center">
      <p className="text-lg font-semibold">{title}</p>
      {children && <div className="mx-auto mt-1 max-w-md text-sm text-muted">{children}</div>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export function Notice({ tone = "info", children }: { tone?: "info" | "success" | "warn" | "danger"; children: ReactNode }) {
  const t = { info: "border-line bg-white", success: "border-emerald-200 bg-emerald-50 text-emerald-900", warn: "border-sun/50 bg-sun-100 text-[#5c3a00]", danger: "border-red-200 bg-red-50 text-red-800" }[tone];
  return (
    <div role={tone === "danger" ? "alert" : "status"} className={cx("rounded-2xl border px-4 py-3 text-sm", t)}>
      {children}
    </div>
  );
}

export function PageTitle({ title, sub, action }: { title: string; sub?: ReactNode; action?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-3xl font-extrabold uppercase tracking-tight sm:text-4xl">{title}</h1>
        {sub && <p className="mt-1 text-muted">{sub}</p>}
      </div>
      {action}
    </div>
  );
}

export const inputClass =
  "w-full rounded-2xl border border-line bg-white px-4 py-3 text-base text-ink placeholder:text-muted/60 focus:border-flame focus:outline-none focus:ring-4 focus:ring-flame/15 aria-[invalid=true]:border-red-400 sm:text-sm";

export function Field({ label, htmlFor, hint, error, optional, children }: { label: string; htmlFor?: string; hint?: string; error?: string; optional?: boolean; children: ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={htmlFor} className="block text-sm font-semibold">
        {label} {optional && <span className="font-normal text-muted">(optional)</span>}
      </label>
      {children}
      {error ? (
        <p className="text-xs text-red-600" role="alert">
          {error}
        </p>
      ) : (
        hint && <p className="text-xs text-muted">{hint}</p>
      )}
    </div>
  );
}

/** Original sunburst motif inspired by the 2026 Moonshot theme colours (not their artwork). */
export function Sunburst({ className }: { className?: string }) {
  const rays = Array.from({ length: 36 }, (_, i) => (i * 180) / 35);
  return (
    <svg viewBox="0 0 400 200" className={className} aria-hidden preserveAspectRatio="xMidYMax slice">
      <g stroke="#ffffff" strokeOpacity="0.18" strokeWidth="1.2">
        {rays.map((deg) => {
          const r = (deg * Math.PI) / 180;
          return <line key={deg} x1="200" y1="200" x2={200 - Math.cos(r) * 420} y2={200 - Math.sin(r) * 420} />;
        })}
      </g>
      <circle cx="200" cy="230" r="150" fill="#f6a821" />
    </svg>
  );
}
