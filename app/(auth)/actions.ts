"use server";

import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { db } from "@/db";
import { memberships, users } from "@/db/schema";
import { fail, fieldErrorsFrom, type ActionResult } from "@/lib/action-result";
import { endSession, hashPassword, startSession, verifyPassword } from "@/lib/auth";
import { loginSchema, signupSchema, type LoginInput, type SignupInput } from "@/lib/validation";

function safeNext(next: string | undefined): string | null {
  return next && next.startsWith("/") && !next.startsWith("//") ? next : null;
}

export async function signupAction(input: SignupInput): Promise<ActionResult> {
  const parsed = signupSchema.safeParse(input);
  if (!parsed.success) return fail("Please fix the highlighted fields.", fieldErrorsFrom(parsed.error));

  const email = parsed.data.email.toLowerCase();
  const [existing] = await db.select({ id: users.id }).from(users).where(eq(users.email, email)).limit(1);
  if (existing) return fail("That email is already registered.", { email: "An account with this email already exists" });

  const [user] = await db
    .insert(users)
    .values({ email, name: parsed.data.name, passwordHash: await hashPassword(parsed.data.password) })
    .returning({ id: users.id });

  await startSession(user.id, null);
  redirect("/onboarding");
}

export async function loginAction(input: LoginInput, next?: string): Promise<ActionResult> {
  const parsed = loginSchema.safeParse(input);
  if (!parsed.success) return fail("Please fix the highlighted fields.", fieldErrorsFrom(parsed.error));

  const [user] = await db.select().from(users).where(eq(users.email, parsed.data.email.toLowerCase())).limit(1);
  // Same message for unknown email and wrong password.
  if (!user || !(await verifyPassword(parsed.data.password, user.passwordHash))) {
    return fail("Incorrect email or password.");
  }

  const [membership] = await db
    .select({ orgId: memberships.orgId })
    .from(memberships)
    .where(eq(memberships.userId, user.id))
    .limit(1);

  await startSession(user.id, membership?.orgId ?? null);
  redirect(membership ? (safeNext(next) ?? "/dashboard") : "/onboarding");
}

export async function logoutAction() {
  await endSession();
  redirect("/login");
}
