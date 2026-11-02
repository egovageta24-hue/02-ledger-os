"use server";

import { and, isNull, eq, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { activityLogs, invoices } from "@/db/schema";

/** First client view of a sent invoice: stamp `viewedAt`, move sent -> viewed, log it. Idempotent. */
export async function recordViewAction(token: string) {
  if (!token || token.length > 64) return;
  const [row] = await db
    .update(invoices)
    .set({
      viewedAt: new Date(),
      status: sql`case when ${invoices.status} = 'sent' then 'viewed'::invoice_status else ${invoices.status} end`,
    })
    .where(and(eq(invoices.shareToken, token), isNull(invoices.viewedAt), sql`${invoices.status} <> 'draft'`))
    .returning({ id: invoices.id, orgId: invoices.orgId, number: invoices.number });
  if (!row) return;

  await db.insert(activityLogs).values({
    orgId: row.orgId,
    userId: null,
    entityType: "invoice",
    entityId: row.id,
    action: "viewed",
    meta: { number: row.number },
  });
  revalidatePath(`/invoices/${row.id}`);
  revalidatePath("/invoices");
}
