import { format, parseISO } from "date-fns";
import { Plus, Receipt } from "lucide-react";
import type { Metadata } from "next";
import { EmptyState } from "@/components/app/empty-state";
import { Money } from "@/components/app/money";
import { PageHeader } from "@/components/app/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { expensesByCategory, listExpenses, monthRange } from "@/db/queries/expenses";
import { listCategories } from "@/db/queries/settings";
import { requireAuth } from "@/lib/auth";
import { centsToInput } from "@/lib/money";
import { ExpenseFilters } from "./_components/expense-filters";
import { ExpenseFormDialog } from "./_components/expense-form-dialog";
import { ExpenseRowActions } from "./_components/expense-row-actions";

export const metadata: Metadata = { title: "Expenses" };

const str = (v: string | string[] | undefined) => (typeof v === "string" ? v : undefined);

export default async function ExpensesPage({ searchParams }: PageProps<"/expenses">) {
  const { org } = await requireAuth();
  const sp = await searchParams;

  const requested = str(sp.month);
  const month = requested === "all" ? "all" : requested && /^\d{4}-(0[1-9]|1[0-2])$/.test(requested) ? requested : format(new Date(), "yyyy-MM");
  const page = Math.max(1, Number.parseInt(str(sp.page) ?? "1", 10) || 1);
  const q = str(sp.q)?.slice(0, 80);
  const categoryId = str(sp.category);

  const [cats, list, breakdown] = await Promise.all([
    listCategories(org.id),
    listExpenses(org.id, { q, categoryId, month: month === "all" ? undefined : month, page }),
    expensesByCategory(org.id, month === "all" ? undefined : monthRange(month)),
  ]);

  const periodLabel = month === "all" ? "All time" : format(parseISO(`${month}-01`), "MMMM yyyy");
  const periodTotal = breakdown.reduce((s, b) => s + b.totalCents, 0);
  const catOptions = cats.map((c) => ({ id: c.id, name: c.name }));
  const filtered = !!(q || categoryId);

  const href = (p: number) => {
    const next = new URLSearchParams();
    for (const [k, v] of Object.entries(sp)) if (typeof v === "string" && k !== "page") next.set(k, v);
    if (p > 1) next.set("page", String(p));
    return `/expenses${next.size ? `?${next}` : ""}`;
  };

  const addButton = (
    <Button>
      <Plus /> Record expense
    </Button>
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Expenses"
        description="Record what you spend and see where it goes."
        actions={<ExpenseFormDialog categories={catOptions} trigger={addButton} />}
      />

      <div className="grid gap-6 lg:grid-cols-3">
        <Card>
          <CardContent className="space-y-1">
            <p className="text-sm text-muted-foreground">Total spent · {periodLabel}</p>
            <Money cents={periodTotal} currency={org.currency} size="xl" />
          </CardContent>
        </Card>
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>By category</CardTitle>
          </CardHeader>
          <CardContent>
            {breakdown.length === 0 ? (
              <p className="text-sm text-muted-foreground">No spending in this period.</p>
            ) : (
              <ul className="space-y-3">
                {breakdown.slice(0, 6).map((b) => {
                  const pct = periodTotal ? Math.round((b.totalCents / periodTotal) * 100) : 0;
                  return (
                    <li key={b.categoryId ?? "none"} className="space-y-1">
                      <div className="flex items-center justify-between text-sm">
                        <span className="flex items-center gap-2">
                          <span className="size-2.5 rounded-full" style={{ background: b.color }} aria-hidden />
                          {b.name}
                          <span className="text-xs text-muted-foreground">{pct}%</span>
                        </span>
                        <Money cents={b.totalCents} currency={org.currency} />
                      </div>
                      <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                        <div className="h-full rounded-full" style={{ width: `${Math.max(pct, 2)}%`, background: b.color }} />
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      <ExpenseFilters categories={catOptions} month={month} />

      <Card className="overflow-hidden py-0">
        {list.rows.length === 0 ? (
          <EmptyState
            icon={<Receipt />}
            title={filtered ? "No expenses match these filters" : "No expenses in this period"}
            description={filtered ? "Try clearing a filter." : "Record an expense to start tracking your monthly spending."}
            action={!filtered ? <ExpenseFormDialog categories={catOptions} trigger={addButton} /> : undefined}
          />
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/40 hover:bg-muted/40">
                <TableHead className="pl-4">Date</TableHead>
                <TableHead>Vendor</TableHead>
                <TableHead className="hidden sm:table-cell">Category</TableHead>
                <TableHead className="text-right">Amount</TableHead>
                <TableHead className="w-24 pr-4" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {list.rows.map((e) => (
                <TableRow key={e.id}>
                  <TableCell className="pl-4 text-muted-foreground">{format(parseISO(e.date), "MMM d")}</TableCell>
                  <TableCell>
                    <div className="font-medium">{e.vendor}</div>
                    {e.description && <div className="text-xs text-muted-foreground">{e.description}</div>}
                  </TableCell>
                  <TableCell className="hidden sm:table-cell">
                    <span className="inline-flex items-center gap-2 text-sm">
                      <span className="size-2 rounded-full" style={{ background: e.categoryColor ?? "#94a3b8" }} aria-hidden />
                      {e.categoryName ?? "Uncategorized"}
                    </span>
                  </TableCell>
                  <TableCell className="text-right">
                    <Money cents={e.amountCents} currency={org.currency} />
                  </TableCell>
                  <TableCell className="pr-4">
                    <ExpenseRowActions
                      categories={catOptions}
                      expense={{
                        id: e.id,
                        vendor: e.vendor,
                        description: e.description ?? "",
                        amount: centsToInput(e.amountCents),
                        date: e.date,
                        categoryId: e.categoryId ?? "",
                      }}
                    />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Card>

      {list.pageCount > 1 && (
        <Pagination className="justify-center">
          <PaginationContent>
            <PaginationItem>
              <PaginationPrevious href={href(Math.max(1, page - 1))} aria-disabled={page === 1} />
            </PaginationItem>
            {Array.from({ length: list.pageCount }, (_, i) => i + 1)
              .filter((p) => p === 1 || p === list.pageCount || Math.abs(p - page) <= 1)
              .map((p) => (
                <PaginationItem key={p}>
                  <PaginationLink href={href(p)} isActive={p === page}>
                    {p}
                  </PaginationLink>
                </PaginationItem>
              ))}
            <PaginationItem>
              <PaginationNext href={href(Math.min(list.pageCount, page + 1))} aria-disabled={page === list.pageCount} />
            </PaginationItem>
          </PaginationContent>
        </Pagination>
      )}
    </div>
  );
}
