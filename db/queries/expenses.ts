import "server-only";
import { and, desc, eq, gte, ilike, lt, or, sql } from "drizzle-orm";
import { db } from "@/db";
import { categories, expenses } from "@/db/schema";
import { escapeLike } from "@/lib/sql";

/** `YYYY-MM` -> [first day, first day of next month) as ISO dates. */
export function monthRange(month: string): { from: string; to: string } {
  const [y, m] = month.split("-").map(Number);
  const next = m === 12 ? `${y + 1}-01` : `${y}-${String(m + 1).padStart(2, "0")}`;
  return { from: `${month}-01`, to: `${next}-01` };
}

export type ExpenseFilters = { q?: string; categoryId?: string; month?: string; page?: number; pageSize?: number };

function whereFor(orgId: string, f: ExpenseFilters) {
  const range = f.month ? monthRange(f.month) : null;
  const pattern = f.q ? `%${escapeLike(f.q)}%` : null;
  return and(
    eq(expenses.orgId, orgId),
    range ? and(gte(expenses.date, range.from), lt(expenses.date, range.to)) : undefined,
    f.categoryId === "none" ? sql`${expenses.categoryId} is null` : f.categoryId ? eq(expenses.categoryId, f.categoryId) : undefined,
    pattern ? or(ilike(expenses.vendor, pattern), ilike(expenses.description, pattern)) : undefined,
  );
}

export async function listExpenses(orgId: string, f: ExpenseFilters = {}) {
  const pageSize = f.pageSize ?? 20;
  const page = Math.max(1, f.page ?? 1);
  const where = whereFor(orgId, f);

  const [rows, [agg]] = await Promise.all([
    db
      .select({
        id: expenses.id,
        vendor: expenses.vendor,
        description: expenses.description,
        amountCents: expenses.amountCents,
        date: expenses.date,
        categoryId: expenses.categoryId,
        categoryName: categories.name,
        categoryColor: categories.color,
      })
      .from(expenses)
      .leftJoin(categories, eq(categories.id, expenses.categoryId))
      .where(where)
      .orderBy(desc(expenses.date), desc(expenses.createdAt))
      .limit(pageSize)
      .offset((page - 1) * pageSize),
    db
      .select({ count: sql<number>`count(*)::int`, total: sql<number>`coalesce(sum(${expenses.amountCents}), 0)::int` })
      .from(expenses)
      .where(where),
  ]);

  return { rows, count: agg.count, totalCents: agg.total, page, pageSize, pageCount: Math.max(1, Math.ceil(agg.count / pageSize)) };
}

/** Spend per category for a period (ignores the category filter so the breakdown stays complete). */
export async function expensesByCategory(orgId: string, range?: { from: string; to: string }) {
  const rows = await db
    .select({
      categoryId: expenses.categoryId,
      name: sql<string>`coalesce(${categories.name}, 'Uncategorized')`,
      color: sql<string>`coalesce(${categories.color}, '#94a3b8')`,
      totalCents: sql<number>`sum(${expenses.amountCents})::int`,
    })
    .from(expenses)
    .leftJoin(categories, eq(categories.id, expenses.categoryId))
    .where(and(eq(expenses.orgId, orgId), range ? and(gte(expenses.date, range.from), lt(expenses.date, range.to)) : undefined))
    .groupBy(expenses.categoryId, categories.name, categories.color)
    .orderBy(desc(sql`sum(${expenses.amountCents})`));
  return rows;
}
