"use client";

export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="mx-auto max-w-md px-4 py-20 text-center">
      <h1 className="text-2xl font-extrabold uppercase">Something went wrong</h1>
      <p className="mt-2 text-sm text-muted">Please try again in a moment.</p>
      {error.digest && <p className="mt-2 text-xs text-muted">Reference: {error.digest}</p>}
      <button onClick={reset} className="mt-6 h-11 rounded-full bg-ink px-6 text-sm font-semibold text-white">
        Try again
      </button>
    </div>
  );
}
