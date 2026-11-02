export const PERSISTED_STATUSES = ["draft", "sent", "viewed", "partially_paid", "paid"] as const;
export type PersistedStatus = (typeof PERSISTED_STATUSES)[number];

/** `overdue` is never stored; it is derived from due date + balance. */
export type InvoiceStatus = PersistedStatus | "overdue";

export const STATUS_LABELS: Record<InvoiceStatus, string> = {
  draft: "Draft",
  sent: "Sent",
  viewed: "Viewed",
  partially_paid: "Partially paid",
  paid: "Paid",
  overdue: "Overdue",
};

/** Today as YYYY-MM-DD (UTC), the format used by `date` columns. */
export function todayISO(now: Date = new Date()): string {
  return now.toISOString().slice(0, 10);
}

export function balanceCents(inv: { totalCents: number; paidCents: number }): number {
  return Math.max(0, inv.totalCents - inv.paidCents);
}

export function effectiveStatus(
  inv: { status: PersistedStatus; dueDate: string; totalCents: number; paidCents: number },
  today: string = todayISO(),
): InvoiceStatus {
  if (inv.status === "draft" || inv.status === "paid") return inv.status;
  if (balanceCents(inv) > 0 && inv.dueDate < today) return "overdue";
  return inv.status;
}

/**
 * Status after the paid amount changes. Drafts stay drafts (they must be sent first);
 * once money is received the invoice moves to partially_paid / paid, and back if a payment is removed.
 */
export function statusAfterPayment(
  current: PersistedStatus,
  totalCents: number,
  paidCents: number,
  viewedAt: Date | null,
): PersistedStatus {
  if (current === "draft") return "draft";
  if (totalCents > 0 && paidCents >= totalCents) return "paid";
  if (paidCents > 0) return "partially_paid";
  return viewedAt ? "viewed" : "sent";
}

/** SQL fragment helper is in db/queries; this is the JS mirror used for display + tests. */
export const OVERDUE_BUCKETS = [
  { key: "current", label: "Not yet due", min: -Infinity, max: 0 },
  { key: "1-30", label: "1–30 days", min: 1, max: 30 },
  { key: "31-60", label: "31–60 days", min: 31, max: 60 },
  { key: "60+", label: "60+ days", min: 61, max: Infinity },
] as const;

export function daysOverdue(dueDate: string, today: string = todayISO()): number {
  const ms = Date.parse(today + "T00:00:00Z") - Date.parse(dueDate + "T00:00:00Z");
  return Math.floor(ms / 86_400_000);
}
