"use client";

import { Trash2 } from "lucide-react";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Money } from "@/components/app/money";
import { fmtDate } from "@/components/app/invoice-table";
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
import { formatMoney } from "@/lib/money";
import { PAYMENT_METHOD_LABELS } from "@/lib/validation";
import { deletePaymentAction } from "../../actions";

type PaymentRow = { id: string; amountCents: number; paidAt: string; method: keyof typeof PAYMENT_METHOD_LABELS; reference: string | null };

export function PaymentsList({ payments, currency }: { payments: PaymentRow[]; currency: string }) {
  const [target, setTarget] = useState<PaymentRow | null>(null);
  const [pending, start] = useTransition();

  if (payments.length === 0) return <p className="px-4 py-6 text-sm text-muted-foreground">No payments recorded yet.</p>;

  return (
    <>
      <ul className="divide-y">
        {payments.map((p) => (
          <li key={p.id} className="flex items-center justify-between gap-3 px-4 py-3 text-sm">
            <div className="min-w-0">
              <p className="font-medium">{fmtDate(p.paidAt)}</p>
              <p className="truncate text-xs text-muted-foreground">
                {PAYMENT_METHOD_LABELS[p.method]}
                {p.reference ? ` · ${p.reference}` : ""}
              </p>
            </div>
            <div className="flex items-center gap-1">
              <Money cents={p.amountCents} currency={currency} className="text-success" />
              <Button variant="ghost" size="icon-sm" aria-label="Remove payment" onClick={() => setTarget(p)}>
                <Trash2 />
              </Button>
            </div>
          </li>
        ))}
      </ul>

      <AlertDialog open={!!target} onOpenChange={(o) => !o && setTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove this payment?</AlertDialogTitle>
            <AlertDialogDescription>
              {target && `${formatMoney(target.amountCents, currency)} received on ${fmtDate(target.paidAt)} will be removed and the invoice balance and status will update.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep payment</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              disabled={pending}
              onClick={() =>
                start(async () => {
                  const res = await deletePaymentAction(target!.id);
                  if (res.ok) toast.success("Payment removed");
                  else toast.error(res.error ?? "Something went wrong");
                  setTarget(null);
                })
              }
            >
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
