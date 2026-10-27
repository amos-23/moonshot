"use client";

export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="mx-auto max-w-md px-4 py-20 text-center">
      <h1 className="text-2xl font-semibold tracking-tight">Something went wrong</h1>
      <p className="mt-2 text-sm text-muted">We couldn&apos;t load this page. Please try again in a moment.</p>
      {error.digest && <p className="mt-2 text-xs text-muted">Reference: {error.digest}</p>}
      <button onClick={reset} className="mt-6 inline-flex h-10 items-center rounded-xl bg-accent px-4 text-sm font-medium text-white hover:bg-accent-600">
        Try again
      </button>
    </div>
  );
}
