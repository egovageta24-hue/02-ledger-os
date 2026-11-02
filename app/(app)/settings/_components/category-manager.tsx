"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Pencil, Plus } from "lucide-react";
import { useState, useTransition } from "react";
import { Controller, useForm } from "react-hook-form";
import { toast } from "sonner";
import { ConfirmDelete } from "@/components/app/confirm-delete";
import { applyServerErrors, FormError, TextField } from "@/components/form-fields";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { categorySchema, type CategoryInput } from "@/lib/validation";
import { deleteCategoryAction, saveCategoryAction } from "../actions";

type Category = { id: string; name: string; color: string };

const SWATCHES = ["#2a78d6", "#7c3aed", "#db2777", "#0891b2", "#d97706", "#059669", "#475569", "#94a3b8", "#dc2626", "#65a30d"];

function CategoryDialog({ category, trigger }: { category?: Category; trigger: React.ReactElement }) {
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const defaults = (): CategoryInput => ({ name: category?.name ?? "", color: category?.color ?? SWATCHES[0] });
  const form = useForm<CategoryInput, unknown, ReturnType<typeof categorySchema.parse>>({
    resolver: zodResolver(categorySchema),
    defaultValues: defaults(),
  });

  const submit = form.handleSubmit(() =>
    start(async () => {
      setError(null);
      const res = await saveCategoryAction(category?.id ?? null, form.getValues());
      if (!res.ok) {
        setError(res.error ?? null);
        applyServerErrors(form.setError, res);
        return;
      }
      toast.success(category ? "Category updated" : "Category added");
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
          <DialogTitle>{category ? "Edit category" : "Add category"}</DialogTitle>
          <DialogDescription>Categories group your expenses in lists and reports.</DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} noValidate className="space-y-4">
          <FormError message={error} />
          <FieldGroup>
            <TextField control={form.control} name="name" label="Name" autoFocus />
            <Controller
              control={form.control}
              name="color"
              render={({ field, fieldState }) => (
                <Field data-invalid={fieldState.invalid}>
                  <FieldLabel>Color</FieldLabel>
                  <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Color">
                    {SWATCHES.map((c) => (
                      <button
                        key={c}
                        type="button"
                        role="radio"
                        aria-checked={field.value === c}
                        aria-label={c}
                        onClick={() => field.onChange(c)}
                        className="size-7 rounded-full outline-none ring-offset-2 ring-offset-background focus-visible:ring-2 focus-visible:ring-ring aria-checked:ring-2 aria-checked:ring-foreground"
                        style={{ background: c }}
                      />
                    ))}
                  </div>
                  <FieldError errors={[fieldState.error]} />
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

export function CategoryManager({ categories }: { categories: Category[] }) {
  return (
    <div className="max-w-xl space-y-4">
      {categories.length === 0 ? (
        <p className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">No categories yet.</p>
      ) : (
        <ul className="divide-y rounded-lg border bg-card">
          {categories.map((c) => (
            <li key={c.id} className="flex items-center justify-between gap-3 px-4 py-3">
              <span className="flex items-center gap-2.5 font-medium">
                <span className="size-3 rounded-full" style={{ background: c.color }} aria-hidden />
                {c.name}
              </span>
              <div className="flex gap-1">
                <CategoryDialog
                  category={c}
                  trigger={
                    <Button variant="ghost" size="icon-sm" aria-label={`Edit ${c.name}`}>
                      <Pencil />
                    </Button>
                  }
                />
                <ConfirmDelete
                  label={`Delete ${c.name}`}
                  title={`Delete ${c.name}?`}
                  description="Expenses in this category will become Uncategorized. They won't be deleted."
                  successMessage="Category deleted"
                  onConfirm={() => deleteCategoryAction(c.id)}
                />
              </div>
            </li>
          ))}
        </ul>
      )}
      <CategoryDialog
        trigger={
          <Button variant="outline">
            <Plus /> Add category
          </Button>
        }
      />
    </div>
  );
}
