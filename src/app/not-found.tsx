import { LinkButton } from "@/components/ui";

export default function NotFound() {
  return (
    <div className="mx-auto max-w-md px-4 py-20 text-center">
      <h1 className="text-2xl font-extrabold uppercase">Not found</h1>
      <p className="mt-2 text-sm text-muted">This card or page doesn&apos;t exist (or was removed).</p>
      <LinkButton href="/people" className="mt-6">
        Browse people
      </LinkButton>
    </div>
  );
}
