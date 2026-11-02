"use client";

import { Table2, BarChart3 } from "lucide-react";
import { useState } from "react";
import { Area, AreaChart, Bar, BarChart, CartesianGrid, ReferenceLine, XAxis, YAxis } from "recharts";
import { Button } from "@/components/ui/button";
import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatMoney } from "@/lib/money";

export type MonthPoint = {
  month: string;
  label: string;
  revenueCents: number;
  expensesCents: number;
  netCents: number;
};

const money = (cents: number, currency: string, compact = false) => formatMoney(cents, currency, { compact });
// Y-axis ticks: whole currency units, compact ("$12K").
const tick = (currency: string) => (v: number) => formatMoney(v, currency, { compact: true }).replace(/\.0(?=[A-Za-z]|$)/, "");

const axisProps = {
  tickLine: false,
  axisLine: false,
  tickMargin: 8,
  tick: { fill: "var(--muted-foreground)", fontSize: 12 },
} as const;

function TableToggle({ asTable, onToggle }: { asTable: boolean; onToggle: () => void }) {
  return (
    <Button variant="ghost" size="xs" onClick={onToggle} aria-pressed={asTable}>
      {asTable ? <BarChart3 /> : <Table2 />}
      {asTable ? "Chart" : "Table"}
    </Button>
  );
}

function DataTable({ data, currency, withNet }: { data: MonthPoint[]; currency: string; withNet?: boolean }) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Month</TableHead>
          <TableHead className="text-right">Revenue collected</TableHead>
          <TableHead className="text-right">Expenses</TableHead>
          {withNet && <TableHead className="text-right">Net</TableHead>}
        </TableRow>
      </TableHeader>
      <TableBody>
        {data.map((d) => (
          <TableRow key={d.month}>
            <TableCell>{d.month}</TableCell>
            <TableCell className="tabular text-right">{money(d.revenueCents, currency)}</TableCell>
            <TableCell className="tabular text-right">{money(d.expensesCents, currency)}</TableCell>
            {withNet && <TableCell className="tabular text-right font-medium">{money(d.netCents, currency)}</TableCell>}
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

const barConfig = {
  revenueCents: { label: "Revenue collected", color: "var(--chart-1)" },
  expensesCents: { label: "Expenses", color: "var(--chart-2)" },
} satisfies ChartConfig;

/** Two series, one axis: cash received vs. money spent, per month. */
export function RevenueExpensesChart({ data, currency, className }: { data: MonthPoint[]; currency: string; className?: string }) {
  const [asTable, setAsTable] = useState(false);
  const empty = data.every((d) => d.revenueCents === 0 && d.expensesCents === 0);

  return (
    <div className={className}>
      <div className="mb-2 flex justify-end">
        <TableToggle asTable={asTable} onToggle={() => setAsTable((v) => !v)} />
      </div>
      {asTable ? (
        <DataTable data={data} currency={currency} />
      ) : empty ? (
        <p className="py-16 text-center text-sm text-muted-foreground">No payments or expenses recorded in this period yet.</p>
      ) : (
        <ChartContainer config={barConfig} className="aspect-auto h-64 w-full" role="img" aria-label="Revenue collected versus expenses by month">
          <BarChart data={data} barGap={2} margin={{ left: 4, right: 4, top: 8 }}>
            <CartesianGrid vertical={false} stroke="var(--chart-grid)" />
            <XAxis dataKey="label" {...axisProps} />
            <YAxis width={52} {...axisProps} tickFormatter={tick(currency)} />
            <ChartTooltip
              cursor={{ fill: "var(--muted)", opacity: 0.6 }}
              content={
                <ChartTooltipContent
                  labelFormatter={(_, p) => p?.[0]?.payload?.month}
                  formatter={(value, name, item) => (
                    <div className="flex w-full items-center justify-between gap-6">
                      <span className="flex items-center gap-2 text-muted-foreground">
                        <span className="size-2.5 rounded-[3px]" style={{ background: item.color }} />
                        {barConfig[name as keyof typeof barConfig]?.label}
                      </span>
                      <span className="tabular font-semibold text-foreground">{money(Number(value), currency)}</span>
                    </div>
                  )}
                />
              }
            />
            <ChartLegend content={<ChartLegendContent />} />
            <Bar dataKey="revenueCents" fill="var(--color-revenueCents)" radius={[4, 4, 0, 0]} maxBarSize={24} />
            <Bar dataKey="expensesCents" fill="var(--color-expensesCents)" radius={[4, 4, 0, 0]} maxBarSize={24} />
          </BarChart>
        </ChartContainer>
      )}
    </div>
  );
}

const netConfig = { netCents: { label: "Net cash flow", color: "var(--chart-1)" } } satisfies ChartConfig;

/** Single series: revenue collected minus expenses, against a zero baseline. */
export function NetCashflowChart({ data, currency, className }: { data: MonthPoint[]; currency: string; className?: string }) {
  const [asTable, setAsTable] = useState(false);
  const empty = data.every((d) => d.netCents === 0);

  return (
    <div className={className}>
      <div className="mb-2 flex justify-end">
        <TableToggle asTable={asTable} onToggle={() => setAsTable((v) => !v)} />
      </div>
      {asTable ? (
        <DataTable data={data} currency={currency} withNet />
      ) : empty ? (
        <p className="py-16 text-center text-sm text-muted-foreground">Net cash flow appears once you record payments or expenses.</p>
      ) : (
        <ChartContainer config={netConfig} className="aspect-auto h-64 w-full" role="img" aria-label="Net cash flow by month">
          <AreaChart data={data} margin={{ left: 4, right: 12, top: 8 }}>
            <CartesianGrid vertical={false} stroke="var(--chart-grid)" />
            <XAxis dataKey="label" {...axisProps} />
            <YAxis width={52} {...axisProps} tickFormatter={tick(currency)} />
            <ReferenceLine y={0} stroke="var(--border)" />
            <ChartTooltip
              cursor={{ stroke: "var(--muted-foreground)", strokeWidth: 1 }}
              content={
                <ChartTooltipContent
                  hideIndicator
                  labelFormatter={(_, p) => p?.[0]?.payload?.month}
                  formatter={(value) => (
                    <div className="flex w-full items-center justify-between gap-6">
                      <span className="text-muted-foreground">Net cash flow</span>
                      <span className="tabular font-semibold text-foreground">{money(Number(value), currency)}</span>
                    </div>
                  )}
                />
              }
            />
            <Area
              dataKey="netCents"
              type="monotone"
              stroke="var(--color-netCents)"
              strokeWidth={2}
              fill="var(--color-netCents)"
              fillOpacity={0.1}
              dot={{ r: 4, fill: "var(--color-netCents)", stroke: "var(--card)", strokeWidth: 2 }}
              activeDot={{ r: 5, stroke: "var(--card)", strokeWidth: 2 }}
            />
          </AreaChart>
        </ChartContainer>
      )}
    </div>
  );
}
