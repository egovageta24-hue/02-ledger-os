"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { applyServerErrors, FormError, SelectField, TextareaField, TextField } from "@/components/form-fields";
import { Button } from "@/components/ui/button";
import { FieldGroup } from "@/components/ui/field";
import {
  CURRENCIES,
  invoiceDefaultsSchema,
  profileSchema,
  workspaceSchema,
  type InvoiceDefaultsInput,
  type ProfileInput,
  type WorkspaceInput,
} from "@/lib/validation";
import { updateInvoiceDefaultsAction, updateProfileAction, updateWorkspaceAction } from "../actions";

function SaveBar({ pending, disabled, dirty }: { pending: boolean; disabled?: boolean; dirty: boolean }) {
  return (
    <div className="flex items-center gap-3 pt-2">
      <Button type="submit" disabled={pending || disabled || !dirty}>
        {pending ? "Saving…" : "Save changes"}
      </Button>
      {disabled && <span className="text-sm text-muted-foreground">Only the workspace owner can change this.</span>}
    </div>
  );
}

export function WorkspaceForm({ initial, readOnly }: { initial: WorkspaceInput; readOnly: boolean }) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const form = useForm<WorkspaceInput, unknown, ReturnType<typeof workspaceSchema.parse>>({
    resolver: zodResolver(workspaceSchema),
    defaultValues: initial,
  });

  const submit = form.handleSubmit(() =>
    start(async () => {
      setError(null);
      const res = await updateWorkspaceAction(form.getValues());
      if (!res.ok) {
        setError(res.error ?? null);
        applyServerErrors(form.setError, res);
        return;
      }
      toast.success("Workspace updated");
      form.reset(form.getValues());
    }),
  );

  return (
    <form onSubmit={submit} noValidate className="max-w-xl space-y-4">
      <FormError message={error} />
      <FieldGroup>
        <TextField control={form.control} name="name" label="Business name" disabled={readOnly} />
        <SelectField control={form.control} name="currency" label="Currency" disabled={readOnly} options={CURRENCIES.map((c) => ({ value: c, label: c }))} />
        <div className="grid gap-4 sm:grid-cols-2">
          <TextField control={form.control} name="email" label="Business email" type="email" inputMode="email" disabled={readOnly} description="Shown on invoices" />
          <TextField control={form.control} name="phone" label="Phone" type="tel" inputMode="tel" disabled={readOnly} />
        </div>
        <TextareaField control={form.control} name="address" label="Business address" rows={3} disabled={readOnly} />
      </FieldGroup>
      <SaveBar pending={pending} disabled={readOnly} dirty={form.formState.isDirty} />
    </form>
  );
}

export function InvoiceDefaultsForm({ initial }: { initial: InvoiceDefaultsInput }) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const form = useForm<InvoiceDefaultsInput, unknown, ReturnType<typeof invoiceDefaultsSchema.parse>>({
    resolver: zodResolver(invoiceDefaultsSchema),
    defaultValues: initial,
  });

  const submit = form.handleSubmit(() =>
    start(async () => {
      setError(null);
      const res = await updateInvoiceDefaultsAction(form.getValues());
      if (!res.ok) {
        setError(res.error ?? null);
        applyServerErrors(form.setError, res);
        return;
      }
      toast.success("Invoice defaults saved");
      form.reset(form.getValues());
    }),
  );

  return (
    <form onSubmit={submit} noValidate className="max-w-xl space-y-4">
      <FormError message={error} />
      <FieldGroup>
        <div className="grid gap-4 sm:grid-cols-2">
          <TextField control={form.control} name="invoicePrefix" label="Invoice number prefix" description="Applies to new invoices only" />
          <TextField control={form.control} name="paymentTermsDays" label="Payment terms (days)" inputMode="numeric" />
        </div>
        <TextareaField control={form.control} name="defaultNotes" label="Default notes" rows={3} placeholder="Thank you for your business." />
        <TextareaField control={form.control} name="defaultTerms" label="Default payment terms text" rows={3} placeholder="Payment due within 14 days." />
      </FieldGroup>
      <SaveBar pending={pending} dirty={form.formState.isDirty} />
    </form>
  );
}

export function ProfileForm({ initial, email }: { initial: ProfileInput; email: string }) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const form = useForm<ProfileInput, unknown, ReturnType<typeof profileSchema.parse>>({
    resolver: zodResolver(profileSchema),
    defaultValues: initial,
  });

  const submit = form.handleSubmit(() =>
    start(async () => {
      setError(null);
      const res = await updateProfileAction(form.getValues());
      if (!res.ok) {
        setError(res.error ?? null);
        applyServerErrors(form.setError, res);
        return;
      }
      toast.success("Profile updated");
      form.reset(form.getValues());
    }),
  );

  return (
    <form onSubmit={submit} noValidate className="max-w-xl space-y-4">
      <FormError message={error} />
      <FieldGroup>
        <TextField control={form.control} name="name" label="Your name" autoComplete="name" />
        <div className="space-y-1.5 text-sm">
          <p className="font-medium">Email</p>
          <p className="text-muted-foreground">{email}</p>
        </div>
      </FieldGroup>
      <SaveBar pending={pending} dirty={form.formState.isDirty} />
    </form>
  );
}
