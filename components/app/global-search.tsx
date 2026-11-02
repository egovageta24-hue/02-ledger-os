"use client";

import { FileText, Search, Users } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Command, CommandDialog, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";

type Results = {
  clients: { id: string; name: string; company: string | null }[];
  invoices: { id: string; number: string; clientName: string }[];
};

export function GlobalSearch() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Results>({ clients: [], invoices: [] });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((o) => !o);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    if (!open) return;
    const q = query.trim();
    const ctrl = new AbortController();
    const t = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(q)}`, { signal: ctrl.signal });
        if (res.ok) setResults(await res.json());
      } catch {
        /* aborted or offline; keep previous results */
      } finally {
        setLoading(false);
      }
    }, 150);
    return () => {
      clearTimeout(t);
      ctrl.abort();
    };
  }, [query, open]);

  function go(href: string) {
    setOpen(false);
    setQuery("");
    router.push(href);
  }

  return (
    <>
      <Button variant="outline" className="w-full max-w-xs justify-start text-muted-foreground" onClick={() => setOpen(true)}>
        <Search />
        <span className="flex-1 text-left">Search…</span>
        <kbd className="hidden rounded border bg-muted px-1.5 text-[10px] font-medium sm:inline">Ctrl K</kbd>
      </Button>
      <CommandDialog open={open} onOpenChange={setOpen} title="Search" description="Find clients and invoices">
        <Command shouldFilter={false}>
          <CommandInput placeholder="Search clients and invoices…" value={query} onValueChange={setQuery} />
          <CommandList>
            <CommandEmpty>{loading ? "Searching…" : "No results found."}</CommandEmpty>
            {results.clients.length > 0 && (
              <CommandGroup heading="Clients">
                {results.clients.map((c) => (
                  <CommandItem key={c.id} value={`client-${c.id}`} onSelect={() => go(`/clients/${c.id}`)}>
                    <Users />
                    <span>{c.name}</span>
                    {c.company && <span className="text-muted-foreground">· {c.company}</span>}
                  </CommandItem>
                ))}
              </CommandGroup>
            )}
            {results.invoices.length > 0 && (
              <CommandGroup heading="Invoices">
                {results.invoices.map((i) => (
                  <CommandItem key={i.id} value={`invoice-${i.id}`} onSelect={() => go(`/invoices/${i.id}`)}>
                    <FileText />
                    <span>{i.number}</span>
                    <span className="text-muted-foreground">· {i.clientName}</span>
                  </CommandItem>
                ))}
              </CommandGroup>
            )}
          </CommandList>
        </Command>
      </CommandDialog>
    </>
  );
}
