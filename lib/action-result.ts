import type { ZodError } from "zod";

export type ActionResult<T = unknown> =
  | ({ ok: true } & T)
  | { ok: false; error?: string; fieldErrors?: Record<string, string> };

/** Flatten a ZodError into `{ "items.0.rate": "Rate is required" }` (first message per path). */
export function fieldErrorsFrom(error: ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path.join(".");
    if (!(key in out)) out[key] = issue.message;
  }
  return out;
}

export function fail(error: string, fieldErrors?: Record<string, string>): { ok: false; error: string; fieldErrors?: Record<string, string> } {
  return { ok: false, error, fieldErrors };
}
