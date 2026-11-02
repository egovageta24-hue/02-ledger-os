"use server";

import { and, count, eq, ne } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db, runBatch } from "@/db";
import { categories, memberships, organizations, taxSettings, users } from "@/db/schema";
import { fail, fieldErrorsFrom, type ActionResult } from "@/lib/action-result";
import { hashPassword, requireAuth, requireOwner } from "@/lib/auth";
import {
  categorySchema,
  inviteSchema,
  invoiceDefaultsSchema,
  profileSchema,
  taxSchema,
  workspaceSchema,
  type CategoryInput,
  type InviteInput,
  type InvoiceDefaultsInput,
  type ProfileInput,
  type TaxInput,
  type WorkspaceInput,
} from "@/lib/validation";

const refresh = () => revalidatePath("/settings", "layout");

const invalid = (e: Parameters<typeof fieldErrorsFrom>[0]) => fail("Please fix the highlighted fields.", fieldErrorsFrom(e));

/* ---- workspace (owner) ---- */

export async function updateWorkspaceAction(input: WorkspaceInput): Promise<ActionResult> {
  const ctx = await requireOwner();
  const parsed = workspaceSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  await db.update(organizations).set(parsed.data).where(eq(organizations.id, ctx.org.id));
  refresh();
  revalidatePath("/", "layout");
  return { ok: true };
}

/* ---- invoice defaults ---- */

export async function updateInvoiceDefaultsAction(input: InvoiceDefaultsInput): Promise<ActionResult> {
  const ctx = await requireAuth();
  const parsed = invoiceDefaultsSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  await db
    .update(organizations)
    .set({
      invoicePrefix: parsed.data.invoicePrefix,
      defaultPaymentTermsDays: parsed.data.paymentTermsDays,
      defaultNotes: parsed.data.defaultNotes,
      defaultTerms: parsed.data.defaultTerms,
    })
    .where(eq(organizations.id, ctx.org.id));
  refresh();
  return { ok: true };
}

/* ---- taxes ---- */

export async function saveTaxAction(id: string | null, input: TaxInput): Promise<ActionResult> {
  const ctx = await requireAuth();
  const parsed = taxSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  const v = parsed.data;

  const unsetOthers = v.isDefault
    ? [db.update(taxSettings).set({ isDefault: false }).where(eq(taxSettings.orgId, ctx.org.id))]
    : [];

  if (id) {
    const [own] = await db.select({ id: taxSettings.id }).from(taxSettings).where(and(eq(taxSettings.id, id), eq(taxSettings.orgId, ctx.org.id))).limit(1);
    if (!own) return fail("Tax rate not found.");
    await runBatch([
      ...unsetOthers,
      db.update(taxSettings).set({ name: v.name, rateBps: v.rate, isDefault: v.isDefault }).where(and(eq(taxSettings.id, id), eq(taxSettings.orgId, ctx.org.id))),
    ]);
  } else {
    await runBatch([...unsetOthers, db.insert(taxSettings).values({ orgId: ctx.org.id, name: v.name, rateBps: v.rate, isDefault: v.isDefault })]);
  }
  refresh();
  return { ok: true };
}

export async function deleteTaxAction(id: string): Promise<ActionResult> {
  const ctx = await requireAuth();
  const [row] = await db.delete(taxSettings).where(and(eq(taxSettings.id, id), eq(taxSettings.orgId, ctx.org.id))).returning({ id: taxSettings.id });
  if (!row) return fail("Tax rate not found.");
  refresh();
  return { ok: true };
}

/* ---- categories ---- */

export async function saveCategoryAction(id: string | null, input: CategoryInput): Promise<ActionResult> {
  const ctx = await requireAuth();
  const parsed = categorySchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);

  const [dup] = await db
    .select({ id: categories.id })
    .from(categories)
    .where(and(eq(categories.orgId, ctx.org.id), eq(categories.name, parsed.data.name), id ? ne(categories.id, id) : undefined))
    .limit(1);
  if (dup) return fail("That category already exists.", { name: "A category with this name already exists" });

  if (id) {
    const [row] = await db
      .update(categories)
      .set(parsed.data)
      .where(and(eq(categories.id, id), eq(categories.orgId, ctx.org.id)))
      .returning({ id: categories.id });
    if (!row) return fail("Category not found.");
  } else {
    await db.insert(categories).values({ ...parsed.data, orgId: ctx.org.id });
  }
  refresh();
  revalidatePath("/expenses");
  return { ok: true };
}

/** Expenses in a deleted category become uncategorized (FK is ON DELETE SET NULL). */
export async function deleteCategoryAction(id: string): Promise<ActionResult> {
  const ctx = await requireAuth();
  const [row] = await db.delete(categories).where(and(eq(categories.id, id), eq(categories.orgId, ctx.org.id))).returning({ id: categories.id });
  if (!row) return fail("Category not found.");
  refresh();
  revalidatePath("/expenses");
  revalidatePath("/reports");
  return { ok: true };
}

/* ---- team (owner) ---- */

async function ownerCount(orgId: string) {
  const [{ n }] = await db.select({ n: count() }).from(memberships).where(and(eq(memberships.orgId, orgId), eq(memberships.role, "owner")));
  return n;
}

export async function addMemberAction(input: InviteInput): Promise<ActionResult> {
  const ctx = await requireOwner();
  const parsed = inviteSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  const v = parsed.data;
  const email = v.email.toLowerCase();

  let [user] = await db.select().from(users).where(eq(users.email, email)).limit(1);
  if (user) {
    const [already] = await db
      .select({ id: memberships.id })
      .from(memberships)
      .where(and(eq(memberships.userId, user.id), eq(memberships.orgId, ctx.org.id)))
      .limit(1);
    if (already) return fail("That person is already on the team.", { email: "Already a member of this workspace" });
  } else {
    [user] = await db.insert(users).values({ email, name: v.name, passwordHash: await hashPassword(v.password) }).returning();
  }
  await db.insert(memberships).values({ userId: user.id, orgId: ctx.org.id, role: v.role });
  refresh();
  return { ok: true };
}

export async function updateMemberRoleAction(membershipId: string, role: "owner" | "admin"): Promise<ActionResult> {
  const ctx = await requireOwner();
  const [m] = await db
    .select()
    .from(memberships)
    .where(and(eq(memberships.id, membershipId), eq(memberships.orgId, ctx.org.id)))
    .limit(1);
  if (!m) return fail("Member not found.");
  if (m.role === "owner" && role !== "owner" && (await ownerCount(ctx.org.id)) <= 1) {
    return fail("A workspace needs at least one owner.");
  }
  await db.update(memberships).set({ role }).where(eq(memberships.id, membershipId));
  refresh();
  return { ok: true };
}

export async function removeMemberAction(membershipId: string): Promise<ActionResult> {
  const ctx = await requireOwner();
  const [m] = await db
    .select()
    .from(memberships)
    .where(and(eq(memberships.id, membershipId), eq(memberships.orgId, ctx.org.id)))
    .limit(1);
  if (!m) return fail("Member not found.");
  if (m.userId === ctx.user.id) return fail("You can't remove yourself.");
  if (m.role === "owner" && (await ownerCount(ctx.org.id)) <= 1) return fail("A workspace needs at least one owner.");
  await db.delete(memberships).where(eq(memberships.id, membershipId));
  refresh();
  return { ok: true };
}

/* ---- profile ---- */

export async function updateProfileAction(input: ProfileInput): Promise<ActionResult> {
  const ctx = await requireAuth();
  const parsed = profileSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  await db.update(users).set({ name: parsed.data.name }).where(eq(users.id, ctx.user.id));
  revalidatePath("/", "layout");
  return { ok: true };
}
