import "server-only";
import bcrypt from "bcryptjs";
import { and, eq } from "drizzle-orm";
import { cookies } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { cache } from "react";
import { db } from "@/db";
import {
  activityLogs,
  memberships,
  organizations,
  users,
  type Organization,
  type Role,
  type User,
} from "@/db/schema";
import { cookieOptions, SESSION_COOKIE, signSession, verifySession } from "./session";

export async function hashPassword(password: string) {
  return bcrypt.hash(password, 10);
}

export async function verifyPassword(password: string, hash: string) {
  return bcrypt.compare(password, hash);
}

export async function startSession(userId: string, orgId: string | null) {
  const jar = await cookies();
  jar.set(SESSION_COOKIE, await signSession({ uid: userId, oid: orgId }), cookieOptions);
}

export async function endSession() {
  const jar = await cookies();
  jar.delete(SESSION_COOKIE);
}

export type AuthContext = {
  user: User;
  org: Organization;
  role: Role;
};

/** Current user + active workspace, or null. Cached per request. */
export const getAuth = cache(async (): Promise<{ user: User; org: Organization | null; role: Role | null } | null> => {
  const jar = await cookies();
  const session = await verifySession(jar.get(SESSION_COOKIE)?.value);
  if (!session) return null;

  const [user] = await db.select().from(users).where(eq(users.id, session.uid)).limit(1);
  if (!user) return null;
  if (!session.oid) return { user, org: null, role: null };

  const [row] = await db
    .select({ org: organizations, role: memberships.role })
    .from(memberships)
    .innerJoin(organizations, eq(organizations.id, memberships.orgId))
    .where(and(eq(memberships.userId, user.id), eq(memberships.orgId, session.oid)))
    .limit(1);

  return row ? { user, org: row.org, role: row.role } : { user, org: null, role: null };
});

/** For pages/actions inside the app shell: must be signed in with a workspace. */
export async function requireAuth(): Promise<AuthContext> {
  const auth = await getAuth();
  if (!auth) redirect("/login");
  if (!auth.org || !auth.role) redirect("/onboarding");
  return { user: auth.user, org: auth.org, role: auth.role };
}

/** Owner-only areas (team, workspace deletion). Admins get a 404-style block. */
export async function requireOwner(): Promise<AuthContext> {
  const ctx = await requireAuth();
  if (ctx.role !== "owner") notFound();
  return ctx;
}

export async function logActivity(
  ctx: { org: { id: string }; user: { id: string } },
  entityType: string,
  entityId: string,
  action: string,
  meta?: Record<string, unknown>,
) {
  await db.insert(activityLogs).values({
    orgId: ctx.org.id,
    userId: ctx.user.id,
    entityType,
    entityId,
    action,
    meta: meta ?? null,
  });
}
