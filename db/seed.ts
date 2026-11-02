/**
 * Demo data: `npm run db:seed` (needs DATABASE_URL in .env.local and migrations applied).
 * Login: demo@ledgeros.dev / demo12345
 */
import bcrypt from "bcryptjs";
import { addDays, format, subDays } from "date-fns";
import { eq } from "drizzle-orm";
import { nanoid } from "nanoid";
import { db } from "./index";
import { activityLogs, categories, clients, expenses, invoiceItems, invoices, memberships, organizations, payments, taxSettings, users } from "./schema";
import { DEFAULT_CATEGORIES } from "../lib/defaults";
import { statusAfterPayment } from "../lib/invoice-status";
import { calcInvoiceTotals } from "../lib/money";

for (const file of [".env.local", ".env"]) {
  try {
    process.loadEnvFile(file);
  } catch {
    // file missing: try the next one / ambient environment
  }
}

const EMAIL = "demo@ledgeros.dev";
const iso = (d: Date) => format(d, "yyyy-MM-dd");

// Deterministic pseudo-random so reseeding gives the same demo.
let seed = 42;
const rnd = () => ((seed = (seed * 1664525 + 1013904223) % 4294967296) / 4294967296);
const pick = <T,>(xs: readonly T[]) => xs[Math.floor(rnd() * xs.length)];
const between = (a: number, b: number) => Math.floor(a + rnd() * (b - a + 1));

async function main() {
  const [existing] = await db.select({ id: users.id }).from(users).where(eq(users.email, EMAIL)).limit(1);
  if (existing) {
    console.log(`Demo user ${EMAIL} already exists — nothing to do.`);
    return;
  }

  const userId = nanoid(12);
  const orgId = nanoid(12);
  const today = new Date();

  await db.insert(users).values({ id: userId, email: EMAIL, name: "Alex Morgan", passwordHash: await bcrypt.hash("demo12345", 10) });
  await db.insert(organizations).values({
    id: orgId,
    name: "Northwind Studio",
    currency: "USD",
    email: "billing@northwind.studio",
    phone: "+1 555 0100",
    address: "200 Market Street\nSan Francisco, CA 94105",
    invoicePrefix: "INV-",
    defaultPaymentTermsDays: 14,
    defaultNotes: "Thank you for your business.",
    defaultTerms: "Payment due within 14 days. Bank transfer preferred.",
  });
  await db.insert(memberships).values({ userId, orgId, role: "owner" });
  await db.insert(taxSettings).values([
    { orgId, name: "Sales tax", rateBps: 825, isDefault: true },
    { orgId, name: "Zero-rated", rateBps: 0, isDefault: false },
  ]);

  const cats = await db
    .insert(categories)
    .values(DEFAULT_CATEGORIES.map((c) => ({ orgId, name: c.name, color: c.color })))
    .returning();

  const clientRows = await db
    .insert(clients)
    .values([
      { orgId, name: "Jane Cooper", company: "Acme Inc.", email: "jane@acme.example", phone: "+1 555 0111", address: "1 Acme Way\nAustin, TX" },
      { orgId, name: "Devon Lane", company: "Globex Corp", email: "devon@globex.example", phone: "+1 555 0112" },
      { orgId, name: "Courtney Henry", company: "Initech", email: "courtney@initech.example" },
      { orgId, name: "Marvin McKinney", company: "Umbrella Studio", email: "marvin@umbrella.example" },
      { orgId, name: "Kristin Watson", company: "Hooli", email: "kristin@hooli.example" },
      { orgId, name: "Leslie Alexander", company: "Stark & Co", email: "leslie@stark.example" },
      { orgId, name: "Ronald Richards", company: "Wayne Labs", email: "ronald@wayne.example" },
      { orgId, name: "Savannah Nguyen", company: "Pied Piper", email: "savannah@piper.example" },
    ])
    .returning();

  const SERVICES = [
    ["Brand strategy workshop", 80000],
    ["Website design — per page", 45000],
    ["Front-end development (hours)", 12500],
    ["Monthly retainer", 250000],
    ["UX research session", 60000],
    ["Copywriting (hours)", 9000],
    ["Hosting & maintenance", 15000],
    ["Content migration", 30000],
  ] as const;

  // Older invoices are mostly paid; recent ones are open; a few are overdue; the last two are drafts.
  type Plan = "paid" | "partial" | "sent" | "viewed" | "overdue" | "draft";

  const invoiceStmts: (typeof invoices.$inferInsert)[] = [];
  const itemStmts: (typeof invoiceItems.$inferInsert)[] = [];
  const paymentStmts: (typeof payments.$inferInsert)[] = [];
  const logStmts: (typeof activityLogs.$inferInsert)[] = [];

  const COUNT = 26;
  for (let n = 1; n <= COUNT; n++) {
    const daysAgo = Math.round(165 - ((n - 1) / (COUNT - 1)) * 160); // 165 -> 5 days ago
    const issue = subDays(today, daysAgo);
    const terms = pick([14, 14, 30]);
    const due = addDays(issue, terms);
    const overduePossible = due < today;

    let plan: Plan;
    if (n > COUNT - 2) plan = "draft";
    else if (daysAgo > 60) plan = rnd() < 0.85 ? "paid" : "overdue";
    else if (daysAgo > 25) plan = pick<Plan>(["paid", "partial", "overdue", "overdue", "viewed"]);
    else plan = pick<Plan>(["sent", "viewed", "partial", "paid", "sent"]);
    if (plan === "overdue" && !overduePossible) plan = "sent";

    const lineCount = between(1, 4);
    const lines = Array.from({ length: lineCount }, () => {
      const [description, rate] = pick(SERVICES);
      const quantity = rate < 20000 ? between(2, 40) * 100 : between(1, 3) * 100;
      return { description, quantity, rateCents: rate };
    });
    const taxRateBps = rnd() < 0.8 ? 825 : 0;
    const discountType = "percent" as const;
    const discountValue = rnd() < 0.25 ? pick([500, 1000]) : 0;
    const t = calcInvoiceTotals({ items: lines, discountType, discountValue, taxRateBps });

    const id = nanoid(12);
    const client = pick(clientRows);
    const number = `INV-${String(n).padStart(4, "0")}`;

    let paid = 0;
    if (plan === "paid") paid = t.totalCents;
    else if (plan === "partial") paid = Math.round((t.totalCents * between(30, 70)) / 100);
    else if (plan === "overdue" && rnd() < 0.3) paid = Math.round((t.totalCents * 40) / 100);

    const sentAt = plan === "draft" ? null : addDays(issue, 0);
    const viewedAt = plan === "draft" || plan === "sent" ? null : addDays(issue, 1);
    const status = statusAfterPayment(plan === "draft" ? "draft" : "sent", t.totalCents, paid, viewedAt);

    invoiceStmts.push({
      id,
      orgId,
      clientId: client.id,
      number,
      status,
      issueDate: iso(issue),
      dueDate: iso(due),
      discountType,
      discountValue,
      taxName: taxRateBps ? "Sales tax" : null,
      taxRateBps,
      notes: "Thank you for your business.",
      terms: `Payment due within ${terms} days.`,
      subtotalCents: t.subtotalCents,
      discountCents: t.discountCents,
      taxCents: t.taxCents,
      totalCents: t.totalCents,
      paidCents: paid,
      sentAt,
      viewedAt,
      createdAt: issue,
    });
    lines.forEach((l, i) =>
      itemStmts.push({ invoiceId: id, position: i, description: l.description, quantity: l.quantity, rateCents: l.rateCents, amountCents: t.lineAmounts[i] }),
    );
    logStmts.push({ orgId, userId, entityType: "invoice", entityId: id, action: plan === "draft" ? "created" : "sent", meta: { number, totalCents: t.totalCents }, createdAt: issue });

    if (paid > 0) {
      // Split fully-paid invoices into two payments now and then.
      const splits = plan === "paid" && rnd() < 0.3 ? 2 : 1;
      let remaining = paid;
      for (let s = 0; s < splits; s++) {
        const amount = s === splits - 1 ? remaining : Math.round(remaining / 2);
        remaining -= amount;
        const paidOn = addDays(issue, between(3, Math.max(4, terms + 5)) + s * 7);
        paymentStmts.push({
          orgId,
          invoiceId: id,
          amountCents: amount,
          paidAt: iso(paidOn > today ? today : paidOn),
          method: pick(["bank_transfer", "card", "bank_transfer", "check"] as const),
          reference: rnd() < 0.5 ? `TX-${between(10000, 99999)}` : null,
          createdAt: paidOn > today ? today : paidOn,
        });
      }
      logStmts.push({ orgId, userId, entityType: "invoice", entityId: id, action: "payment_recorded", meta: { number, amountCents: paid }, createdAt: addDays(issue, 6) > today ? today : addDays(issue, 6) });
    }
    if (viewedAt) logStmts.push({ orgId, userId: null, entityType: "invoice", entityId: id, action: "viewed", meta: { number }, createdAt: viewedAt });
  }

  const VENDORS: [string, string, number, number][] = [
    ["Figma", "Software & subscriptions", 1500, 4500],
    ["Vercel", "Software & subscriptions", 2000, 6000],
    ["Notion", "Software & subscriptions", 1000, 2500],
    ["Upwork contractor", "Contractors", 40000, 160000],
    ["Google Ads", "Marketing", 15000, 90000],
    ["Apple", "Office & equipment", 9000, 220000],
    ["Delta Airlines", "Travel", 25000, 70000],
    ["Blue Bottle Coffee", "Meals", 1200, 8500],
    ["Smith & Co. Accounting", "Professional fees", 30000, 90000],
  ];
  const expenseStmts: (typeof expenses.$inferInsert)[] = Array.from({ length: 48 }, () => {
    const [vendor, catName, lo, hi] = pick(VENDORS);
    const date = subDays(today, between(0, 170));
    return {
      orgId,
      vendor,
      categoryId: cats.find((c) => c.name === catName)?.id ?? null,
      amountCents: between(lo, hi),
      date: iso(date),
      createdAt: date,
    };
  });

  await db.insert(invoices).values(invoiceStmts);
  await db.insert(invoiceItems).values(itemStmts);
  if (paymentStmts.length) await db.insert(payments).values(paymentStmts);
  await db.insert(expenses).values(expenseStmts);
  await db.insert(activityLogs).values(logStmts);
  await db.update(organizations).set({ nextInvoiceNumber: COUNT + 1 }).where(eq(organizations.id, orgId));

  console.log(`Seeded Northwind Studio: ${clientRows.length} clients, ${COUNT} invoices, ${paymentStmts.length} payments, ${expenseStmts.length} expenses.`);
  console.log(`Log in with ${EMAIL} / demo12345`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
