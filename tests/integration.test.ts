/**
 * Integration tests: the real server actions and queries run against an in-process Postgres (PGlite)
 * built from the real migration. Only the Neon driver, the session and Next's cache are stubbed.
 */
import { PGlite } from "@electric-sql/pglite";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { addDays, format, subDays } from "date-fns";
import { drizzle } from "drizzle-orm/pglite";
import { eq } from "drizzle-orm";
import { beforeAll, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({ db: null as unknown, ctx: null as unknown }));

vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ revalidatePath: () => {} }));
vi.mock("@/db", () => ({
  db: new Proxy({}, { get: (_t, p) => Reflect.get(h.db as object, p) }),
  // Neon's HTTP batch is atomic; sequential execution is equivalent for these tests.
  runBatch: async (stmts: PromiseLike<unknown>[]) => {
    for (const s of stmts) await s;
  },
}));
vi.mock("@/lib/auth", async () => {
  const { db } = await import("@/db");
  const { activityLogs } = await import("@/db/schema");
  return {
    requireAuth: async () => h.ctx,
    logActivity: async (ctx: { org: { id: string }; user: { id: string } }, entityType: string, entityId: string, action: string, meta?: Record<string, unknown>) => {
      await db.insert(activityLogs).values({ orgId: ctx.org.id, userId: ctx.user.id, entityType, entityId, action, meta: meta ?? null });
    },
  };
});

import * as schema from "@/db/schema";
import { createClientAction } from "@/app/(app)/clients/actions";
import { createExpenseAction } from "@/app/(app)/expenses/actions";
import { createInvoiceAction, deletePaymentAction, markInvoiceSentAction, recordPaymentAction, updateInvoiceAction } from "@/app/(app)/invoices/actions";
import { recordViewAction } from "@/app/i/[token]/actions";
import { listClients } from "@/db/queries/clients";
import { expensesByCategory, listExpenses } from "@/db/queries/expenses";
import { getInvoice, getInvoiceByToken, invoiceStatusCounts, listInvoices } from "@/db/queries/invoices";
import { lastMonths, monthlyCashflow, periodTotals, receivables, receivablesAging, rangeForMonths, revenueByClient } from "@/db/queries/reports";
import { listOverdueInvoices } from "@/db/queries/dashboard";

const iso = (d: Date) => format(d, "yyyy-MM-dd");
const today = new Date();

const line = (description: string, quantity: string, rate: string) => ({ description, quantity, rate });
const baseInvoice = (clientId: string, over: Record<string, unknown> = {}) => ({
  clientId,
  issueDate: iso(today),
  dueDate: iso(addDays(today, 14)),
  items: [line("Consulting", "10", "150.00"), line("Setup fee", "1", "250")],
  discountType: "percent" as const,
  discountValue: "10",
  taxName: "Sales tax",
  taxRate: "8.25",
  notes: "",
  terms: "",
  ...over,
});

let orgId = "";
let clientA = "";
let clientB = "";

beforeAll(async () => {
  const pg = new PGlite();
  const dir = path.resolve(__dirname, "../db/migrations");
  const file = readdirSync(dir).find((f) => f.endsWith(".sql"))!;
  for (const stmt of readFileSync(path.join(dir, file), "utf8").split("--> statement-breakpoint")) {
    if (stmt.trim()) await pg.exec(stmt);
  }
  const db = drizzle(pg, { schema });
  h.db = db;

  const [user] = await db.insert(schema.users).values({ email: "t@example.com", name: "Tester", passwordHash: "x" }).returning();
  const [org] = await db.insert(schema.organizations).values({ name: "Test Org", currency: "USD", invoicePrefix: "INV-" }).returning();
  orgId = org.id;
  h.ctx = { user, org, role: "owner" };

  const a = await createClientAction({ name: "Alpha Client", company: "Alpha Inc", email: "a@alpha.test" });
  const b = await createClientAction({ name: "Beta Client" });
  if (!a.ok || !b.ok) throw new Error("client setup failed");
  clientA = a.client.id;
  clientB = b.client.id;
});

describe("validation gates", () => {
  it("rejects missing / invalid values with field errors", async () => {
    const res = await createInvoiceAction(
      baseInvoice(clientA, { clientId: "", items: [line("", "abc", "-5")], dueDate: iso(subDays(today, 3)) }) as never,
      "draft",
    );
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.fieldErrors).toMatchObject({ clientId: expect.any(String), "items.0.description": expect.any(String), "items.0.quantity": expect.any(String), "items.0.rate": expect.any(String) });
    }
  });
  it("rejects an invoice with no line items", async () => {
    const res = await createInvoiceAction(baseInvoice(clientA, { items: [] }) as never, "draft");
    expect(res.ok).toBe(false);
  });
  it("rejects due date before issue date", async () => {
    const res = await createInvoiceAction(baseInvoice(clientA, { dueDate: iso(subDays(today, 1)) }) as never, "draft");
    expect(res).toMatchObject({ ok: false, fieldErrors: { dueDate: expect.any(String) } });
  });
  it("rejects a bad client email and a blank client name", async () => {
    expect(await createClientAction({ name: "", email: "nope" })).toMatchObject({ ok: false, fieldErrors: { name: expect.any(String), email: expect.any(String) } });
  });
  it("does not accept a client from another workspace", async () => {
    const res = await createInvoiceAction(baseInvoice("someone-elses-client") as never, "draft");
    expect(res.ok).toBe(false);
  });
});

describe("invoice lifecycle", () => {
  let id = "";

  it("creates an invoice with server-authoritative totals and sequential number", async () => {
    const res = await createInvoiceAction(baseInvoice(clientA) as never, "send");
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    id = res.id;
    const inv = await getInvoice(orgId, id);
    expect(inv).toMatchObject({
      number: "INV-0001",
      status: "sent",
      subtotalCents: 175000,
      discountCents: 17500,
      taxCents: 12994,
      totalCents: 170494,
      paidCents: 0,
    });
    expect(inv!.items.map((i) => i.amountCents)).toEqual([150000, 25000]);
    expect(inv!.effective).toBe("sent");
  });

  it("takes the next number for the next invoice", async () => {
    const res = await createInvoiceAction(baseInvoice(clientB, { items: [line("x", "1", "10")], discountValue: "", taxRate: "" }) as never, "draft");
    expect(res.ok).toBe(true);
    if (res.ok) expect((await getInvoice(orgId, res.id))!.number).toBe("INV-0002");
  });

  it("records a partial payment -> partially_paid, then rejects overpayment", async () => {
    expect((await recordPaymentAction(id, { amount: "500.00", paidAt: iso(today), method: "card", reference: "" })).ok).toBe(true);
    expect(await getInvoice(orgId, id)).toMatchObject({ status: "partially_paid", paidCents: 50000 });

    const over = await recordPaymentAction(id, { amount: "99999", paidAt: iso(today), method: "card", reference: "" });
    expect(over).toMatchObject({ ok: false, fieldErrors: { amount: expect.stringContaining("remaining balance") } });
    expect((await getInvoice(orgId, id))!.paidCents).toBe(50000);

    const bad = await recordPaymentAction(id, { amount: "", paidAt: "", method: "card", reference: "" });
    expect(bad.ok).toBe(false);
  });

  it("locks editing once a payment exists", async () => {
    const res = await updateInvoiceAction(id, baseInvoice(clientA) as never, "send");
    expect(res).toMatchObject({ ok: false });
  });

  it("pays in full -> paid; removing a payment steps the status back", async () => {
    expect((await recordPaymentAction(id, { amount: "1204.94", paidAt: iso(today), method: "bank_transfer", reference: "TX1" })).ok).toBe(true);
    const paidInv = (await getInvoice(orgId, id))!;
    expect(paidInv).toMatchObject({ status: "paid", paidCents: 170494, effective: "paid" });
    expect(await recordPaymentAction(id, { amount: "1", paidAt: iso(today), method: "cash", reference: "" })).toMatchObject({ ok: false });

    const last = paidInv.payments.find((p) => p.reference === "TX1")!;
    expect((await deletePaymentAction(last.id)).ok).toBe(true);
    expect(await getInvoice(orgId, id)).toMatchObject({ status: "partially_paid", paidCents: 50000 });
  });

  it("cannot record a payment on a draft, and drafts are not public", async () => {
    const d = await createInvoiceAction(baseInvoice(clientB) as never, "draft");
    if (!d.ok) throw new Error("setup");
    expect(await recordPaymentAction(d.id, { amount: "10", paidAt: iso(today), method: "cash", reference: "" })).toMatchObject({ ok: false });
    const inv = (await getInvoice(orgId, d.id))!;
    expect(await getInvoiceByToken(inv.shareToken)).toBeNull();
    expect((await markInvoiceSentAction(d.id)).ok).toBe(true);
    expect(await getInvoiceByToken(inv.shareToken)).not.toBeNull();
  });

  it("first public view moves sent -> viewed exactly once", async () => {
    const r = await createInvoiceAction(baseInvoice(clientA, { items: [line("v", "1", "100")] }) as never, "send");
    if (!r.ok) throw new Error("setup");
    const token = (await getInvoice(orgId, r.id))!.shareToken;
    await recordViewAction(token);
    await recordViewAction(token);
    const inv = (await getInvoice(orgId, r.id))!;
    expect(inv.status).toBe("viewed");
    expect(inv.viewedAt).not.toBeNull();
    const logs = await (h.db as ReturnType<typeof drizzle>).select().from(schema.activityLogs).where(eq(schema.activityLogs.entityId, r.id));
    expect(logs.filter((l) => l.action === "viewed")).toHaveLength(1);
  });
});

describe("overdue, filters and counts", () => {
  it("derives overdue from due date + balance, and lists/filter/counts agree", async () => {
    const past = await createInvoiceAction(
      baseInvoice(clientB, { issueDate: iso(subDays(today, 60)), dueDate: iso(subDays(today, 30)), items: [line("Old work", "1", "1000")], discountValue: "", taxRate: "" }) as never,
      "send",
    );
    if (!past.ok) throw new Error("setup");

    const counts = await invoiceStatusCounts(orgId);
    expect(counts.overdue).toBe(1);
    const filtered = await listInvoices(orgId, { status: "overdue" });
    expect(filtered.rows.map((r) => r.id)).toEqual([past.id]);
    expect(filtered.rows[0].effective).toBe("overdue");

    // Tabs don't overlap: overdue invoices are not also counted as "sent".
    const sentIds = (await listInvoices(orgId, { status: "sent" })).rows.map((r) => r.id);
    expect(sentIds).not.toContain(past.id);

    const sumTabs = counts.draft + counts.sent + counts.viewed + counts.partially_paid + counts.paid + counts.overdue;
    expect(sumTabs).toBe(counts.all);

    const od = await listOverdueInvoices(orgId);
    expect(od[0]).toMatchObject({ id: past.id, balanceCents: 100000 });

    const ar = await receivables(orgId);
    expect(ar.overdueCents).toBe(100000);
    expect(ar.overdueCount).toBe(1);

    const aging = await receivablesAging(orgId);
    // Exactly 30 days late belongs in the 1–30 bucket and nowhere else.
    expect(aging.find((a) => a.key === "1-30")!.cents).toBe(100000);
    expect(aging.find((a) => a.key === "31-60")!.cents).toBe(0);
    expect(aging.find((a) => a.key === "60+")!.cents).toBe(0);
    // The other open invoices are not yet due.
    expect(aging.find((a) => a.key === "current")!.cents).toBeGreaterThan(0);
  });

  it("searches by number and client, escapes LIKE wildcards", async () => {
    expect((await listInvoices(orgId, { q: "INV-0001" })).rows).toHaveLength(1);
    expect((await listInvoices(orgId, { q: "alpha" })).rows.length).toBeGreaterThan(0);
    expect((await listInvoices(orgId, { q: "%" })).rows).toHaveLength(0);
    expect((await listInvoices(orgId, { clientId: clientB })).rows.every((r) => r.clientId === clientB)).toBe(true);
  });
});

describe("expenses and reports reflect stored data", () => {
  it("records expenses, lists and aggregates them", async () => {
    const cat = await (h.db as ReturnType<typeof drizzle>).insert(schema.categories).values({ orgId, name: "Software", color: "#2563eb" }).returning();
    expect((await createExpenseAction({ vendor: "Figma", amount: "45.50", date: iso(today), categoryId: cat[0].id, description: "" })).ok).toBe(true);
    expect((await createExpenseAction({ vendor: "Misc", amount: "10", date: iso(today), categoryId: "" , description: "" })).ok).toBe(true);
    expect(await createExpenseAction({ vendor: "", amount: "0", date: "", categoryId: "" })).toMatchObject({ ok: false });

    const month = format(today, "yyyy-MM");
    const list = await listExpenses(orgId, { month });
    expect(list.count).toBe(2);
    expect(list.totalCents).toBe(5550);
    const cats = await expensesByCategory(orgId);
    expect(cats.find((c) => c.name === "Software")!.totalCents).toBe(4550);
    expect(cats.find((c) => c.name === "Uncategorized")!.totalCents).toBe(1000);
  });

  it("monthly cash flow, period totals and revenue by client match the ledger", async () => {
    const months = lastMonths(6);
    const series = await monthlyCashflow(orgId, months);
    const current = series[series.length - 1];
    expect(series).toHaveLength(6);
    expect(current.expensesCents).toBe(5550);
    expect(current.revenueCents).toBe(50000); // the one remaining $500 payment
    expect(current.netCents).toBe(44450);
    expect(series.slice(0, -1).every((m) => m.revenueCents === 0 && m.expensesCents === 0)).toBe(true);

    const totals = await periodTotals(orgId, rangeForMonths(months));
    expect(totals.collectedCents).toBe(50000);
    expect(totals.expensesCents).toBe(5550);
    expect(totals.netCents).toBe(44450);
    expect(totals.taxCents).toBeGreaterThan(0);

    const byClient = await revenueByClient(orgId, rangeForMonths(months));
    expect(byClient).toHaveLength(1);
    expect(byClient[0]).toMatchObject({ name: "Alpha Client", totalCents: 50000 });
  });

  it("client totals exclude drafts", async () => {
    const rows = await listClients(orgId);
    const alpha = rows.find((c) => c.id === clientA)!;
    // INV-0001 ($1,704.94) + the viewed invoice ($100 - 10% + 8.25% tax = $97.43); drafts excluded; $500 paid
    expect(alpha.billedCents).toBe(170494 + 9743);
    expect(alpha.paidCents).toBe(50000);
    const beta = rows.find((c) => c.id === clientB)!;
    expect(beta.invoiceCount).toBeGreaterThan(0);
  });
});
