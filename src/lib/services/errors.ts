/** An error whose message is safe to show to the user. */
export class AppError extends Error {
  constructor(
    message: string,
    public code: "not_found" | "forbidden" | "conflict" | "invalid" | "rate_limited" = "invalid",
  ) {
    super(message);
    this.name = "AppError";
  }
}

export function isUniqueViolation(err: unknown): boolean {
  const e = err as { code?: string; cause?: { code?: string } };
  return e?.code === "23505" || e?.cause?.code === "23505";
}
