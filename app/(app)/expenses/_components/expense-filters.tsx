"use client";

import { X } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { SearchInput } from "@/components/app/search-input";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const ALL = "__all";

export function ExpenseFilters({ categories, month }: { categories: { id: string; name: string }[]; month: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const category = params.get("category") ?? ALL;

  function update(patch: Record<string, string | null>) {
    const next = new URLSearchParams(params.toString());
    for (const [k, v] of Object.entries(patch)) {
      if (v) next.set(k, v);
      else next.delete(k);
    }
    next.delete("page");
    router.replace(`${pathname}${next.size ? `?${next}` : ""}`);
  }

  const items = [
    { value: ALL, label: "All categories" },
    ...categories.map((c) => ({ value: c.id, label: c.name })),
    { value: "none", label: "Uncategorized" },
  ];

  return (
    <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
      <SearchInput placeholder="Search vendor or description…" />
      <Select items={items} value={category} onValueChange={(v) => update({ category: !v || v === ALL ? null : v })}>
        <SelectTrigger className="w-full sm:w-52" aria-label="Filter by category">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {items.map((i) => (
            <SelectItem key={i.value} value={i.value}>
              {i.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <div className="flex items-center gap-2">
        <Input
          type="month"
          value={month === "all" ? "" : month}
          onChange={(e) => update({ month: e.target.value || "all" })}
          aria-label="Month"
          className="w-full sm:w-44"
        />
        <Button variant={month === "all" ? "secondary" : "ghost"} onClick={() => update({ month: "all" })}>
          All time
        </Button>
      </div>
      {(params.get("q") || params.get("category")) && (
        <Button variant="ghost" onClick={() => update({ q: null, category: null })}>
          <X /> Clear
        </Button>
      )}
    </div>
  );
}
