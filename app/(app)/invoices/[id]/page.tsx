import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ActivityFeed } from "@/components/app/activity-feed";
import { InvoiceDocument, InvoiceStatusBanner } from "@/components/app/invoice-document";
import { Money } from "@/components/app/money";
import { PageHeader } from "@/components/app/page-header";
import { Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator } from "@/components/ui/breadcrumb";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getInvoice, getInvoiceActivity } from "@/db/queries/invoices";
import { requireAuth } from "@/lib/auth";
import { balanceCents } from "@/lib/invoice-status";
import { InvoiceActions } from "./_components/invoice-actions";
import { PaymentsList } from "./_components/payments-list";
import { RecordPaymentDialog } from "./_components/record-payment-dialog";
import { SendInvoiceDialog } from "./_components/send-invoice-dialog";

export const metadata: Metadata = { title: "Invoice" };

export default async function InvoiceDetailPage({ params }: PageProps<"/invoices/[id]">) {
  const { id } = await params;
  const { org } = await requireAuth();
  const invoice = await getInvoice(org.id, id);
  if (!invoice) notFound();
  const activity = await getInvoiceActivity(org.id, id);

  const isDraft = invoice.status === "draft";
  const balance = balanceCents(invoice);
  const canRecordPayment = !isDraft && balance > 0;

  return (
    <div className="space-y-6">
      <Breadcrumb className="no-print">
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink render={<Link href="/invoices" />}>Invoices</BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage>{invoice.number}</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      <PageHeader
        className="no-print"
        title={invoice.number}
        description={
          <>
            For{" "}
            <Link href={`/clients/${invoice.client.id}`} className="font-medium text-foreground hover:underline">
              {invoice.client.name}
            </Link>
          </>
        }
        actions={
          <>
            {canRecordPayment && (
              <RecordPaymentDialog invoiceId={invoice.id} number={invoice.number} balanceCents={balance} currency={org.currency} />
            )}
            <SendInvoiceDialog
              invoiceId={invoice.id}
              number={invoice.number}
              token={invoice.shareToken}
              clientEmail={invoice.client.email}
              clientName={invoice.client.name}
              orgName={org.name}
              isDraft={isDraft}
              trigger={canRecordPayment ? "outline" : undefined}
            />
            <InvoiceActions invoiceId={invoice.id} number={invoice.number} canEdit={invoice.paidCents === 0} canDelete={isDraft} />
          </>
        }
      />

      <InvoiceStatusBanner invoice={invoice} />

      <div className="grid gap-6 xl:grid-cols-[1fr_320px] print:block">
        <InvoiceDocument invoice={invoice} />

        <aside className="no-print space-y-6">
          <Card className="overflow-hidden py-0">
            <CardHeader className="border-b py-4">
              <CardTitle>Payments</CardTitle>
            </CardHeader>
            <div className="grid grid-cols-2 gap-px border-b bg-border">
              <div className="space-y-0.5 bg-card px-4 py-3">
                <p className="text-xs text-muted-foreground">Received</p>
                <Money cents={invoice.paidCents} currency={org.currency} size="lg" className="text-success" />
              </div>
              <div className="space-y-0.5 bg-card px-4 py-3">
                <p className="text-xs text-muted-foreground">Balance</p>
                <Money cents={isDraft ? invoice.totalCents : balance} currency={org.currency} size="lg" />
              </div>
            </div>
            <PaymentsList payments={invoice.payments} currency={org.currency} />
          </Card>

          <Card className="overflow-hidden py-0">
            <CardHeader className="border-b py-4">
              <CardTitle>Activity</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <ActivityFeed items={activity} currency={org.currency} />
            </CardContent>
          </Card>
        </aside>
      </div>
    </div>
  );
}
