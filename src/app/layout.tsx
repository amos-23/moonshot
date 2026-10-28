import type { Metadata, Viewport } from "next";
import Link from "next/link";
import "./globals.css";
import { getMe } from "@/lib/me";
import { Tracker } from "@/components/tracker";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: { default: "Moonshot Connect — meet the right people at Moonshot 2026", template: "%s · Moonshot Connect" },
  description: "See who's going to Moonshot by TechCabal (Lagos, 28–29 Oct 2026) and reach the people worth meeting. No sign-up.",
};

export const viewport: Viewport = { themeColor: "#e8502a", width: "device-width", initialScale: 1 };

function Wordmark({ compact }: { compact?: boolean }) {
  return (
    <span className="inline-flex items-center gap-2">
      <svg width="28" height="28" viewBox="0 0 32 32" aria-hidden>
        <rect width="32" height="32" rx="8" fill="#e8502a" />
        <circle cx="16" cy="24" r="11" fill="#f6a821" />
      </svg>
      <span className={`text-[15px] font-extrabold uppercase tracking-[0.12em] ${compact ? "hidden min-[440px]:inline" : ""}`}>
        Moonshot <span className="text-flame-700">Connect</span>
      </span>
    </span>
  );
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const me = await getMe().catch(() => null);
  return (
    <html lang="en">
      <body className="min-h-dvh antialiased">
        <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-50 focus:rounded-full focus:bg-white focus:px-4 focus:py-2">
          Skip to content
        </a>
        <header className="sticky top-0 z-30 border-b border-line bg-canvas/90 backdrop-blur">
          <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4">
            <Link href="/" aria-label="Moonshot Connect home">
              <Wordmark compact={Boolean(me)} />
            </Link>
            <div className="flex items-center gap-2">
              {me && (
                <Link href="/update" data-track="update_header" className="inline-flex h-10 items-center rounded-full bg-flame-700 px-4 text-sm font-semibold text-white hover:bg-flame">
                  📸 Update
                </Link>
              )}
              <Link href="/card" data-track="add_yourself_header" className="inline-flex h-10 items-center rounded-full bg-ink px-4 text-sm font-semibold text-white hover:bg-black">
                {me ? "My card" : "Add yourself"}
              </Link>
            </div>
          </div>
        </header>
        <main id="main" className="pb-12">
          {children}
        </main>
        <footer className="mx-auto max-w-6xl px-4 pb-10 text-xs text-muted">
          <p className="border-t border-line pt-6">
            Moonshot Connect is an independent, community-made tool. It isn&apos;t run or endorsed by TechCabal. For tickets, schedule and official info visit{" "}
            <a className="underline" href="https://moonshot.techcabal.com" target="_blank" rel="noopener noreferrer">
              moonshot.techcabal.com
            </a>
            .
          </p>
        </footer>
        <Tracker />
      </body>
    </html>
  );
}
