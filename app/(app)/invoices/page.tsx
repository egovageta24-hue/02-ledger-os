import { FileText, Plus } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { EmptyState } from "@/components/app/empty-state";
import { InvoiceTable } from "@/components/app/invoice-table";
import { PageHeader } from "@/components/app/page-header";
import { buttonVariants } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import { listClientOptions } from "@/db/queries/clients";
import { invoiceStatusCounts, listInvoices, STATUS_FILTERS, type StatusFilter } from "@/db/queries/invoices";
import { requireAuth } from "@/lib/auth";
import { InvoiceFilters } from "./_components/invoice-filters";

export const metadata: Metadata = { title: "Invoices" };

const str = (v: string | string[] | undefined) => (typeof v === "string" ? v : undefined);
const isDate = (v?: string) => (v && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : undefined);

export default async function InvoicesPage({ searchParams }: PageProps<"/invoices">) {
  const { org } = await requireAuth();
  const sp = await searchParams;

  const status = (STATUS_FILTERS as readonly string[]).includes(str(sp.status) ?? "") ? (str(sp.status) as StatusFilter) : "all";
  const page = Math.max(1, Number.parseInt(str(sp.page) ?? "1", 10) || 1);
  const filters = {
    q: str(sp.q)?.slice(0, 80),
    status,
    clientId: str(sp.client),
    from: isDate(str(sp.from)),
    to: isDate(str(sp.to)),
    page,
  };

  const [{ rows, total, pageCount, pageSize }, counts, clients] = await Promise.all([
    listInvoices(org.id, filters),
    invoiceStatusCounts(org.id),
    listClientOptions(org.id),
  ]);

  const filtered = !!(filters.q || filters.clientId || filters.from || filters.to || status !== "all");
  const href = (p: number) => {
    const next = new URLSearchParams();
    for (const [k, v] of Object.entries(sp)) if (typeof v === "string" && k !== "page") next.set(k, v);
    if (p > 1) next.set("page", String(p));
    return `/invoices${next.size ? `?${next}` : ""}`;
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Invoices"
        description="Create, send and track every invoice in one place."
        actions={
          <Link href="/invoices/new" className={buttonVariants()}>
            <Plus /> New invoice
          </Link>
        }
      />

      <InvoiceFilters counts={counts} clients={clients} />

      <Card className="overflow-hidden py-0">
        {rows.length === 0 ? (
          <EmptyState
            icon={<FileText />}
            title={filtered ? "No invoices match these filters" : "Create your first invoice"}
            description={
              filtered
                ? "Try removing a filter or searching for something else."
                : "Add line items, set a due date and send a professional invoice in a minute."
            }
            action={
              !filtered ? (
                <Link href="/invoices/new" className={buttonVariants()}>
                  <Plus /> New invoice
                </Link>
              ) : undefined
            }
          />
        ) : (
          <InvoiceTable rows={rows} currency={org.currency} />
        )}
      </Card>

      {pageCount > 1 && (
        <div className="flex flex-col items-center justify-between gap-3 sm:flex-row">
          <p className="text-sm text-muted-foreground">
            Showing {(page - 1) * pageSize + 1}–{Math.min(page * pageSize, total)} of {total}
          </p>
          <Pagination className="mx-0 w-auto">
            <PaginationContent>
              <PaginationItem>
                <PaginationPrevious href={href(Math.max(1, page - 1))} aria-disabled={page === 1} />
              </PaginationItem>
              {Array.from({ length: pageCount }, (_, i) => i + 1)
                .filter((p) => p === 1 || p === pageCount || Math.abs(p - page) <= 1)
                .map((p) => (
                  <PaginationItem key={p}>
                    <PaginationLink href={href(p)} isActive={p === page}>
                      {p}
                    </PaginationLink>
                  </PaginationItem>
                ))}
              <PaginationItem>
                <PaginationNext href={href(Math.min(pageCount, page + 1))} aria-disabled={page === pageCount} />
              </PaginationItem>
            </PaginationContent>
          </Pagination>
        </div>
      )}
    </div>
  );
}
