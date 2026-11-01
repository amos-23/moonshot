import { redirect } from "next/navigation";
import { getAccount } from "@/lib/auth";
import { PasswordForm } from "@/components/auth-forms";
import { AuthShell } from "@/components/auth-shell";

export const metadata = { title: "Set a new password · Event Connect", robots: { index: false } };

// Where the "reset password" email lands (already signed in by the link).
export default async function NewPasswordPage() {
  if (!(await getAccount())) redirect("/signin?error=link");
  return (
    <AuthShell title="Set a new password" sub="Choose a password with at least 8 characters.">
      <PasswordForm />
    </AuthShell>
  );
}
