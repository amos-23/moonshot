import type { Metadata, Viewport } from "next";
import "./globals.css";
import { Tracker } from "@/components/tracker";
import { siteOrigin } from "@/lib/site";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const origin = await siteOrigin();
  // Every page shares with a branded preview image unless it sets its own.
  const image = { url: "/og/site", width: 1200, height: 630, alt: "Event Connect" };
  return {
    metadataBase: new URL(origin),
    title: { default: "Event Connect — meet the right people at events, and relive the moments", template: "%s" },
    description: "Find the people worth meeting at events like Moonshot, ADMARP Growth Summit and Ogun Digital Summit, reach them directly, and see the moments. No sign-up.",
    openGraph: { images: [image], siteName: "Event Connect" },
    twitter: { card: "summary_large_image", images: [image] },
  };
}

export const viewport: Viewport = { themeColor: "#e8502a", width: "device-width", initialScale: 1 };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-dvh antialiased">
        <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-50 focus:rounded-full focus:bg-white focus:px-4 focus:py-2">
          Skip to content
        </a>
        {children}
        <Tracker />
      </body>
    </html>
  );
}
