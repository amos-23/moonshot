import { getAccount } from "@/lib/auth";
import { SiteFooter, SiteHeader } from "@/components/chrome";
import { SupportWidget } from "@/components/support-widget";

export default async function SiteLayout({ children }: { children: React.ReactNode }) {
  const account = await getAccount();
  return (
    <>
      <SiteHeader account={account && { email: account.email, name: account.name }} />
      <main id="main" className="pb-12">
        {children}
      </main>
      <SiteFooter />
      <SupportWidget account={account && { email: account.email, name: account.name }} />
    </>
  );
}
