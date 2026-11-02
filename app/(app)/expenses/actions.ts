"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { categories, expenses } from "@/db/schema";
import { fail, fieldErrorsFrom, type ActionResult } from "@/lib/action-result";
import { logActivity, requireAuth, type AuthContext } from "@/lib/auth";
import { expenseSchema, type ExpenseInput } from "@/lib/validation";

function refresh() {
  revalidatePath("/expenses");
  revalidatePath("/dashboard");
  revalidatePath("/reports");
}

async function categoryOk(ctx: AuthContext, categoryId: string | null) {
  if (!categoryId) return true;
  const [c] = await db
    .select({ id: categories.id })
    .from(categories)
    .where(and(eq(categories.id, categoryId), eq(categories.orgId, ctx.org.id)))
    .limit(1);
  return !!c;
}

export async function createExpenseAction(input: ExpenseInput): Promise<ActionResult> {
  const ctx = await requireAuth();
  const parsed = expenseSchema.safeParse(input);
  if (!parsed.success) return fail("Please fix the highlighted fields.", fieldErrorsFrom(parsed.error));
  const v = parsed.data;
  if (!(await categoryOk(ctx, v.categoryId))) return fail("Choose a valid category.", { categoryId: "Choose a valid category" });

  const [row] = await db
    .insert(expenses)
    .values({
      orgId: ctx.org.id,
      vendor: v.vendor,
      description: v.description,
      amountCents: v.amount,
      date: v.date,
      categoryId: v.categoryId,
    })
    .returning({ id: expenses.id });
  await logActivity(ctx, "expense", row.id, "created", { vendor: v.vendor, amountCents: v.amount });
  refresh();
  return { ok: true };
}

export async function updateExpenseAction(id: string, input: ExpenseInput): Promise<ActionResult> {
  const ctx = await requireAuth();
  const parsed = expenseSchema.safeParse(input);
  if (!parsed.success) return fail("Please fix the highlighted fields.", fieldErrorsFrom(parsed.error));
  const v = parsed.data;
  if (!(await categoryOk(ctx, v.categoryId))) return fail("Choose a valid category.", { categoryId: "Choose a valid category" });

  const [row] = await db
    .update(expenses)
    .set({ vendor: v.vendor, description: v.description, amountCents: v.amount, date: v.date, categoryId: v.categoryId })
    .where(and(eq(expenses.id, id), eq(expenses.orgId, ctx.org.id)))
    .returning({ id: expenses.id });
  if (!row) return fail("Expense not found.");
  await logActivity(ctx, "expense", id, "updated");
  refresh();
  return { ok: true };
}

export async function deleteExpenseAction(id: string): Promise<ActionResult> {
  const ctx = await requireAuth();
  const [row] = await db
    .delete(expenses)
    .where(and(eq(expenses.id, id), eq(expenses.orgId, ctx.org.id)))
    .returning({ id: expenses.id });
  if (!row) return fail("Expense not found.");
  await logActivity(ctx, "expense", id, "deleted");
  refresh();
  return { ok: true };
}
