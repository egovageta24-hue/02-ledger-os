import { addDays, format } from "date-fns";
import type { Metadata } from "next";
import { PageHeader } from "@/components/app/page-header";
import { listClientOptions } from "@/db/queries/clients";
import { listTaxes } from "@/db/queries/settings";
import { requireAuth } from "@/lib/auth";
import type { InvoiceInput } from "@/lib/validation";
import { InvoiceForm } from "../_components/invoice-form";

export const metadata: Metadata = { title: "New invoice" };

export default async function NewInvoicePage({ searchParams }: PageProps<"/invoices/new">) {
  const { org } = await requireAuth();
  const sp = await searchParams;
  const [clients, taxes] = await Promise.all([listClientOptions(org.id), listTaxes(org.id)]);

  const preselected = typeof sp.client === "string" && clients.some((c) => c.id === sp.client) ? sp.client : "";
  const defaultTax = taxes.find((t) => t.isDefault);
  const today = new Date();

  const initial: InvoiceInput = {
    clientId: preselected,
    issueDate: format(today, "yyyy-MM-dd"),
    dueDate: format(addDays(today, org.defaultPaymentTermsDays), "yyyy-MM-dd"),
    items: [{ description: "", quantity: "1", rate: "" }],
    discountType: "percent",
    discountValue: "",
    taxName: defaultTax?.name ?? "",
    taxRate: defaultTax ? String(defaultTax.rateBps / 100) : "",
    notes: org.defaultNotes ?? "",
    terms: org.defaultTerms ?? "",
  };

  return (
    <div className="space-y-6">
      <PageHeader title="New invoice" description="Add line items and the total is calculated for you." />
      <InvoiceForm
        mode="create"
        initial={initial}
        clients={clients}
        taxes={taxes.map((t) => ({ id: t.id, name: t.name, rateBps: t.rateBps }))}
        currency={org.currency}
        termsDays={org.defaultPaymentTermsDays}
      />
    </div>
  );
}
