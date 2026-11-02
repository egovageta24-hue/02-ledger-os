import { format, getMonth, parseISO } from "date-fns";
import type { Metadata } from "next";
import { Money } from "@/components/app/money";
import { PageHeader } from "@/components/app/page-header";
import { StatTile } from "@/components/app/stat-tile";
import { BarList } from "@/components/charts/bar-list";
import { NetCashflowChart, RevenueExpensesChart } from "@/components/charts/cashflow-charts";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { expensesByCategory } from "@/db/queries/expenses";
import { lastMonths, monthlyCashflow, periodTotals, rangeForMonths, receivablesAging, revenueByClient } from "@/db/queries/reports";
import { requireAuth } from "@/lib/auth";
import { todayISO } from "@/lib/invoice-status";
import { RANGES, RangeTabs } from "./range-tabs";

export const metadata: Metadata = { title: "Reports" };

// Ordinal sequential ramp (blue 250 -> 600): later buckets are "worse" and read darker.
const AGING_COLORS = ["#86b6ef", "#5598e7", "#256abf", "#184f95"];

export default async function ReportsPage({ searchParams }: PageProps<"/reports">) {
  const { org } = await requireAuth();
  const sp = await searchParams;
  const requested = typeof sp.range === "string" ? sp.range : "6m";
  const range = RANGES.some((r) => r.value === requested) ? requested : "6m";

  const today = todayISO();
  const count = range === "3m" ? 3 : range === "12m" ? 12 : range === "ytd" ? getMonth(parseISO(today)) + 1 : 6;
  const months = lastMonths(count, today);
  const period = rangeForMonths(months);

  const [series, totals, aging, byCategory, byClient] = await Promise.all([
    monthlyCashflow(org.id, months),
    periodTotals(org.id, period),
    receivablesAging(org.id),
    expensesByCategory(org.id, period),
    revenueByClient(org.id, period),
  ]);

  const label = `${format(parseISO(period.from), "MMM yyyy")} – ${format(parseISO(`${months[months.length - 1]}-01`), "MMM yyyy")}`;
  const agingTotal = aging.reduce((s, a) => s + a.cents, 0);
  const margin = totals.collectedCents > 0 ? Math.round((totals.netCents / totals.collectedCents) * 100) : null;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Reports"
        description={label}
        actions={<RangeTabs value={range} />}
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile label="Invoiced" cents={totals.invoicedCents} currency={org.currency} hint={`${totals.count} ${totals.count === 1 ? "invoice" : "invoices"} issued`} />
        <StatTile label="Revenue collected" cents={totals.collectedCents} currency={org.currency} hint="Payments received" />
        <StatTile label="Expenses" cents={totals.expensesCents} currency={org.currency} />
        <StatTile
          label="Net cash flow"
          cents={totals.netCents}
          currency={org.currency}
          tone={totals.netCents < 0 ? "danger" : undefined}
          hint={margin === null ? undefined : `${margin}% of revenue collected`}
        />
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Revenue vs expenses</CardTitle>
            <CardDescription>Cash received and money spent by month</CardDescription>
          </CardHeader>
          <div className="px-4 pb-4">
            <RevenueExpensesChart data={series} currency={org.currency} />
          </div>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Net cash flow</CardTitle>
            <CardDescription>Revenue collected minus expenses</CardDescription>
          </CardHeader>
          <div className="px-4 pb-4">
            <NetCashflowChart data={series} currency={org.currency} />
          </div>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>Receivables aging</CardTitle>
            <CardDescription>
              <Money cents={agingTotal} currency={org.currency} size="sm" /> owed right now, by days past due
            </CardDescription>
          </CardHeader>
          <CardContent>
            <BarList items={aging.map((a) => ({ label: a.label, cents: a.cents }))} colors={AGING_COLORS} currency={org.currency} empty="Nothing outstanding." />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Expenses by category</CardTitle>
            <CardDescription>Spend in the selected period</CardDescription>
          </CardHeader>
          <CardContent>
            <BarList items={byCategory.map((c) => ({ label: c.name, cents: c.totalCents }))} currency={org.currency} empty="No expenses in this period." />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Revenue by client</CardTitle>
            <CardDescription>Payments received, top 8</CardDescription>
          </CardHeader>
          <CardContent>
            <BarList
              items={byClient.map((c) => ({ label: c.name, cents: c.totalCents, href: `/clients/${c.clientId}` }))}
              currency={org.currency}
              empty="No payments in this period."
            />
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Tax billed</CardTitle>
          <CardDescription>Tax on invoices issued in this period (sent invoices, excluding drafts)</CardDescription>
        </CardHeader>
        <CardContent>
          <Money cents={totals.taxCents} currency={org.currency} size="xl" />
        </CardContent>
      </Card>
    </div>
  );
}
