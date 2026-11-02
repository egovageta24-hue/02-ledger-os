import { AlertTriangle, ArrowRight, CircleDollarSign, FileClock, Plus, Receipt } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { ActivityFeed } from "@/components/app/activity-feed";
import { EmptyState } from "@/components/app/empty-state";
import { InvoiceTable, fmtDate } from "@/components/app/invoice-table";
import { Money } from "@/components/app/money";
import { PageHeader } from "@/components/app/page-header";
import { StatTile } from "@/components/app/stat-tile";
import { NetCashflowChart, RevenueExpensesChart } from "@/components/charts/cashflow-charts";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardAction, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getOrgActivity, listOverdueInvoices } from "@/db/queries/dashboard";
import { listInvoices } from "@/db/queries/invoices";
import { lastMonths, monthlyCashflow, receivables } from "@/db/queries/reports";
import { requireAuth } from "@/lib/auth";
import { daysOverdue } from "@/lib/invoice-status";

export const metadata: Metadata = { title: "Dashboard" };

export default async function DashboardPage() {
  const { org, user } = await requireAuth();
  const months = lastMonths(6);

  const [series, ar, recent, overdue, activity] = await Promise.all([
    monthlyCashflow(org.id, months),
    receivables(org.id),
    listInvoices(org.id, { pageSize: 6 }),
    listOverdueInvoices(org.id, 5),
    getOrgActivity(org.id, 8),
  ]);

  const thisMonth = series[series.length - 1];
  const lastMonth = series[series.length - 2];
  const hasAnyData = recent.total > 0 || series.some((s) => s.revenueCents || s.expensesCents);
  const sixMonthNet = series.reduce((s, m) => s + m.netCents, 0);

  return (
    <div className="space-y-6">
      <PageHeader
        title={`Welcome back, ${user.name.split(" ")[0]}`}
        description={`Here's where ${org.name} stands today.`}
        actions={
          <>
            <Link href="/expenses" className={buttonVariants({ variant: "outline" })}>
              <Receipt /> Record expense
            </Link>
            <Link href="/invoices/new" className={buttonVariants()}>
              <Plus /> New invoice
            </Link>
          </>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile
          label="Revenue this month"
          icon={<CircleDollarSign />}
          cents={thisMonth.revenueCents}
          currency={org.currency}
          delta={{ current: thisMonth.revenueCents, previous: lastMonth.revenueCents, vs: "vs last month" }}
          hint="Payments received"
        />
        <StatTile
          label="Outstanding"
          icon={<FileClock />}
          cents={ar.outstandingCents}
          currency={org.currency}
          hint={`${ar.openCount} open ${ar.openCount === 1 ? "invoice" : "invoices"}`}
        />
        <StatTile
          label="Overdue"
          icon={<AlertTriangle />}
          cents={ar.overdueCents}
          currency={org.currency}
          tone="danger"
          hint={ar.overdueCount ? `${ar.overdueCount} past due` : "Nothing past due"}
        />
        <StatTile
          label="Expenses this month"
          icon={<Receipt />}
          cents={thisMonth.expensesCents}
          currency={org.currency}
          upIsGood={false}
          delta={{ current: thisMonth.expensesCents, previous: lastMonth.expensesCents, vs: "vs last month" }}
        />
      </div>

      {!hasAnyData ? (
        <Card>
          <EmptyState
            icon={<CircleDollarSign />}
            title="Your numbers will show up here"
            description="Add a client and send your first invoice. Revenue, outstanding balances and cash-flow trends appear as soon as there's data."
            action={
              <Link href="/invoices/new" className={buttonVariants()}>
                <Plus /> Create an invoice
              </Link>
            }
          />
        </Card>
      ) : (
        <div className="grid gap-6 xl:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Revenue vs expenses</CardTitle>
              <CardDescription>Cash received and money spent, last 6 months</CardDescription>
            </CardHeader>
            <div className="px-4 pb-4">
              <RevenueExpensesChart data={series} currency={org.currency} />
            </div>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Cash-flow trend</CardTitle>
              <CardDescription>
                Net after expenses, 6-month total <Money cents={sixMonthNet} currency={org.currency} size="sm" className={sixMonthNet < 0 ? "text-destructive" : "text-success"} />
              </CardDescription>
            </CardHeader>
            <div className="px-4 pb-4">
              <NetCashflowChart data={series} currency={org.currency} />
            </div>
          </Card>
        </div>
      )}

      <div className="grid gap-6 xl:grid-cols-3">
        <Card className="overflow-hidden py-0 xl:col-span-2">
          <CardHeader className="border-b py-4">
            <CardTitle>Recent invoices</CardTitle>
            <CardAction>
              <Link href="/invoices" className={buttonVariants({ variant: "ghost", size: "sm" })}>
                View all <ArrowRight />
              </Link>
            </CardAction>
          </CardHeader>
          {recent.rows.length === 0 ? (
            <EmptyState title="No invoices yet" description="Your latest invoices will appear here." />
          ) : (
            <InvoiceTable rows={recent.rows} currency={org.currency} />
          )}
        </Card>

        <div className="space-y-6">
          <Card className="overflow-hidden py-0">
            <CardHeader className="border-b py-4">
              <CardTitle>Needs attention</CardTitle>
              <CardDescription>Overdue invoices</CardDescription>
            </CardHeader>
            {overdue.length === 0 ? (
              <p className="px-4 py-6 text-sm text-muted-foreground">No overdue invoices. Nice work.</p>
            ) : (
              <ul className="divide-y">
                {overdue.map((o) => (
                  <li key={o.id}>
                    <Link href={`/invoices/${o.id}`} className="flex items-center justify-between gap-3 px-4 py-3 text-sm hover:bg-muted/50">
                      <span className="min-w-0">
                        <span className="block truncate font-medium">{o.clientName}</span>
                        <span className="block text-xs text-destructive">
                          {o.number} · {daysOverdue(o.dueDate)}d late · due {fmtDate(o.dueDate)}
                        </span>
                      </span>
                      <Money cents={o.balanceCents} currency={org.currency} />
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card className="overflow-hidden py-0">
            <CardHeader className="border-b py-4">
              <CardTitle>Recent activity</CardTitle>
            </CardHeader>
            <ActivityFeed items={activity} currency={org.currency} />
          </Card>
        </div>
      </div>
    </div>
  );
}
