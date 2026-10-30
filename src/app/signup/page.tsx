import { getMe } from "@/lib/me";
import { SignupForm } from "@/components/forms";
import { Card, PageTitle } from "@/components/ui";

export const metadata = { title: "Sign up", description: "Optional: leave your email for future Moonshot Connect updates." };

export default async function SignupPage() {
  const me = await getMe();
  return (
    <div className="mx-auto max-w-xl px-4 py-8">
      <PageTitle title="Sign up" sub="Optional. Leave your email to hear about what's next from Moonshot Connect. Everything on the site works without it." />
      <Card className="p-5 sm:p-6">
        <SignupForm name={me?.name ?? ""} about={me?.headline ?? ""} />
      </Card>
      <p className="mt-4 text-xs text-muted">We only use your email for Moonshot Connect updates. It&apos;s never shown on the site or shared. Reply to any email to be removed.</p>
    </div>
  );
}
