import type { Metadata } from "next";
import { PageHeader } from "@/components/app/page-header";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { listCategories, listMembers, listTaxes } from "@/db/queries/settings";
import { requireAuth } from "@/lib/auth";
import { CategoryManager } from "./_components/category-manager";
import { InvoiceDefaultsForm, ProfileForm, WorkspaceForm } from "./_components/simple-forms";
import { TaxManager } from "./_components/tax-manager";
import { TeamManager } from "./_components/team-manager";
import { CURRENCIES } from "@/lib/validation";

export const metadata: Metadata = { title: "Settings" };

export default async function SettingsPage() {
  const { org, user, role } = await requireAuth();
  const isOwner = role === "owner";
  const [taxes, cats, members] = await Promise.all([listTaxes(org.id), listCategories(org.id), isOwner ? listMembers(org.id) : Promise.resolve([])]);

  const currency = (CURRENCIES as readonly string[]).includes(org.currency) ? (org.currency as (typeof CURRENCIES)[number]) : "USD";

  return (
    <div className="space-y-6">
      <PageHeader title="Settings" description={`${org.name} · you are ${isOwner ? "an owner" : "a finance/admin user"}`} />

      <Tabs defaultValue="workspace">
        <div className="-mx-1 overflow-x-auto px-1 pb-1">
          <TabsList>
            <TabsTrigger value="workspace">Workspace</TabsTrigger>
            <TabsTrigger value="invoicing">Invoicing</TabsTrigger>
            <TabsTrigger value="taxes">Taxes</TabsTrigger>
            <TabsTrigger value="categories">Categories</TabsTrigger>
            {isOwner && <TabsTrigger value="team">Team &amp; roles</TabsTrigger>}
            <TabsTrigger value="profile">Profile</TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="workspace" className="pt-6">
          <WorkspaceForm
            readOnly={!isOwner}
            initial={{ name: org.name, currency, email: org.email ?? "", phone: org.phone ?? "", address: org.address ?? "" }}
          />
        </TabsContent>
        <TabsContent value="invoicing" className="pt-6">
          <InvoiceDefaultsForm
            initial={{
              invoicePrefix: org.invoicePrefix,
              paymentTermsDays: String(org.defaultPaymentTermsDays),
              defaultNotes: org.defaultNotes ?? "",
              defaultTerms: org.defaultTerms ?? "",
            }}
          />
        </TabsContent>
        <TabsContent value="taxes" className="pt-6">
          <TaxManager taxes={taxes.map((t) => ({ id: t.id, name: t.name, rateBps: t.rateBps, isDefault: t.isDefault }))} />
        </TabsContent>
        <TabsContent value="categories" className="pt-6">
          <CategoryManager categories={cats.map((c) => ({ id: c.id, name: c.name, color: c.color }))} />
        </TabsContent>
        {isOwner && (
          <TabsContent value="team" className="pt-6">
            <TeamManager members={members} currentUserId={user.id} />
          </TabsContent>
        )}
        <TabsContent value="profile" className="pt-6">
          <ProfileForm initial={{ name: user.name }} email={user.email} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
