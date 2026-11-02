"use client";

import { Copy, MoreHorizontal, Pencil, Printer, Trash2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
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
import { Button, buttonVariants } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { deleteInvoiceAction, duplicateInvoiceAction } from "../../actions";

export function InvoiceActions({
  invoiceId,
  number,
  canEdit,
  canDelete,
}: {
  invoiceId: string;
  number: string;
  canEdit: boolean;
  canDelete: boolean;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [confirmDelete, setConfirmDelete] = useState(false);

  function duplicate() {
    start(async () => {
      const res = await duplicateInvoiceAction(invoiceId);
      if (res.ok) {
        toast.success("Duplicated as a new draft");
        router.push(`/invoices/${res.id}/edit`);
      } else toast.error(res.error ?? "Something went wrong");
    });
  }

  function remove() {
    start(async () => {
      const res = await deleteInvoiceAction(invoiceId);
      if (res.ok) {
        toast.success(`${number} deleted`);
        router.push("/invoices");
      } else {
        toast.error(res.error ?? "Something went wrong");
        setConfirmDelete(false);
      }
    });
  }

  return (
    <>
      {canEdit && (
        <Link href={`/invoices/${invoiceId}/edit`} className={buttonVariants({ variant: "outline" })}>
          <Pencil /> Edit
        </Link>
      )}
      <Button variant="outline" onClick={() => window.print()}>
        <Printer /> Print
      </Button>
      <DropdownMenu>
        <DropdownMenuTrigger render={<Button variant="outline" size="icon" aria-label="More actions" disabled={pending} />}>
          <MoreHorizontal />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={duplicate}>
            <Copy /> Duplicate
          </DropdownMenuItem>
          {canDelete && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem variant="destructive" onClick={() => setConfirmDelete(true)}>
                <Trash2 /> Delete draft
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {number}?</AlertDialogTitle>
            <AlertDialogDescription>This draft and its line items will be permanently removed. This can&apos;t be undone.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction variant="destructive" onClick={remove} disabled={pending}>
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
