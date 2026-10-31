import { cookies } from "next/headers";
import { SIGNUP_COOKIE } from "@/lib/constants";
import { SiteFooter, SiteHeader } from "@/components/chrome";

export default async function SiteLayout({ children }: { children: React.ReactNode }) {
  const signedUp = (await cookies()).get(SIGNUP_COOKIE)?.value === "1";
  return (
    <>
      <SiteHeader signedUp={signedUp} />
      <main id="main" className="pb-12">
        {children}
      </main>
      <SiteFooter />
    </>
  );
}
