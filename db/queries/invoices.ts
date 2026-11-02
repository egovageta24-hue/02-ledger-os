import "server-only";
import { and, asc, desc, eq, gte, ilike, lte, or, sql, type SQL } from "drizzle-orm";
import { db } from "@/db";
import { activityLogs, clients, invoiceItems, invoices, organizations, payments, users } from "@/db/schema";
import { effectiveStatus, todayISO, type InvoiceStatus } from "@/lib/invoice-status";
import { escapeLike } from "@/lib/sql";

/** SQL mirror of `effectiveStatus === "overdue"` in lib/invoice-status.ts. */
export function overdueCondition(today: string = todayISO()): SQL {
  return sql`(${invoices.status} not in ('draft', 'paid') and ${invoices.dueDate} < ${today} and ${invoices.totalCents} > ${invoices.paidCents})`;
}

export const STATUS_FILTERS = ["all", "draft", "sent", "viewed", "partially_paid", "paid", "overdue"] as const;
export type StatusFilter = (typeof STATUS_FILTERS)[number];

function statusCondition(filter: StatusFilter, today: string): SQL | undefined {
  switch (filter) {
    case "all":
      return undefined;
    case "overdue":
      return overdueCondition(today);
    case "draft":
    case "paid":
      return eq(invoices.status, filter);
    default:
      // "sent" / "viewed" / "partially_paid" exclude invoices that have become overdue so the tabs don't overlap.
      return and(eq(invoices.status, filter), sql`not ${overdueCondition(today)}`);
  }
}

export type InvoiceFilters = {
  q?: string;
  status?: StatusFilter;
  clientId?: string;
  from?: string;
  to?: string;
  page?: number;
  pageSize?: number;
};

export async function listInvoices(orgId: string, f: InvoiceFilters = {}) {
  const today = todayISO();
  const pageSize = f.pageSize ?? 15;
  const page = Math.max(1, f.page ?? 1);
  const pattern = f.q ? `%${escapeLike(f.q)}%` : null;

  const where = and(
    eq(invoices.orgId, orgId),
    f.status ? statusCondition(f.status, today) : undefined,
    f.clientId ? eq(invoices.clientId, f.clientId) : undefined,
    f.from ? gte(invoices.issueDate, f.from) : undefined,
    f.to ? lte(invoices.issueDate, f.to) : undefined,
    pattern ? or(ilike(invoices.number, pattern), ilike(clients.name, pattern), ilike(clients.company, pattern)) : undefined,
  );

  const [rows, [{ total }]] = await Promise.all([
    db
      .select({
        id: invoices.id,
        number: invoices.number,
        status: invoices.status,
        issueDate: invoices.issueDate,
        dueDate: invoices.dueDate,
        totalCents: invoices.totalCents,
        paidCents: invoices.paidCents,
        clientId: clients.id,
        clientName: clients.name,
        clientCompany: clients.company,
      })
      .from(invoices)
      .innerJoin(clients, eq(clients.id, invoices.clientId))
      .where(where)
      .orderBy(desc(invoices.issueDate), desc(invoices.createdAt))
      .limit(pageSize)
      .offset((page - 1) * pageSize),
    db
      .select({ total: sql<number>`count(*)::int` })
      .from(invoices)
      .innerJoin(clients, eq(clients.id, invoices.clientId))
      .where(where),
  ]);

  return {
    rows: rows.map((r) => ({ ...r, effective: effectiveStatus(r, today) as InvoiceStatus })),
    total,
    page,
    pageSize,
    pageCount: Math.max(1, Math.ceil(total / pageSize)),
  };
}

/** Counts per status tab (overdue-aware, mutually exclusive). */
export async function invoiceStatusCounts(orgId: string): Promise<Record<StatusFilter, number>> {
  const today = todayISO();
  const od = overdueCondition(today);
  const [row] = await db
    .select({
      all: sql<number>`count(*)::int`,
      draft: sql<number>`count(*) filter (where ${invoices.status} = 'draft')::int`,
      sent: sql<number>`count(*) filter (where ${invoices.status} = 'sent' and not ${od})::int`,
      viewed: sql<number>`count(*) filter (where ${invoices.status} = 'viewed' and not ${od})::int`,
      partially_paid: sql<number>`count(*) filter (where ${invoices.status} = 'partially_paid' and not ${od})::int`,
      paid: sql<number>`count(*) filter (where ${invoices.status} = 'paid')::int`,
      overdue: sql<number>`count(*) filter (where ${od})::int`,
    })
    .from(invoices)
    .where(eq(invoices.orgId, orgId));
  return row;
}

async function loadFull(where: SQL) {
  const [inv] = await db
    .select({ invoice: invoices, client: clients, org: organizations })
    .from(invoices)
    .innerJoin(clients, eq(clients.id, invoices.clientId))
    .innerJoin(organizations, eq(organizations.id, invoices.orgId))
    .where(where)
    .limit(1);
  if (!inv) return null;

  const [items, pays] = await Promise.all([
    db.select().from(invoiceItems).where(eq(invoiceItems.invoiceId, inv.invoice.id)).orderBy(asc(invoiceItems.position)),
    db
      .select()
      .from(payments)
      .where(eq(payments.invoiceId, inv.invoice.id))
      .orderBy(desc(payments.paidAt), desc(payments.createdAt)),
  ]);

  return {
    ...inv.invoice,
    client: inv.client,
    org: inv.org,
    items,
    payments: pays,
    effective: effectiveStatus(inv.invoice) as InvoiceStatus,
  };
}

export type FullInvoice = NonNullable<Awaited<ReturnType<typeof loadFull>>>;

export function getInvoice(orgId: string, id: string) {
  return loadFull(and(eq(invoices.id, id), eq(invoices.orgId, orgId))!);
}

export function getInvoiceActivity(orgId: string, invoiceId: string) {
  return db
    .select({
      id: activityLogs.id,
      entityType: activityLogs.entityType,
      entityId: activityLogs.entityId,
      action: activityLogs.action,
      meta: activityLogs.meta,
      createdAt: activityLogs.createdAt,
      userName: users.name,
    })
    .from(activityLogs)
    .leftJoin(users, eq(users.id, activityLogs.userId))
    .where(and(eq(activityLogs.orgId, orgId), eq(activityLogs.entityType, "invoice"), eq(activityLogs.entityId, invoiceId)))
    .orderBy(desc(activityLogs.createdAt))
    .limit(20);
}

/** Public lookup used by the client-facing invoice page. Drafts are never public. */
export function getInvoiceByToken(token: string) {
  return loadFull(and(eq(invoices.shareToken, token), sql`${invoices.status} <> 'draft'`)!);
}
