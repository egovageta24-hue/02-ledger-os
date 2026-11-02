"use client";

import { usePathname, useRouter } from "next/navigation";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

export const RANGES = [
  { value: "3m", label: "3 months" },
  { value: "6m", label: "6 months" },
  { value: "12m", label: "12 months" },
  { value: "ytd", label: "Year to date" },
] as const;

export function RangeTabs({ value }: { value: string }) {
  const router = useRouter();
  const pathname = usePathname();
  return (
    <Tabs value={value} onValueChange={(v) => router.replace(`${pathname}?range=${v}`)}>
      <TabsList>
        {RANGES.map((r) => (
          <TabsTrigger key={r.value} value={r.value}>
            {r.label}
          </TabsTrigger>
        ))}
      </TabsList>
    </Tabs>
  );
}
