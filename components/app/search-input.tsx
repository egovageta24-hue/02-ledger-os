"use client";

import { Search } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group";

/** Debounced search box that stores its value in `?q=` and resets pagination. */
export function SearchInput({ placeholder = "Search…", param = "q" }: { placeholder?: string; param?: string }) {
  const params = useSearchParams();
  // Re-mount when the URL value changes from elsewhere (e.g. "Clear"), so local text resets without an effect.
  return <SearchBox key={params.get(param) ?? ""} placeholder={placeholder} param={param} />;
}

function SearchBox({ placeholder, param }: { placeholder: string; param: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const current = params.get(param) ?? "";
  const [value, setValue] = useState(current);

  useEffect(() => {
    if (value.trim() === current) return;
    const t = setTimeout(() => {
      const next = new URLSearchParams(params.toString());
      if (value.trim()) next.set(param, value.trim());
      else next.delete(param);
      next.delete("page");
      router.replace(`${pathname}${next.size ? `?${next}` : ""}`);
    }, 250);
    return () => clearTimeout(t);
  }, [value, current, params, param, pathname, router]);

  return (
    <InputGroup className="w-full sm:max-w-xs">
      <InputGroupAddon>
        <Search />
      </InputGroupAddon>
      <InputGroupInput value={value} onChange={(e) => setValue(e.target.value)} placeholder={placeholder} aria-label={placeholder} />
    </InputGroup>
  );
}
