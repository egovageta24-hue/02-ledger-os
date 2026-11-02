import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { InvoiceDocument, InvoiceStatusBanner } from "@/components/app/invoice-document";
import { getInvoiceByToken } from "@/db/queries/invoices";
import { PrintButton } from "./print-button";
import { ViewBeacon } from "./view-beacon";

export const metadata: Metadata = {
  title: "Invoice",
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};

export default async function PublicInvoicePage({ params }: PageProps<"/i/[token]">) {
  const { token } = await params;
  if (token.length > 64) notFound();
  const invoice = await getInvoiceByToken(token);
  if (!invoice) notFound();

  return (
    <div className="min-h-screen bg-muted/40 px-4 py-8 sm:py-12">
      <ViewBeacon token={token} />
      <div className="mx-auto max-w-3xl space-y-5">
        <div className="no-print flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-muted-foreground">
            Invoice from <span className="font-medium text-foreground">{invoice.org.name}</span>
          </p>
          <PrintButton />
        </div>
        <InvoiceStatusBanner invoice={invoice} />
        <InvoiceDocument invoice={invoice} />
        <p className="no-print pb-4 text-center text-xs text-muted-foreground">Powered by LedgerOS</p>
      </div>
    </div>
  );
}
