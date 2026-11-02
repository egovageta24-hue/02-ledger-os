"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { format } from "date-fns";
import { CircleDollarSign } from "lucide-react";
import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { applyServerErrors, FormError, SelectField, TextField } from "@/components/form-fields";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { FieldGroup } from "@/components/ui/field";
import { centsToInput, formatMoney } from "@/lib/money";
import { PAYMENT_METHODS, PAYMENT_METHOD_LABELS, paymentSchema, type PaymentInput } from "@/lib/validation";
import { recordPaymentAction } from "../../actions";

export function RecordPaymentDialog({
  invoiceId,
  number,
  balanceCents,
  currency,
}: {
  invoiceId: string;
  number: string;
  balanceCents: number;
  currency: string;
}) {
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const defaults = (): PaymentInput => ({
    amount: centsToInput(balanceCents),
    paidAt: format(new Date(), "yyyy-MM-dd"),
    method: "bank_transfer",
    reference: "",
  });

  const form = useForm<PaymentInput, unknown, ReturnType<typeof paymentSchema.parse>>({
    resolver: zodResolver(paymentSchema),
    defaultValues: defaults(),
  });

  const submit = form.handleSubmit(() => {
    setError(null);
    start(async () => {
      const res = await recordPaymentAction(invoiceId, form.getValues());
      if (!res.ok) {
        setError(res.error ?? null);
        applyServerErrors(form.setError, res);
        return;
      }
      toast.success("Payment recorded");
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
      <DialogTrigger
        render={
          <Button>
            <CircleDollarSign /> Record payment
          </Button>
        }
      />
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Record payment</DialogTitle>
          <DialogDescription>
            {number} · {formatMoney(balanceCents, currency)} outstanding
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} noValidate className="space-y-4">
          <FormError message={error} />
          <FieldGroup>
            <TextField control={form.control} name="amount" label="Amount received" inputMode="decimal" autoFocus />
            <div className="grid gap-4 sm:grid-cols-2">
              <TextField control={form.control} name="paidAt" label="Date received" type="date" />
              <SelectField
                control={form.control}
                name="method"
                label="Method"
                options={PAYMENT_METHODS.map((m) => ({ value: m, label: PAYMENT_METHOD_LABELS[m] }))}
              />
            </div>
            <TextField control={form.control} name="reference" label="Reference" placeholder="Optional — transaction ID, check number…" />
          </FieldGroup>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? "Saving…" : "Record payment"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
