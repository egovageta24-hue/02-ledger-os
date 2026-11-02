"use client";

import { Archive, ArchiveRestore } from "lucide-react";
import { useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { setClientArchivedAction } from "../actions";

export function ArchiveClientButton({ id, archived }: { id: string; archived: boolean }) {
  const [pending, start] = useTransition();
  return (
    <Button
      variant="outline"
      disabled={pending}
      onClick={() =>
        start(async () => {
          const res = await setClientArchivedAction(id, !archived);
          if (res.ok) toast.success(archived ? "Client restored" : "Client archived");
          else toast.error(res.error ?? "Something went wrong");
        })
      }
    >
      {archived ? <ArchiveRestore /> : <Archive />}
      {archived ? "Restore" : "Archive"}
    </Button>
  );
}
