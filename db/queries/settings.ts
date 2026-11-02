import "server-only";
import { asc, desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { categories, memberships, taxSettings, users } from "@/db/schema";

export function listTaxes(orgId: string) {
  return db
    .select()
    .from(taxSettings)
    .where(eq(taxSettings.orgId, orgId))
    .orderBy(desc(taxSettings.isDefault), asc(taxSettings.name));
}

export function listCategories(orgId: string) {
  return db.select().from(categories).where(eq(categories.orgId, orgId)).orderBy(asc(categories.name));
}

export function listMembers(orgId: string) {
  return db
    .select({ membershipId: memberships.id, userId: users.id, name: users.name, email: users.email, role: memberships.role })
    .from(memberships)
    .innerJoin(users, eq(users.id, memberships.userId))
    .where(eq(memberships.orgId, orgId))
    .orderBy(asc(memberships.createdAt));
}
