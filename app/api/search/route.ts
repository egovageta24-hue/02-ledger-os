import { and, desc, eq, ilike, or } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/db";
import { clients, invoices } from "@/db/schema";
import { getAuth } from "@/lib/auth";
import { escapeLike } from "@/lib/sql";

export async function GET(req: Request) {
  const auth = await getAuth();
  if (!auth?.org) return NextResponse.json({ clients: [], invoices: [] }, { status: 401 });

  const q = new URL(req.url).searchParams.get("q")?.trim().slice(0, 80) ?? "";
  const pattern = `%${escapeLike(q)}%`;
  const orgId = auth.org.id;

  const [clientRows, invoiceRows] = await Promise.all([
    db
      .select({ id: clients.id, name: clients.name, company: clients.company })
      .from(clients)
      .where(and(eq(clients.orgId, orgId), q ? or(ilike(clients.name, pattern), ilike(clients.company, pattern), ilike(clients.email, pattern)) : undefined))
      .orderBy(clients.name)
      .limit(5),
    db
      .select({ id: invoices.id, number: invoices.number, clientName: clients.name })
      .from(invoices)
      .innerJoin(clients, eq(clients.id, invoices.clientId))
      .where(and(eq(invoices.orgId, orgId), q ? or(ilike(invoices.number, pattern), ilike(clients.name, pattern)) : undefined))
      .orderBy(desc(invoices.createdAt))
      .limit(5),
  ]);

  return NextResponse.json({ clients: clientRows, invoices: invoiceRows });
}
