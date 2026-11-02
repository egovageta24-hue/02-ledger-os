import { Mail, MapPin, Pencil, Phone, Plus } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ActivityFeed } from "@/components/app/activity-feed";
import { ClientFormDialog } from "@/components/app/client-form-dialog";
import { EmptyState } from "@/components/app/empty-state";
import { InvoiceTable } from "@/components/app/invoice-table";
import { Money } from "@/components/app/money";
import { PageHeader } from "@/components/app/page-header";
import { Badge } from "@/components/ui/badge";
import { Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator } from "@/components/ui/breadcrumb";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getClient, getClientActivity } from "@/db/queries/clients";
import { listInvoices } from "@/db/queries/invoices";
import { requireAuth } from "@/lib/auth";
import { ArchiveClientButton } from "./archive-button";

export const metadata: Metadata = { title: "Client" };

export default async function ClientDetailPage({ params }: PageProps<"/clients/[id]">) {
  const { id } = await params;
  const { org } = await requireAuth();
  const client = await getClient(org.id, id);
  if (!client) notFound();

  const history = await listInvoices(org.id, { clientId: id, pageSize: 50 });
  const activity = await getClientActivity(org.id, id, history.rows.map((r) => r.id));
  const outstanding = Math.max(0, client.billedCents - client.paidCents);
  const archived = client.archivedAt !== null;

  return (
    <div className="space-y-6">
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink render={<Link href="/clients" />}>Clients</BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage>{client.name}</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      <PageHeader
        title={
          <span className="flex flex-wrap items-center gap-2">
            {client.name}
            {archived && <Badge variant="secondary">Archived</Badge>}
          </span>
        }
        description={client.company ?? undefined}
        actions={
          <>
            <ClientFormDialog
              client={{
                id: client.id,
                name: client.name,
                company: client.company ?? "",
                email: client.email ?? "",
                phone: client.phone ?? "",
                address: client.address ?? "",
                notes: client.notes ?? "",
              }}
              trigger={
                <Button variant="outline">
                  <Pencil /> Edit
                </Button>
              }
            />
            <ArchiveClientButton id={client.id} archived={archived} />
            {!archived && (
              <Link href={`/invoices/new?client=${client.id}`} className={buttonVariants()}>
                <Plus /> New invoice
              </Link>
            )}
          </>
        }
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <Stat label="Total billed" cents={client.billedCents} currency={org.currency} />
        <Stat label="Paid" cents={client.paidCents} currency={org.currency} tone="success" />
        <Stat label="Outstanding" cents={outstanding} currency={org.currency} tone={outstanding > 0 ? "warning" : undefined} />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card className="overflow-hidden py-0">
            <CardHeader className="border-b py-4">
              <CardTitle>Invoices</CardTitle>
            </CardHeader>
            {history.rows.length === 0 ? (
              <EmptyState
                title="No invoices yet"
                description="Create the first invoice for this client."
                action={
                  !archived && (
                    <Link href={`/invoices/new?client=${client.id}`} className={buttonVariants()}>
                      <Plus /> New invoice
                    </Link>
                  )
                }
              />
            ) : (
              <InvoiceTable rows={history.rows} currency={org.currency} showClient={false} />
            )}
          </Card>

          <Card className="overflow-hidden py-0">
            <CardHeader className="border-b py-4">
              <CardTitle>Activity</CardTitle>
            </CardHeader>
            <ActivityFeed items={activity} currency={org.currency} />
          </Card>
        </div>

        <Card className="h-fit">
          <CardHeader>
            <CardTitle>Contact</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <Row icon={<Mail />} value={client.email} href={client.email ? `mailto:${client.email}` : undefined} />
            <Row icon={<Phone />} value={client.phone} href={client.phone ? `tel:${client.phone}` : undefined} />
            <Row icon={<MapPin />} value={client.address} multiline />
            {client.notes && (
              <div className="border-t pt-3">
                <p className="mb-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">Notes</p>
                <p className="whitespace-pre-wrap">{client.notes}</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function Stat({ label, cents, currency, tone }: { label: string; cents: number; currency: string; tone?: "success" | "warning" }) {
  return (
    <Card>
      <CardContent className="space-y-1">
        <p className="text-sm text-muted-foreground">{label}</p>
        <Money
          cents={cents}
          currency={currency}
          size="xl"
          className={tone === "success" ? "text-success" : tone === "warning" ? "text-warning-foreground" : undefined}
        />
      </CardContent>
    </Card>
  );
}

function Row({ icon, value, href, multiline }: { icon: React.ReactNode; value: string | null; href?: string; multiline?: boolean }) {
  return (
    <div className="flex items-start gap-2.5 [&_svg]:mt-0.5 [&_svg]:size-4 [&_svg]:shrink-0 [&_svg]:text-muted-foreground">
      {icon}
      {value ? (
        href ? (
          <a href={href} className="break-all hover:text-primary hover:underline">
            {value}
          </a>
        ) : (
          <span className={multiline ? "whitespace-pre-wrap" : undefined}>{value}</span>
        )
      ) : (
        <span className="text-muted-foreground">Not provided</span>
      )}
    </div>
  );
}
