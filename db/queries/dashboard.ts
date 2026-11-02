import "server-only";
import { and, asc, desc, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { activityLogs, clients, invoices, users } from "@/db/schema";
import { todayISO } from "@/lib/invoice-status";
import { overdueCondition } from "./invoices";

/** Oldest-due first: these are the ones to chase. */
export function listOverdueInvoices(orgId: string, limit = 5) {
  return db
    .select({
      id: invoices.id,
      number: invoices.number,
      dueDate: invoices.dueDate,
      clientName: clients.name,
      balanceCents: sql<number>`(${invoices.totalCents} - ${invoices.paidCents})::int`,
    })
    .from(invoices)
    .innerJoin(clients, eq(clients.id, invoices.clientId))
    .where(and(eq(invoices.orgId, orgId), overdueCondition(todayISO())))
    .orderBy(asc(invoices.dueDate))
    .limit(limit);
}

export function getOrgActivity(orgId: string, limit = 10) {
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
    .where(eq(activityLogs.orgId, orgId))
    .orderBy(desc(activityLogs.createdAt))
    .limit(limit);
}
