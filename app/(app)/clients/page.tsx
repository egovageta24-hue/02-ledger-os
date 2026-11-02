import { Plus, Users } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { ClientFormDialog } from "@/components/app/client-form-dialog";
import { EmptyState } from "@/components/app/empty-state";
import { Money } from "@/components/app/money";
import { PageHeader } from "@/components/app/page-header";
import { SearchInput } from "@/components/app/search-input";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { listClients } from "@/db/queries/clients";
import { requireAuth } from "@/lib/auth";

export const metadata: Metadata = { title: "Clients" };

export default async function ClientsPage({ searchParams }: PageProps<"/clients">) {
  const { org } = await requireAuth();
  const sp = await searchParams;
  const q = typeof sp.q === "string" ? sp.q : "";
  const archived = sp.archived === "1";
  const rows = await listClients(org.id, { q, archived });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Clients"
        description="Everyone you bill, with what they've been invoiced and still owe."
        actions={
          <ClientFormDialog
            trigger={
              <Button>
                <Plus /> New client
              </Button>
            }
          />
        }
      />

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <SearchInput placeholder="Search clients…" />
        <div className="flex gap-1 text-sm">
          <Link
            href="/clients"
            className={buttonVariants({ variant: archived ? "ghost" : "secondary", size: "sm" })}
          >
            Active
          </Link>
          <Link
            href="/clients?archived=1"
            className={buttonVariants({ variant: archived ? "secondary" : "ghost", size: "sm" })}
          >
            Archived
          </Link>
        </div>
      </div>

      <Card className="overflow-hidden py-0">
        {rows.length === 0 ? (
          <EmptyState
            icon={<Users />}
            title={q ? "No clients match your search" : archived ? "No archived clients" : "Add your first client"}
            description={
              q
                ? "Try a different name, company or email."
                : archived
                  ? "Archived clients are hidden from pickers but keep their invoice history."
                  : "Clients are who you invoice. Add one to start creating invoices."
            }
            action={
              !q && !archived ? (
                <ClientFormDialog
                  trigger={
                    <Button>
                      <Plus /> New client
                    </Button>
                  }
                />
              ) : undefined
            }
          />
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/40 hover:bg-muted/40">
                <TableHead className="pl-4">Client</TableHead>
                <TableHead className="hidden md:table-cell">Email</TableHead>
                <TableHead className="text-right">Invoices</TableHead>
                <TableHead className="text-right">Billed</TableHead>
                <TableHead className="pr-4 text-right">Outstanding</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((c) => {
                const outstanding = Math.max(0, c.billedCents - c.paidCents);
                return (
                  <TableRow key={c.id}>
                    <TableCell className="pl-4">
                      <Link href={`/clients/${c.id}`} className="font-medium hover:text-primary hover:underline">
                        {c.name}
                      </Link>
                      {c.company && <div className="text-xs text-muted-foreground">{c.company}</div>}
                    </TableCell>
                    <TableCell className="hidden text-muted-foreground md:table-cell">{c.email ?? "—"}</TableCell>
                    <TableCell className="tabular text-right">{c.invoiceCount}</TableCell>
                    <TableCell className="text-right">
                      <Money cents={c.billedCents} currency={org.currency} />
                    </TableCell>
                    <TableCell className="pr-4 text-right">
                      {outstanding > 0 ? (
                        <Money cents={outstanding} currency={org.currency} />
                      ) : (
                        <Badge variant="outline" className="border-transparent bg-success-soft text-success">
                          Settled
                        </Badge>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </Card>
    </div>
  );
}
