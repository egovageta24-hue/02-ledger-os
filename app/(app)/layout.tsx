import { AppSidebar } from "@/components/app/app-sidebar";
import { GlobalSearch } from "@/components/app/global-search";
import { UserMenu } from "@/components/app/user-menu";
import { Separator } from "@/components/ui/separator";
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { requireAuth } from "@/lib/auth";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const { user, org, role } = await requireAuth();

  return (
    <SidebarProvider>
      <AppSidebar orgName={org.name} />
      <SidebarInset>
        <header className="no-print sticky top-0 z-20 flex h-14 items-center gap-3 border-b bg-background/90 px-4 backdrop-blur">
          <SidebarTrigger />
          <Separator orientation="vertical" className="h-5" />
          <div className="flex flex-1 items-center">
            <GlobalSearch />
          </div>
          <UserMenu name={user.name} email={user.email} role={role} />
        </header>
        <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 sm:px-6 lg:py-8">{children}</main>
      </SidebarInset>
    </SidebarProvider>
  );
}
