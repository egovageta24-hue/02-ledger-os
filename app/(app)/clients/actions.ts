"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { clients } from "@/db/schema";
import { fail, fieldErrorsFrom, type ActionResult } from "@/lib/action-result";
import { logActivity, requireAuth } from "@/lib/auth";
import { clientSchema, type ClientInput } from "@/lib/validation";

type ClientRef = { client: { id: string; name: string; company: string | null } };

export async function createClientAction(input: ClientInput): Promise<ActionResult<ClientRef>> {
  const ctx = await requireAuth();
  const parsed = clientSchema.safeParse(input);
  if (!parsed.success) return fail("Please fix the highlighted fields.", fieldErrorsFrom(parsed.error));

  const [row] = await db
    .insert(clients)
    .values({ ...parsed.data, orgId: ctx.org.id })
    .returning({ id: clients.id, name: clients.name, company: clients.company });
  await logActivity(ctx, "client", row.id, "created", { name: row.name });

  revalidatePath("/clients");
  return { ok: true, client: row };
}

export async function updateClientAction(id: string, input: ClientInput): Promise<ActionResult<ClientRef>> {
  const ctx = await requireAuth();
  const parsed = clientSchema.safeParse(input);
  if (!parsed.success) return fail("Please fix the highlighted fields.", fieldErrorsFrom(parsed.error));

  const [row] = await db
    .update(clients)
    .set(parsed.data)
    .where(and(eq(clients.id, id), eq(clients.orgId, ctx.org.id)))
    .returning({ id: clients.id, name: clients.name, company: clients.company });
  if (!row) return fail("Client not found.");
  await logActivity(ctx, "client", id, "updated");

  revalidatePath("/clients");
  revalidatePath(`/clients/${id}`);
  return { ok: true, client: row };
}

export async function setClientArchivedAction(id: string, archived: boolean): Promise<ActionResult> {
  const ctx = await requireAuth();
  const [row] = await db
    .update(clients)
    .set({ archivedAt: archived ? new Date() : null })
    .where(and(eq(clients.id, id), eq(clients.orgId, ctx.org.id)))
    .returning({ id: clients.id });
  if (!row) return fail("Client not found.");
  await logActivity(ctx, "client", id, archived ? "archived" : "restored");

  revalidatePath("/clients");
  revalidatePath(`/clients/${id}`);
  return { ok: true };
}
