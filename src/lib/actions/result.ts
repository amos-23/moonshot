import { AppError } from "@/lib/services/errors";

export type ActionResult = { ok: true; message?: string; data?: unknown } | { ok: false; error: string; fieldErrors?: Record<string, string> };

export const initialResult: ActionResult | null = null;

/** Run an action body, converting known errors into a user-facing result. */
export async function attempt(fn: () => Promise<ActionResult | void>): Promise<ActionResult> {
  try {
    return (await fn()) ?? { ok: true };
  } catch (err) {
    if (err instanceof AppError) return { ok: false, error: err.message };
    console.error(err);
    return { ok: false, error: "Something went wrong. Please try again." };
  }
}
