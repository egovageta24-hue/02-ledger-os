"use server";

import { and, eq, sql } from "drizzle-orm";
import { nanoid } from "nanoid";
import { revalidatePath } from "next/cache";
import { db, runBatch, type Statement } from "@/db";
import { activityLogs, clients, invoiceItems, invoices, organizations, payments } from "@/db/schema";
import { fail, fieldErrorsFrom, type ActionResult } from "@/lib/action-result";
import { logActivity, requireAuth, type AuthContext } from "@/lib/auth";
import { balanceCents, statusAfterPayment, todayISO } from "@/lib/invoice-status";
import { calcInvoiceTotals, formatMoney } from "@/lib/money";
import {
  invoiceSchema,
  paymentSchema,
  type InvoiceInput,
  type InvoiceValues,
  type PaymentInput,
} from "@/lib/validation";

type Intent = "draft" | "send";

function refresh(id?: string) {
  revalidatePath("/invoices");
  revalidatePath("/dashboard");
  revalidatePath("/reports");
  revalidatePath("/clients");
  if (id) revalidatePath(`/invoices/${id}`);
}

function totalsFor(v: InvoiceValues) {
  return calcInvoiceTotals({
    items: v.items.map((i) => ({ quantity: i.quantity, rateCents: i.rate })),
    discountType: v.discountType,
    discountValue: v.discountValue,
    taxRateBps: v.taxRate,
  });
}

function itemRows(invoiceId: string, v: InvoiceValues, lineAmounts: number[]) {
  return v.items.map((it, position) => ({
    invoiceId,
    position,
    description: it.description,
    quantity: it.quantity,
    rateCents: it.rate,
    amountCents: lineAmounts[position],
  }));
}

async function clientBelongsToOrg(orgId: string, clientId: string) {
  const [c] = await db
    .select({ id: clients.id })
    .from(clients)
    .where(and(eq(clients.id, clientId), eq(clients.orgId, orgId)))
    .limit(1);
  return !!c;
}

/** Atomically take the next invoice number for the workspace. */
async function allocateNumber(ctx: AuthContext) {
  const [row] = await db
    .update(organizations)
    .set({ nextInvoiceNumber: sql`${organizations.nextInvoiceNumber} + 1` })
    .where(eq(organizations.id, ctx.org.id))
    .returning({ next: organizations.nextInvoiceNumber, prefix: organizations.invoicePrefix });
  return `${row.prefix}${String(row.next - 1).padStart(4, "0")}`;
}

export async function createInvoiceAction(input: InvoiceInput, intent: Intent): Promise<ActionResult<{ id: string }>> {
  const ctx = await requireAuth();
  const parsed = invoiceSchema.safeParse(input);
  if (!parsed.success) return fail("Please fix the highlighted fields.", fieldErrorsFrom(parsed.error));
  const v = parsed.data;
  if (!(await clientBelongsToOrg(ctx.org.id, v.clientId))) return fail("Choose a client.", { clientId: "Choose a client" });

  const t = totalsFor(v);
  const id = nanoid(12);
  const number = await allocateNumber(ctx);
  const now = new Date();
  const send = intent === "send";

  await runBatch([
    db.insert(invoices).values({
      id,
      orgId: ctx.org.id,
      clientId: v.clientId,
      number,
      status: send ? "sent" : "draft",
      issueDate: v.issueDate,
      dueDate: v.dueDate,
      discountType: v.discountType,
      discountValue: v.discountValue,
      taxName: v.taxName,
      taxRateBps: v.taxRate,
      notes: v.notes,
      terms: v.terms,
      subtotalCents: t.subtotalCents,
      discountCents: t.discountCents,
      taxCents: t.taxCents,
      totalCents: t.totalCents,
      sentAt: send ? now : null,
    }),
    db.insert(invoiceItems).values(itemRows(id, v, t.lineAmounts)),
    db.insert(activityLogs).values({
      orgId: ctx.org.id,
      userId: ctx.user.id,
      entityType: "invoice",
      entityId: id,
      action: send ? "sent" : "created",
      meta: { number, totalCents: t.totalCents },
    }),
  ]);

  refresh();
  return { ok: true, id };
}

export async function updateInvoiceAction(id: string, input: InvoiceInput, intent: Intent): Promise<ActionResult<{ id: string }>> {
  const ctx = await requireAuth();
  const parsed = invoiceSchema.safeParse(input);
  if (!parsed.success) return fail("Please fix the highlighted fields.", fieldErrorsFrom(parsed.error));
  const v = parsed.data;

  const [existing] = await db
    .select()
    .from(invoices)
    .where(and(eq(invoices.id, id), eq(invoices.orgId, ctx.org.id)))
    .limit(1);
  if (!existing) return fail("Invoice not found.");
  if (existing.paidCents > 0) return fail("This invoice has payments recorded and can no longer be edited.");
  if (!(await clientBelongsToOrg(ctx.org.id, v.clientId))) return fail("Choose a client.", { clientId: "Choose a client" });

  const t = totalsFor(v);
  const becomesSent = intent === "send" && existing.status === "draft";

  await runBatch([
    db
      .update(invoices)
      .set({
        clientId: v.clientId,
        issueDate: v.issueDate,
        dueDate: v.dueDate,
        discountType: v.discountType,
        discountValue: v.discountValue,
        taxName: v.taxName,
        taxRateBps: v.taxRate,
        notes: v.notes,
        terms: v.terms,
        subtotalCents: t.subtotalCents,
        discountCents: t.discountCents,
        taxCents: t.taxCents,
        totalCents: t.totalCents,
        ...(becomesSent ? { status: "sent" as const, sentAt: new Date() } : {}),
      })
      .where(and(eq(invoices.id, id), eq(invoices.orgId, ctx.org.id))),
    db.delete(invoiceItems).where(eq(invoiceItems.invoiceId, id)),
    db.insert(invoiceItems).values(itemRows(id, v, t.lineAmounts)),
    db.insert(activityLogs).values({
      orgId: ctx.org.id,
      userId: ctx.user.id,
      entityType: "invoice",
      entityId: id,
      action: becomesSent ? "sent" : "updated",
      meta: { number: existing.number, totalCents: t.totalCents },
    }),
  ]);

  refresh(id);
  return { ok: true, id };
}

export async function markInvoiceSentAction(id: string): Promise<ActionResult> {
  const ctx = await requireAuth();
  const [inv] = await db
    .update(invoices)
    .set({ status: "sent", sentAt: new Date() })
    .where(and(eq(invoices.id, id), eq(invoices.orgId, ctx.org.id), eq(invoices.status, "draft")))
    .returning({ number: invoices.number });
  if (!inv) return fail("Only draft invoices can be sent.");
  await logActivity(ctx, "invoice", id, "sent", { number: inv.number });
  refresh(id);
  return { ok: true };
}

export async function deleteInvoiceAction(id: string): Promise<ActionResult> {
  const ctx = await requireAuth();
  const [inv] = await db
    .delete(invoices)
    .where(and(eq(invoices.id, id), eq(invoices.orgId, ctx.org.id), eq(invoices.status, "draft")))
    .returning({ number: invoices.number });
  if (!inv) return fail("Only draft invoices can be deleted.");
  await logActivity(ctx, "invoice", id, "deleted", { number: inv.number });
  refresh();
  return { ok: true };
}

export async function duplicateInvoiceAction(id: string): Promise<ActionResult<{ id: string }>> {
  const ctx = await requireAuth();
  const [src] = await db
    .select()
    .from(invoices)
    .where(and(eq(invoices.id, id), eq(invoices.orgId, ctx.org.id)))
    .limit(1);
  if (!src) return fail("Invoice not found.");
  const items = await db.select().from(invoiceItems).where(eq(invoiceItems.invoiceId, id));

  const newId = nanoid(12);
  const number = await allocateNumber(ctx);
  const today = todayISO();
  const due = new Date(Date.now() + ctx.org.defaultPaymentTermsDays * 86_400_000).toISOString().slice(0, 10);

  const stmts: Statement[] = [
    db.insert(invoices).values({
      id: newId,
      orgId: ctx.org.id,
      clientId: src.clientId,
      number,
      status: "draft",
      issueDate: today,
      dueDate: due,
      discountType: src.discountType,
      discountValue: src.discountValue,
      taxName: src.taxName,
      taxRateBps: src.taxRateBps,
      notes: src.notes,
      terms: src.terms,
      subtotalCents: src.subtotalCents,
      discountCents: src.discountCents,
      taxCents: src.taxCents,
      totalCents: src.totalCents,
    }),
    db.insert(activityLogs).values({
      orgId: ctx.org.id,
      userId: ctx.user.id,
      entityType: "invoice",
      entityId: newId,
      action: "created",
      meta: { number, duplicatedFrom: src.number },
    }),
  ];
  if (items.length) {
    stmts.splice(
      1,
      0,
      db.insert(invoiceItems).values(
        items.map((it) => ({
          invoiceId: newId,
          position: it.position,
          description: it.description,
          quantity: it.quantity,
          rateCents: it.rateCents,
          amountCents: it.amountCents,
        })),
      ),
    );
  }
  await runBatch(stmts);

  refresh();
  return { ok: true, id: newId };
}

/* ---------------- payments ---------------- */

/** Re-derive paid amount + status from the payments table (self-healing after any change). */
async function syncPaid(invoiceId: string) {
  const [sum] = await db
    .select({ total: sql<number>`coalesce(sum(${payments.amountCents}), 0)::int` })
    .from(payments)
    .where(eq(payments.invoiceId, invoiceId));
  const [inv] = await db.select().from(invoices).where(eq(invoices.id, invoiceId)).limit(1);
  if (!inv) return;
  const status = statusAfterPayment(inv.status, inv.totalCents, sum.total, inv.viewedAt);
  await db.update(invoices).set({ paidCents: sum.total, status }).where(eq(invoices.id, invoiceId));
}

export async function recordPaymentAction(invoiceId: string, input: PaymentInput): Promise<ActionResult> {
  const ctx = await requireAuth();
  const parsed = paymentSchema.safeParse(input);
  if (!parsed.success) return fail("Please fix the highlighted fields.", fieldErrorsFrom(parsed.error));
  const v = parsed.data;

  const [inv] = await db
    .select()
    .from(invoices)
    .where(and(eq(invoices.id, invoiceId), eq(invoices.orgId, ctx.org.id)))
    .limit(1);
  if (!inv) return fail("Invoice not found.");
  if (inv.status === "draft") return fail("Send the invoice before recording a payment.");

  const balance = balanceCents(inv);
  if (balance <= 0) return fail("This invoice is already fully paid.");
  if (v.amount > balance) {
    return fail("Payment is more than the balance due.", {
      amount: `Can't exceed the remaining balance of ${formatMoney(balance, ctx.org.currency)}`,
    });
  }

  await db.insert(payments).values({
    orgId: ctx.org.id,
    invoiceId,
    amountCents: v.amount,
    paidAt: v.paidAt,
    method: v.method,
    reference: v.reference,
  });
  await syncPaid(invoiceId);
  await logActivity(ctx, "invoice", invoiceId, "payment_recorded", { number: inv.number, amountCents: v.amount });

  refresh(invoiceId);
  return { ok: true };
}

export async function deletePaymentAction(paymentId: string): Promise<ActionResult> {
  const ctx = await requireAuth();
  const [pay] = await db
    .delete(payments)
    .where(and(eq(payments.id, paymentId), eq(payments.orgId, ctx.org.id)))
    .returning({ invoiceId: payments.invoiceId });
  if (!pay) return fail("Payment not found.");
  await syncPaid(pay.invoiceId);
  await logActivity(ctx, "invoice", pay.invoiceId, "payment_removed");

  refresh(pay.invoiceId);
  return { ok: true };
}
