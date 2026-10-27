import { redirect } from "next/navigation";
import { getViewer } from "@/lib/auth";
import { ProfileForm } from "@/components/profile-form";
import { PageHeader } from "@/components/ui";

export const metadata = { title: "Create your profile" };

export default async function OnboardingPage() {
  const viewer = await getViewer();
  if (!viewer) redirect("/login?next=/onboarding");
  if (viewer.profile) redirect("/discover");
  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <PageHeader
        title="Set up your profile"
        subtitle="Takes about two minutes. Everything can be changed later from Profile."
      />
      <ProfileForm profile={null} onboarding />
    </div>
  );
}
