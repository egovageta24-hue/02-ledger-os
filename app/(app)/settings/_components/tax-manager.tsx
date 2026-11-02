"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Pencil, Plus } from "lucide-react";
import { useState, useTransition } from "react";
import { Controller, useForm } from "react-hook-form";
import { toast } from "sonner";
import { ConfirmDelete } from "@/components/app/confirm-delete";
import { applyServerErrors, FormError, TextField } from "@/components/form-fields";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Switch } from "@/components/ui/switch";
import { formatBps } from "@/lib/money";
import { taxSchema, type TaxInput } from "@/lib/validation";
import { deleteTaxAction, saveTaxAction } from "../actions";

type Tax = { id: string; name: string; rateBps: number; isDefault: boolean };

function TaxDialog({ tax, trigger }: { tax?: Tax; trigger: React.ReactElement }) {
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const defaults = (): TaxInput => ({ name: tax?.name ?? "", rate: tax ? String(tax.rateBps / 100) : "", isDefault: tax?.isDefault ?? false });
  const form = useForm<TaxInput, unknown, ReturnType<typeof taxSchema.parse>>({ resolver: zodResolver(taxSchema), defaultValues: defaults() });

  const submit = form.handleSubmit(() =>
    start(async () => {
      setError(null);
      const res = await saveTaxAction(tax?.id ?? null, form.getValues());
      if (!res.ok) {
        setError(res.error ?? null);
        applyServerErrors(form.setError, res);
        return;
      }
      toast.success(tax ? "Tax rate updated" : "Tax rate added");
      setOpen(false);
    }),
  );

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
          <DialogTitle>{tax ? "Edit tax rate" : "Add tax rate"}</DialogTitle>
          <DialogDescription>Tax rates can be picked on any invoice. The default is pre-selected on new invoices.</DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} noValidate className="space-y-4">
          <FormError message={error} />
          <FieldGroup>
            <TextField control={form.control} name="name" label="Name" placeholder="Sales tax, VAT, GST…" autoFocus />
            <TextField control={form.control} name="rate" label="Rate (%)" inputMode="decimal" placeholder="8.25" />
            <Controller
              control={form.control}
              name="isDefault"
              render={({ field }) => (
                <Field orientation="horizontal">
                  <Switch id="tax-default" checked={field.value} onCheckedChange={field.onChange} />
                  <FieldLabel htmlFor="tax-default">Use as default for new invoices</FieldLabel>
                </Field>
              )}
            />
          </FieldGroup>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? "Saving…" : "Save"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function TaxManager({ taxes }: { taxes: Tax[] }) {
  return (
    <div className="max-w-xl space-y-4">
      {taxes.length === 0 ? (
        <p className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">No tax rates yet. Invoices will have no tax unless you add one.</p>
      ) : (
        <ul className="divide-y rounded-lg border bg-card">
          {taxes.map((t) => (
            <li key={t.id} className="flex items-center justify-between gap-3 px-4 py-3">
              <div className="flex items-center gap-2">
                <span className="font-medium">{t.name}</span>
                <span className="tabular text-muted-foreground">{formatBps(t.rateBps)}</span>
                {t.isDefault && <Badge variant="secondary">Default</Badge>}
              </div>
              <div className="flex gap-1">
                <TaxDialog
                  tax={t}
                  trigger={
                    <Button variant="ghost" size="icon-sm" aria-label={`Edit ${t.name}`}>
                      <Pencil />
                    </Button>
                  }
                />
                <ConfirmDelete
                  label={`Delete ${t.name}`}
                  title={`Delete ${t.name}?`}
                  description="Existing invoices keep the tax they were created with."
                  successMessage="Tax rate deleted"
                  onConfirm={() => deleteTaxAction(t.id)}
                />
              </div>
            </li>
          ))}
        </ul>
      )}
      <TaxDialog
        trigger={
          <Button variant="outline">
            <Plus /> Add tax rate
          </Button>
        }
      />
    </div>
  );
}
