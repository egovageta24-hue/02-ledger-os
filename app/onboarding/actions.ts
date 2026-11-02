"use server";

import { nanoid } from "nanoid";
import { redirect } from "next/navigation";
import { db, runBatch, type Statement } from "@/db";
import { activityLogs, categories, memberships, organizations, taxSettings } from "@/db/schema";
import { fail, fieldErrorsFrom, type ActionResult } from "@/lib/action-result";
import { getAuth, startSession } from "@/lib/auth";
import { DEFAULT_CATEGORIES } from "@/lib/defaults";
import { onboardingSchema, type OnboardingInput } from "@/lib/validation";

export async function createWorkspaceAction(input: OnboardingInput): Promise<ActionResult> {
  const auth = await getAuth();
  if (!auth) redirect("/login");
  if (auth.org) redirect("/dashboard");

  const parsed = onboardingSchema.safeParse(input);
  if (!parsed.success) return fail("Please fix the highlighted fields.", fieldErrorsFrom(parsed.error));
  const v = parsed.data;

  const orgId = nanoid(12);
  const statements: Statement[] = [
    db.insert(organizations).values({
      id: orgId,
      name: v.name,
      currency: v.currency,
      invoicePrefix: v.invoicePrefix,
      defaultPaymentTermsDays: v.paymentTermsDays,
    }),
    db.insert(memberships).values({ userId: auth.user.id, orgId, role: "owner" }),
    db.insert(categories).values(DEFAULT_CATEGORIES.map((c) => ({ orgId, name: c.name, color: c.color }))),
    db.insert(activityLogs).values({
      orgId,
      userId: auth.user.id,
      entityType: "organization",
      entityId: orgId,
      action: "created",
      meta: { name: v.name },
    }),
  ];
  if (v.taxName && v.taxRate > 0) {
    statements.push(db.insert(taxSettings).values({ orgId, name: v.taxName, rateBps: v.taxRate, isDefault: true }));
  }
  await runBatch(statements);

  await startSession(auth.user.id, orgId);
  redirect("/dashboard");
}
