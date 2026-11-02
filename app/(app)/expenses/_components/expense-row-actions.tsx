"use client";

import { Pencil, Trash2 } from "lucide-react";
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
import type { ExpenseInput } from "@/lib/validation";
import { deleteExpenseAction } from "../actions";
import { ExpenseFormDialog, type CategoryOption } from "./expense-form-dialog";

export function ExpenseRowActions({
  expense,
  categories,
}: {
  expense: { id: string } & ExpenseInput;
  categories: CategoryOption[];
}) {
  const [confirm, setConfirm] = useState(false);
  const [pending, start] = useTransition();

  return (
    <div className="flex justify-end gap-1">
      <ExpenseFormDialog
        expense={expense}
        categories={categories}
        trigger={
          <Button variant="ghost" size="icon-sm" aria-label={`Edit expense from ${expense.vendor}`}>
            <Pencil />
          </Button>
        }
      />
      <Button variant="ghost" size="icon-sm" aria-label={`Delete expense from ${expense.vendor}`} onClick={() => setConfirm(true)}>
        <Trash2 />
      </Button>
      <AlertDialog open={confirm} onOpenChange={setConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this expense?</AlertDialogTitle>
            <AlertDialogDescription>The {expense.vendor} expense will be removed from your totals and reports.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              disabled={pending}
              onClick={() =>
                start(async () => {
                  const res = await deleteExpenseAction(expense.id);
                  if (res.ok) toast.success("Expense deleted");
                  else toast.error(res.error ?? "Something went wrong");
                  setConfirm(false);
                })
              }
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
