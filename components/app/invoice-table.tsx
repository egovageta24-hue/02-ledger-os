import { format, parseISO } from "date-fns";
import Link from "next/link";
import { Money } from "@/components/app/money";
import { StatusBadge } from "@/components/app/status-badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { InvoiceStatus } from "@/lib/invoice-status";

export type InvoiceRow = {
  id: string;
  number: string;
  effective: InvoiceStatus;
  issueDate: string;
  dueDate: string;
  totalCents: number;
  paidCents: number;
  clientId: string;
  clientName: string;
  clientCompany?: string | null;
};

export function fmtDate(d: string) {
  return format(parseISO(d), "MMM d, yyyy");
}

export function InvoiceTable({
  rows,
  currency,
  showClient = true,
}: {
  rows: InvoiceRow[];
  currency: string;
  showClient?: boolean;
}) {
  return (
    <Table>
      <TableHeader>
        <TableRow className="bg-muted/40 hover:bg-muted/40">
          <TableHead className="pl-4">Invoice</TableHead>
          {showClient && <TableHead>Client</TableHead>}
          <TableHead>Status</TableHead>
          <TableHead className="hidden md:table-cell">Issued</TableHead>
          <TableHead className="hidden sm:table-cell">Due</TableHead>
          <TableHead className="text-right">Amount</TableHead>
          <TableHead className="pr-4 text-right">Balance</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((r) => {
          const balance = r.effective === "draft" ? r.totalCents : Math.max(0, r.totalCents - r.paidCents);
          return (
            <TableRow key={r.id}>
              <TableCell className="pl-4">
                <Link href={`/invoices/${r.id}`} className="font-medium hover:text-primary hover:underline">
                  {r.number}
                </Link>
              </TableCell>
              {showClient && (
                <TableCell>
                  <Link href={`/clients/${r.clientId}`} className="hover:underline">
                    {r.clientName}
                  </Link>
                  {r.clientCompany && <div className="text-xs text-muted-foreground">{r.clientCompany}</div>}
                </TableCell>
              )}
              <TableCell>
                <StatusBadge status={r.effective} />
              </TableCell>
              <TableCell className="hidden text-muted-foreground md:table-cell">{fmtDate(r.issueDate)}</TableCell>
              <TableCell
                className={"hidden sm:table-cell " + (r.effective === "overdue" ? "font-medium text-destructive" : "text-muted-foreground")}
              >
                {fmtDate(r.dueDate)}
              </TableCell>
              <TableCell className="text-right">
                <Money cents={r.totalCents} currency={currency} />
              </TableCell>
              <TableCell className="pr-4 text-right">
                <Money cents={balance} currency={currency} muted={balance === 0 || r.effective === "draft"} />
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}
