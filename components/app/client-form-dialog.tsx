"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useState, useTransition, type ReactElement } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { createClientAction, updateClientAction } from "@/app/(app)/clients/actions";
import { applyServerErrors, FormError, TextareaField, TextField } from "@/components/form-fields";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { FieldGroup } from "@/components/ui/field";
import { clientSchema, type ClientInput } from "@/lib/validation";

type ClientRef = { id: string; name: string; company: string | null };

const EMPTY: ClientInput = { name: "", company: "", email: "", phone: "", address: "", notes: "" };

/**
 * Create or edit a client. Pass `client` (with id) to edit.
 * Controlled usage (open/onOpenChange) omits the trigger — used by the invoice builder.
 */
export function ClientFormDialog({
  client,
  trigger,
  open: controlledOpen,
  onOpenChange,
  onSaved,
}: {
  client?: ClientInput & { id: string };
  trigger?: ReactElement;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  onSaved?: (client: ClientRef) => void;
}) {
  const [internalOpen, setInternalOpen] = useState(false);
  const open = controlledOpen ?? internalOpen;
  const setOpen = onOpenChange ?? setInternalOpen;
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const form = useForm<ClientInput, unknown, ReturnType<typeof clientSchema.parse>>({
    resolver: zodResolver(clientSchema),
    defaultValues: client
      ? {
          name: client.name,
          company: client.company ?? "",
          email: client.email ?? "",
          phone: client.phone ?? "",
          address: client.address ?? "",
          notes: client.notes ?? "",
        }
      : EMPTY,
  });

  const submit = form.handleSubmit((_, e) => {
    // Don't let a nested form (invoice builder) receive this submit.
    e?.stopPropagation();
    setError(null);
    start(async () => {
      const values = form.getValues();
      const res = client ? await updateClientAction(client.id, values) : await createClientAction(values);
      if (!res.ok) {
        setError(res.error ?? null);
        applyServerErrors(form.setError, res);
        return;
      }
      toast.success(client ? "Client updated" : "Client added");
      setOpen(false);
      if (!client) form.reset(EMPTY);
      onSaved?.(res.client);
    });
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {trigger && <DialogTrigger render={trigger} />}
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{client ? "Edit client" : "New client"}</DialogTitle>
          <DialogDescription>Contact details appear on invoices you send to this client.</DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} noValidate className="space-y-4">
          <FormError message={error} />
          <FieldGroup>
            <TextField control={form.control} name="name" label="Contact name" placeholder="Jane Cooper" autoFocus />
            <TextField control={form.control} name="company" label="Company" placeholder="Acme Inc. (optional)" />
            <div className="grid gap-4 sm:grid-cols-2">
              <TextField control={form.control} name="email" label="Email" type="email" inputMode="email" />
              <TextField control={form.control} name="phone" label="Phone" type="tel" inputMode="tel" />
            </div>
            <TextareaField control={form.control} name="address" label="Billing address" rows={2} />
            <TextareaField control={form.control} name="notes" label="Internal notes" rows={2} />
          </FieldGroup>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? "Saving…" : client ? "Save changes" : "Add client"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
