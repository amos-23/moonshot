import { getAccount } from "@/lib/auth";
import { SiteFooter, SiteHeader } from "@/components/chrome";

export default async function SiteLayout({ children }: { children: React.ReactNode }) {
  const account = await getAccount();
  return (
    <>
      <SiteHeader account={account && { email: account.email, name: account.name }} />
      <main id="main" className="pb-12">
        {children}
      </main>
      <SiteFooter />
    </>
  );
}
