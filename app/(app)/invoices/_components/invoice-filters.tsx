"use client";

import { X } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { SearchInput } from "@/components/app/search-input";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { STATUS_LABELS } from "@/lib/invoice-status";

const TABS = ["all", "draft", "sent", "viewed", "partially_paid", "paid", "overdue"] as const;
const ALL_CLIENTS = "__all";

export function InvoiceFilters({
  counts,
  clients,
}: {
  counts: Record<(typeof TABS)[number], number>;
  clients: { id: string; name: string }[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  const status = params.get("status") ?? "all";
  const client = params.get("client") ?? ALL_CLIENTS;
  const from = params.get("from") ?? "";
  const to = params.get("to") ?? "";
  const hasFilters = !!(params.get("q") || params.get("client") || from || to);

  function update(patch: Record<string, string | null>) {
    const next = new URLSearchParams(params.toString());
    for (const [k, v] of Object.entries(patch)) {
      if (v) next.set(k, v);
      else next.delete(k);
    }
    next.delete("page");
    router.replace(`${pathname}${next.size ? `?${next}` : ""}`);
  }

  const clientItems = [{ value: ALL_CLIENTS, label: "All clients" }, ...clients.map((c) => ({ value: c.id, label: c.name }))];

  return (
    <div className="space-y-4">
      <Tabs value={status} onValueChange={(v) => update({ status: v === "all" ? null : String(v) })}>
        <div className="-mx-1 overflow-x-auto px-1 pb-1">
          <TabsList>
            {TABS.map((t) => (
              <TabsTrigger key={t} value={t} className="gap-1.5">
                {t === "all" ? "All" : STATUS_LABELS[t]}
                <span className="tabular rounded-full bg-muted-foreground/10 px-1.5 text-[11px] text-muted-foreground">{counts[t]}</span>
              </TabsTrigger>
            ))}
          </TabsList>
        </div>
      </Tabs>

      <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
        <SearchInput placeholder="Search number or client…" />
        <Select
          items={clientItems}
          value={client}
          onValueChange={(v) => update({ client: !v || v === ALL_CLIENTS ? null : v })}
        >
          <SelectTrigger className="w-full sm:w-52" aria-label="Filter by client">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {clientItems.map((c) => (
              <SelectItem key={c.value} value={c.value}>
                {c.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <div className="flex items-center gap-2">
          <Input type="date" value={from} onChange={(e) => update({ from: e.target.value || null })} aria-label="Issued from" className="w-full sm:w-36" />
          <span className="text-sm text-muted-foreground">to</span>
          <Input type="date" value={to} onChange={(e) => update({ to: e.target.value || null })} aria-label="Issued to" className="w-full sm:w-36" />
        </div>
        {hasFilters && (
          <Button variant="ghost" onClick={() => router.replace(status === "all" ? pathname : `${pathname}?status=${status}`)}>
            <X /> Clear
          </Button>
        )}
      </div>
    </div>
  );
}
