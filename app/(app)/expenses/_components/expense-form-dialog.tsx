"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { format } from "date-fns";
import { useState, useTransition, type ReactElement } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { applyServerErrors, FormError, SelectField, TextField } from "@/components/form-fields";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { FieldGroup } from "@/components/ui/field";
import { expenseSchema, type ExpenseInput } from "@/lib/validation";
import { createExpenseAction, updateExpenseAction } from "../actions";

export type CategoryOption = { id: string; name: string };

const UNCATEGORIZED = "";

export function ExpenseFormDialog({
  trigger,
  categories,
  expense,
}: {
  trigger: ReactElement;
  categories: CategoryOption[];
  expense?: { id: string } & ExpenseInput;
}) {
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const defaults = (): ExpenseInput =>
    expense
      ? { vendor: expense.vendor, description: expense.description ?? "", amount: expense.amount, date: expense.date, categoryId: expense.categoryId ?? UNCATEGORIZED }
      : { vendor: "", description: "", amount: "", date: format(new Date(), "yyyy-MM-dd"), categoryId: UNCATEGORIZED };

  const form = useForm<ExpenseInput, unknown, ReturnType<typeof expenseSchema.parse>>({
    resolver: zodResolver(expenseSchema),
    defaultValues: defaults(),
  });

  const submit = form.handleSubmit(() => {
    setError(null);
    start(async () => {
      const values = form.getValues();
      const res = expense ? await updateExpenseAction(expense.id, values) : await createExpenseAction(values);
      if (!res.ok) {
        setError(res.error ?? null);
        applyServerErrors(form.setError, res);
        return;
      }
      toast.success(expense ? "Expense updated" : "Expense recorded");
      setOpen(false);
    });
  });

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (o) {
          form.reset(defaults());
          setError(null);
        }
      }}
    >
      <DialogTrigger render={trigger} />
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{expense ? "Edit expense" : "Record expense"}</DialogTitle>
          <DialogDescription>Categorise spending to see where the money goes each month.</DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} noValidate className="space-y-4">
          <FormError message={error} />
          <FieldGroup>
            <TextField control={form.control} name="vendor" label="Vendor" placeholder="Figma, Delta Airlines…" autoFocus />
            <div className="grid gap-4 sm:grid-cols-2">
              <TextField control={form.control} name="amount" label="Amount" inputMode="decimal" placeholder="0.00" />
              <TextField control={form.control} name="date" label="Date" type="date" />
            </div>
            <SelectField
              control={form.control}
              name="categoryId"
              label="Category"
              placeholder="Uncategorized"
              options={[{ value: UNCATEGORIZED, label: "Uncategorized" }, ...categories.map((c) => ({ value: c.id, label: c.name }))]}
            />
            <TextField control={form.control} name="description" label="Description" placeholder="Optional" />
          </FieldGroup>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? "Saving…" : expense ? "Save changes" : "Record expense"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
