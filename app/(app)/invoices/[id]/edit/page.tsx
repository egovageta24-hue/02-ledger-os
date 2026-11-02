import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { PageHeader } from "@/components/app/page-header";
import { listClientOptions } from "@/db/queries/clients";
import { getInvoice } from "@/db/queries/invoices";
import { listTaxes } from "@/db/queries/settings";
import { requireAuth } from "@/lib/auth";
import { centsToInput, formatQuantity } from "@/lib/money";
import type { InvoiceInput } from "@/lib/validation";
import { InvoiceForm } from "../../_components/invoice-form";

export const metadata: Metadata = { title: "Edit invoice" };

export default async function EditInvoicePage({ params }: PageProps<"/invoices/[id]/edit">) {
  const { id } = await params;
  const { org } = await requireAuth();
  const inv = await getInvoice(org.id, id);
  if (!inv) notFound();
  // Invoices with payments are locked so totals can't drift from what was received.
  if (inv.paidCents > 0) redirect(`/invoices/${id}`);

  const [clients, taxes] = await Promise.all([listClientOptions(org.id), listTaxes(org.id)]);
  // Keep an archived client selectable on an existing invoice.
  if (!clients.some((c) => c.id === inv.clientId)) {
    clients.push({ id: inv.client.id, name: inv.client.name, company: inv.client.company });
  }

  const initial: InvoiceInput = {
    clientId: inv.clientId,
    issueDate: inv.issueDate,
    dueDate: inv.dueDate,
    items: inv.items.map((i) => ({
      description: i.description,
      quantity: formatQuantity(i.quantity),
      rate: centsToInput(i.rateCents),
    })),
    discountType: inv.discountType,
    discountValue: inv.discountValue
      ? inv.discountType === "percent"
        ? String(inv.discountValue / 100)
        : centsToInput(inv.discountValue)
      : "",
    taxName: inv.taxName ?? "",
    taxRate: inv.taxRateBps ? String(inv.taxRateBps / 100) : "",
    notes: inv.notes ?? "",
    terms: inv.terms ?? "",
  };

  return (
    <div className="space-y-6">
      <PageHeader title={`Edit ${inv.number}`} description={inv.client.name} />
      <InvoiceForm
        mode="edit"
        invoiceId={inv.id}
        invoiceNumber={inv.number}
        isDraft={inv.status === "draft"}
        initial={initial}
        clients={clients}
        taxes={taxes.map((t) => ({ id: t.id, name: t.name, rateBps: t.rateBps }))}
        currency={org.currency}
        termsDays={org.defaultPaymentTermsDays}
      />
    </div>
  );
}
