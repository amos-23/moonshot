import type { Metadata, Viewport } from "next";
import Link from "next/link";
import { GeistSans } from "geist/font/sans";
import "./globals.css";
import { getViewer } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { pendingIncomingCount } from "@/lib/services/connections";
import { unreadTotal } from "@/lib/services/messaging";
import { DesktopNav, MobileNav } from "@/components/nav";
import { Logo } from "@/components/logo";
import { LinkButton } from "@/components/ui";

export const metadata: Metadata = {
  title: { default: "Moonshot Connect — meet the right people at Moonshot", template: "%s · Moonshot Connect" },
  description:
    "An independent networking companion for Moonshot by TechCabal (Lagos, 28–29 October 2026). Discover people, find shared interests and arrange meaningful conversations.",
};

export const dynamic = "force-dynamic";

export const viewport: Viewport = { themeColor: "#4b3fe0", width: "device-width", initialScale: 1 };

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const viewer = await getViewer().catch((err) => {
    console.error("Failed to load viewer", err);
    return null;
  });
  let counts = { requests: 0, unread: 0 };
  if (viewer?.profile) {
    const db = await getDb();
    const [requests, unread] = await Promise.all([pendingIncomingCount(db, viewer.user.id), unreadTotal(db, viewer.user.id)]);
    counts = { requests, unread };
  }
  const signedIn = Boolean(viewer);

  return (
    <html lang="en" className={GeistSans.variable}>
      <body className="min-h-dvh antialiased">
        <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-50 focus:rounded-lg focus:bg-white focus:px-3 focus:py-2">
          Skip to content
        </a>
        <header className="sticky top-0 z-30 border-b border-line bg-white/90 backdrop-blur">
          <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-4 px-4">
            <Link href={signedIn ? "/discover" : "/"} aria-label="Moonshot Connect home">
              <Logo />
            </Link>
            {signedIn ? (
              <div className="flex items-center gap-2">
                <DesktopNav counts={counts} />
                {viewer?.user.role === "admin" && (
                  <Link href="/admin" className="rounded-lg px-2 py-1 text-xs font-medium text-muted hover:bg-black/5">
                    Admin
                  </Link>
                )}
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <Link href="/conversation" className="hidden text-sm font-medium text-muted hover:text-ink sm:inline">
                  Conversation
                </Link>
                <Link href="/explore" className="hidden text-sm font-medium text-muted hover:text-ink sm:inline">
                  Explore
                </Link>
                <LinkButton href="/login" size="sm">
                  Sign in
                </LinkButton>
              </div>
            )}
          </div>
        </header>
        <main id="main" className={signedIn ? "pb-24 md:pb-10" : "pb-10"}>
          {children}
        </main>
        <footer className={signedIn ? "hidden md:block" : ""}>
          <div className="mx-auto max-w-6xl border-t border-line px-4 py-6 text-xs text-muted">
            <p>
              Moonshot Connect is an independent prototype. It is not affiliated with, endorsed by or operated by TechCabal or Moonshot.
              Event details are for convenience only — always check official sources.
            </p>
            <p className="mt-2 flex gap-4">
              <Link href="/about" className="underline-offset-2 hover:underline">
                About &amp; privacy
              </Link>
            </p>
          </div>
        </footer>
        {signedIn && <MobileNav counts={counts} />}
      </body>
    </html>
  );
}
