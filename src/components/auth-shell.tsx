import { ConnectMark } from "./chrome";
import { Card } from "./ui";

/** The sign-in pages' frame: Event Connect's mark over a single centred card. */
export function AuthShell({ title, sub, children }: { title: string; sub: string; children: React.ReactNode }) {
  return (
    <div className="mx-auto max-w-md px-4 py-10 sm:py-14">
      <div className="mb-6 text-center">
        <span className="inline-flex">
          <ConnectMark size={44} />
        </span>
        <h1 className="mt-4 text-3xl font-extrabold tracking-tight">{title}</h1>
        <p className="mt-2 text-sm text-muted">{sub}</p>
      </div>
      <Card className="p-5 sm:p-6">{children}</Card>
    </div>
  );
}

export function AuthOff() {
  return <p className="text-sm text-muted">Sign-in isn&apos;t switched on for this site yet. You can still browse events, add yourself and post moments without an account.</p>;
}
