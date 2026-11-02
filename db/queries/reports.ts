import "server-only";
import { addMonths, format, parseISO, startOfMonth } from "date-fns";
import { and, desc, eq, gte, lt, sql } from "drizzle-orm";
import { db } from "@/db";
import { clients, expenses, invoices, payments } from "@/db/schema";
import { todayISO } from "@/lib/invoice-status";
import { overdueCondition } from "./invoices";

import type { MonthPoint } from "@/components/charts/cashflow-charts";

export type { MonthPoint };

export type Range = { from: string; to: string }; // [from, to) ISO dates

/** The `count` calendar months ending with the month containing `today`. */
export function lastMonths(count: number, today: string = todayISO()): string[] {
  const end = startOfMonth(parseISO(today));
  return Array.from({ length: count }, (_, i) => format(addMonths(end, i - (count - 1)), "yyyy-MM"));
}

export function rangeForMonths(months: string[]): Range {
  const last = parseISO(`${months[months.length - 1]}-01`);
  return { from: `${months[0]}-01`, to: format(addMonths(last, 1), "yyyy-MM-dd") };
}

/** Month-by-month cash in (payments), cash out (expenses) and net, zero-filled. */
export async function monthlyCashflow(orgId: string, months: string[]): Promise<MonthPoint[]> {
  const range = rangeForMonths(months);
  const [paid, spent] = await Promise.all([
    db
      .select({
        month: sql<string>`to_char(${payments.paidAt}, 'YYYY-MM')`,
        total: sql<number>`sum(${payments.amountCents})::int`,
      })
      .from(payments)
      .where(and(eq(payments.orgId, orgId), gte(payments.paidAt, range.from), lt(payments.paidAt, range.to)))
      .groupBy(sql`1`),
    db
      .select({
        month: sql<string>`to_char(${expenses.date}, 'YYYY-MM')`,
        total: sql<number>`sum(${expenses.amountCents})::int`,
      })
      .from(expenses)
      .where(and(eq(expenses.orgId, orgId), gte(expenses.date, range.from), lt(expenses.date, range.to)))
      .groupBy(sql`1`),
  ]);
  const p = new Map(paid.map((r) => [r.month, r.total]));
  const e = new Map(spent.map((r) => [r.month, r.total]));
  return months.map((m) => {
    const revenueCents = p.get(m) ?? 0;
    const expensesCents = e.get(m) ?? 0;
    return {
      month: m,
      label: format(parseISO(`${m}-01`), "MMM"),
      revenueCents,
      expensesCents,
      netCents: revenueCents - expensesCents,
    };
  });
}

/** Money owed right now, split into outstanding / overdue. Drafts are not receivables. */
export async function receivables(orgId: string) {
  const today = todayISO();
  const open = sql`${invoices.status} not in ('draft', 'paid')`;
  const balance = sql`(${invoices.totalCents} - ${invoices.paidCents})`;
  const [row] = await db
    .select({
      outstandingCents: sql<number>`coalesce(sum(${balance}) filter (where ${open} and ${balance} > 0), 0)::int`,
      openCount: sql<number>`count(*) filter (where ${open} and ${balance} > 0)::int`,
      overdueCents: sql<number>`coalesce(sum(${balance}) filter (where ${overdueCondition(today)}), 0)::int`,
      overdueCount: sql<number>`count(*) filter (where ${overdueCondition(today)})::int`,
    })
    .from(invoices)
    .where(eq(invoices.orgId, orgId));
  return row;
}

/** A/R aging by days past due, as of today. */
export async function receivablesAging(orgId: string) {
  const today = todayISO();
  const balance = sql`(${invoices.totalCents} - ${invoices.paidCents})`;
  const days = sql`(${today}::date - ${invoices.dueDate})`;
  const [row] = await db
    .select({
      current: sql<number>`coalesce(sum(${balance}) filter (where ${days} <= 0), 0)::int`,
      d1_30: sql<number>`coalesce(sum(${balance}) filter (where ${days} between 1 and 30), 0)::int`,
      d31_60: sql<number>`coalesce(sum(${balance}) filter (where ${days} between 31 and 60), 0)::int`,
      d60plus: sql<number>`coalesce(sum(${balance}) filter (where ${days} > 60), 0)::int`,
    })
    .from(invoices)
    .where(and(eq(invoices.orgId, orgId), sql`${invoices.status} not in ('draft', 'paid')`, sql`${balance} > 0`));
  return [
    { key: "current", label: "Not yet due", cents: row.current },
    { key: "1-30", label: "1–30 days late", cents: row.d1_30 },
    { key: "31-60", label: "31–60 days late", cents: row.d31_60 },
    { key: "60+", label: "60+ days late", cents: row.d60plus },
  ];
}

/** Period totals for the reports summary. */
export async function periodTotals(orgId: string, range: Range) {
  const [[inv], [cash], [spend]] = await Promise.all([
    db
      .select({
        invoicedCents: sql<number>`coalesce(sum(${invoices.totalCents}), 0)::int`,
        taxCents: sql<number>`coalesce(sum(${invoices.taxCents}), 0)::int`,
        count: sql<number>`count(*)::int`,
      })
      .from(invoices)
      .where(
        and(
          eq(invoices.orgId, orgId),
          sql`${invoices.status} <> 'draft'`,
          gte(invoices.issueDate, range.from),
          lt(invoices.issueDate, range.to),
        ),
      ),
    db
      .select({ collectedCents: sql<number>`coalesce(sum(${payments.amountCents}), 0)::int` })
      .from(payments)
      .where(and(eq(payments.orgId, orgId), gte(payments.paidAt, range.from), lt(payments.paidAt, range.to))),
    db
      .select({ expensesCents: sql<number>`coalesce(sum(${expenses.amountCents}), 0)::int` })
      .from(expenses)
      .where(and(eq(expenses.orgId, orgId), gte(expenses.date, range.from), lt(expenses.date, range.to))),
  ]);
  return {
    ...inv,
    ...cash,
    ...spend,
    netCents: cash.collectedCents - spend.expensesCents,
  };
}

/** Cash received per client in the period. */
export function revenueByClient(orgId: string, range: Range, limit = 8) {
  return db
    .select({
      clientId: clients.id,
      name: clients.name,
      totalCents: sql<number>`sum(${payments.amountCents})::int`,
    })
    .from(payments)
    .innerJoin(invoices, eq(invoices.id, payments.invoiceId))
    .innerJoin(clients, eq(clients.id, invoices.clientId))
    .where(and(eq(payments.orgId, orgId), gte(payments.paidAt, range.from), lt(payments.paidAt, range.to)))
    .groupBy(clients.id, clients.name)
    .orderBy(desc(sql`sum(${payments.amountCents})`))
    .limit(limit);
}
