import "server-only";
import { and, asc, desc, eq, ilike, isNull, or, sql } from "drizzle-orm";
import { db } from "@/db";
import { activityLogs, clients, invoices, users } from "@/db/schema";
import { escapeLike } from "@/lib/sql";

export type ClientWithTotals = typeof clients.$inferSelect & {
  invoiceCount: number;
  billedCents: number;
  paidCents: number;
};

/** Totals only count non-draft invoices (drafts haven't been billed yet). */
const billed = sql<number>`coalesce(sum(${invoices.totalCents}) filter (where ${invoices.status} <> 'draft'), 0)::int`;
const paid = sql<number>`coalesce(sum(${invoices.paidCents}) filter (where ${invoices.status} <> 'draft'), 0)::int`;
const count = sql<number>`count(${invoices.id})::int`;

export async function listClients(orgId: string, opts: { q?: string; archived?: boolean } = {}): Promise<ClientWithTotals[]> {
  const pattern = opts.q ? `%${escapeLike(opts.q)}%` : null;
  const rows = await db
    .select({ client: clients, invoiceCount: count, billedCents: billed, paidCents: paid })
    .from(clients)
    .leftJoin(invoices, eq(invoices.clientId, clients.id))
    .where(
      and(
        eq(clients.orgId, orgId),
        opts.archived ? sql`${clients.archivedAt} is not null` : isNull(clients.archivedAt),
        pattern
          ? or(ilike(clients.name, pattern), ilike(clients.company, pattern), ilike(clients.email, pattern))
          : undefined,
      ),
    )
    .groupBy(clients.id)
    .orderBy(asc(clients.name));
  return rows.map((r) => ({ ...r.client, invoiceCount: r.invoiceCount, billedCents: r.billedCents, paidCents: r.paidCents }));
}

/** Active clients for pickers (id + label only). */
export async function listClientOptions(orgId: string) {
  return db
    .select({ id: clients.id, name: clients.name, company: clients.company })
    .from(clients)
    .where(and(eq(clients.orgId, orgId), isNull(clients.archivedAt)))
    .orderBy(asc(clients.name));
}

export async function getClient(orgId: string, id: string) {
  const [row] = await db
    .select({ client: clients, invoiceCount: count, billedCents: billed, paidCents: paid })
    .from(clients)
    .leftJoin(invoices, eq(invoices.clientId, clients.id))
    .where(and(eq(clients.orgId, orgId), eq(clients.id, id)))
    .groupBy(clients.id);
  if (!row) return null;
  return { ...row.client, invoiceCount: row.invoiceCount, billedCents: row.billedCents, paidCents: row.paidCents };
}

export async function getClientActivity(orgId: string, clientId: string, invoiceIds: string[]) {
  const entityMatch = or(
    and(sql`${activityLogs.entityType} = 'client'`, eq(activityLogs.entityId, clientId)),
    invoiceIds.length ? and(sql`${activityLogs.entityType} = 'invoice'`, sql`${activityLogs.entityId} in ${invoiceIds}`) : undefined,
  );
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
    .where(and(eq(activityLogs.orgId, orgId), entityMatch))
    .orderBy(desc(activityLogs.createdAt))
    .limit(15);
}
