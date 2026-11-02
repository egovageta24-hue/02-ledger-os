import { CheckCircle2, Clock, AlertTriangle } from "lucide-react";
import { Money } from "@/components/app/money";
import { StatusBadge } from "@/components/app/status-badge";
import { fmtDate } from "@/components/app/invoice-table";
import { balanceCents, daysOverdue } from "@/lib/invoice-status";
import { formatBps, formatMoney, formatQuantity } from "@/lib/money";
import type { FullInvoice } from "@/db/queries/invoices";

/** Plain-language payment state shown above the invoice (client + owner views). */
export function InvoiceStatusBanner({ invoice }: { invoice: FullInvoice }) {
  const cur = invoice.org.currency;
  const balance = balanceCents(invoice);

  if (invoice.effective === "paid") {
    return (
      <Banner tone="success" icon={<CheckCircle2 />} title="Paid in full">
        Thank you — {formatMoney(invoice.totalCents, cur)} received.
      </Banner>
    );
  }
  if (invoice.effective === "draft") {
    return (
      <Banner tone="muted" icon={<Clock />} title="Draft">
        This invoice hasn&apos;t been sent yet.
      </Banner>
    );
  }
  if (invoice.effective === "overdue") {
    const d = daysOverdue(invoice.dueDate);
    return (
      <Banner tone="danger" icon={<AlertTriangle />} title={`Overdue by ${d} ${d === 1 ? "day" : "days"}`}>
        {formatMoney(balance, cur)} was due on {fmtDate(invoice.dueDate)}.
        {invoice.paidCents > 0 && ` ${formatMoney(invoice.paidCents, cur)} already paid.`}
      </Banner>
    );
  }
  if (invoice.effective === "partially_paid") {
    return (
      <Banner tone="warning" icon={<Clock />} title={`${formatMoney(balance, cur)} remaining`}>
        {formatMoney(invoice.paidCents, cur)} of {formatMoney(invoice.totalCents, cur)} paid. Remaining balance due {fmtDate(invoice.dueDate)}.
      </Banner>
    );
  }
  return (
    <Banner tone="info" icon={<Clock />} title={`${formatMoney(balance, cur)} due ${fmtDate(invoice.dueDate)}`}>
      Payment is not yet received.
    </Banner>
  );
}

const TONES = {
  success: "border-success/30 bg-success-soft text-success",
  danger: "border-destructive/30 bg-danger-soft text-destructive",
  warning: "border-warning/40 bg-warning-soft text-warning-foreground",
  info: "border-info/30 bg-info-soft text-info",
  muted: "border-border bg-muted text-muted-foreground",
} as const;

function Banner({
  tone,
  icon,
  title,
  children,
}: {
  tone: keyof typeof TONES;
  icon: React.ReactNode;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div role="status" className={`no-print flex items-start gap-3 rounded-xl border px-4 py-3 [&_svg]:mt-0.5 [&_svg]:size-5 [&_svg]:shrink-0 ${TONES[tone]}`}>
      {icon}
      <div>
        <p className="font-semibold">{title}</p>
        <p className="text-sm opacity-90">{children}</p>
      </div>
    </div>
  );
}

export function InvoiceDocument({ invoice }: { invoice: FullInvoice }) {
  const { org, client } = invoice;
  const cur = org.currency;
  const balance = balanceCents(invoice);

  return (
    <article className="print-sheet mx-auto w-full max-w-3xl rounded-xl border bg-card p-6 text-card-foreground shadow-sm sm:p-10">
      <header className="flex flex-col gap-6 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-lg font-semibold tracking-tight">{org.name}</p>
          <div className="mt-1 space-y-0.5 text-sm text-muted-foreground">
            {org.address && <p className="whitespace-pre-line">{org.address}</p>}
            {org.email && <p>{org.email}</p>}
            {org.phone && <p>{org.phone}</p>}
          </div>
        </div>
        <div className="sm:text-right">
          <p className="text-3xl font-semibold uppercase tracking-wide text-muted-foreground">Invoice</p>
          <p className="tabular mt-1 text-lg font-semibold">{invoice.number}</p>
          <div className="mt-2 sm:flex sm:justify-end">
            <StatusBadge status={invoice.effective} />
          </div>
        </div>
      </header>

      <section className="mt-8 grid gap-6 sm:grid-cols-3">
        <div className="sm:col-span-1">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Billed to</p>
          <p className="mt-1 font-medium">{client.name}</p>
          <div className="space-y-0.5 text-sm text-muted-foreground">
            {client.company && <p>{client.company}</p>}
            {client.address && <p className="whitespace-pre-line">{client.address}</p>}
            {client.email && <p>{client.email}</p>}
          </div>
        </div>
        <dl className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm sm:col-span-2 sm:justify-self-end">
          <dt className="text-muted-foreground">Issue date</dt>
          <dd className="font-medium">{fmtDate(invoice.issueDate)}</dd>
          <dt className="text-muted-foreground">Due date</dt>
          <dd className="font-medium">{fmtDate(invoice.dueDate)}</dd>
          <dt className="text-muted-foreground">Amount due</dt>
          <dd>
            <Money cents={invoice.effective === "draft" ? invoice.totalCents : balance} currency={cur} size="lg" />
          </dd>
        </dl>
      </section>

      <section className="mt-8 overflow-x-auto">
        <table className="w-full min-w-[480px] text-sm">
          <thead>
            <tr className="border-b text-left text-xs uppercase tracking-wide text-muted-foreground">
              <th className="py-2 pr-3 font-medium">Description</th>
              <th className="px-3 py-2 text-right font-medium">Qty</th>
              <th className="px-3 py-2 text-right font-medium">Rate</th>
              <th className="py-2 pl-3 text-right font-medium">Amount</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {invoice.items.map((it) => (
              <tr key={it.id}>
                <td className="py-3 pr-3 align-top">{it.description}</td>
                <td className="tabular px-3 py-3 text-right align-top">{formatQuantity(it.quantity)}</td>
                <td className="tabular px-3 py-3 text-right align-top">{formatMoney(it.rateCents, cur)}</td>
                <td className="tabular py-3 pl-3 text-right align-top font-medium">{formatMoney(it.amountCents, cur)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="mt-6 flex justify-end">
        <dl className="w-full max-w-xs space-y-2 text-sm">
          <Row label="Subtotal" cents={invoice.subtotalCents} cur={cur} />
          {invoice.discountCents > 0 && (
            <Row
              label={invoice.discountType === "percent" ? `Discount (${formatBps(invoice.discountValue)})` : "Discount"}
              cents={-invoice.discountCents}
              cur={cur}
            />
          )}
          {invoice.taxRateBps > 0 && (
            <Row label={`${invoice.taxName || "Tax"} (${formatBps(invoice.taxRateBps)})`} cents={invoice.taxCents} cur={cur} />
          )}
          <div className="flex items-baseline justify-between border-t pt-3">
            <dt className="font-semibold">Total</dt>
            <dd>
              <Money cents={invoice.totalCents} currency={cur} size="lg" />
            </dd>
          </div>
          {invoice.paidCents > 0 && (
            <>
              <Row label="Paid" cents={-invoice.paidCents} cur={cur} tone="success" />
              <div className="flex items-baseline justify-between border-t pt-3">
                <dt className="font-semibold">Balance due</dt>
                <dd>
                  <Money cents={balance} currency={cur} size="lg" />
                </dd>
              </div>
            </>
          )}
        </dl>
      </section>

      {(invoice.notes || invoice.terms) && (
        <section className="mt-10 grid gap-6 border-t pt-6 text-sm sm:grid-cols-2">
          {invoice.notes && (
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Notes</p>
              <p className="mt-1 whitespace-pre-line">{invoice.notes}</p>
            </div>
          )}
          {invoice.terms && (
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Payment terms</p>
              <p className="mt-1 whitespace-pre-line">{invoice.terms}</p>
            </div>
          )}
        </section>
      )}
    </article>
  );
}

function Row({ label, cents, cur, tone }: { label: string; cents: number; cur: string; tone?: "success" }) {
  return (
    <div className="flex items-baseline justify-between">
      <dt className="text-muted-foreground">{label}</dt>
      <dd>
        <Money cents={cents} currency={cur} className={tone === "success" ? "text-success" : undefined} />
      </dd>
    </div>
  );
}
