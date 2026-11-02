"use client";

import { Trash2 } from "lucide-react";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import type { ActionResult } from "@/lib/action-result";

/** Trash icon button that asks before running a destructive server action. */
export function ConfirmDelete({
  label,
  title,
  description,
  confirmLabel = "Delete",
  successMessage,
  onConfirm,
  disabled,
}: {
  label: string;
  title: string;
  description: string;
  confirmLabel?: string;
  successMessage: string;
  onConfirm: () => Promise<ActionResult>;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();

  return (
    <>
      <Button variant="ghost" size="icon-sm" aria-label={label} disabled={disabled} onClick={() => setOpen(true)}>
        <Trash2 />
      </Button>
      <AlertDialog open={open} onOpenChange={setOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{title}</AlertDialogTitle>
            <AlertDialogDescription>{description}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              disabled={pending}
              onClick={() =>
                start(async () => {
                  const res = await onConfirm();
                  if (res.ok) toast.success(successMessage);
                  else toast.error(res.error ?? "Something went wrong");
                  setOpen(false);
                })
              }
            >
              {confirmLabel}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
