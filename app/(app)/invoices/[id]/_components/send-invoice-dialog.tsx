"use client";

import { Check, Copy, Mail, Send } from "lucide-react";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button, buttonVariants } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { markInvoiceSentAction } from "../../actions";

/** Share link + "mark as sent". Email delivery is out of scope for the MVP, so we hand over a link and a prefilled mailto. */
export function SendInvoiceDialog({
  invoiceId,
  number,
  token,
  clientEmail,
  clientName,
  orgName,
  isDraft,
  trigger,
}: {
  invoiceId: string;
  number: string;
  token: string;
  clientEmail: string | null;
  clientName: string;
  orgName: string;
  isDraft: boolean;
  trigger?: "primary" | "outline";
}) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [pending, start] = useTransition();

  const link = () => `${window.location.origin}/i/${token}`;

  async function copy() {
    try {
      await navigator.clipboard.writeText(link());
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Couldn't copy — select the link and copy it manually.");
    }
  }

  const mailto = () => {
    const subject = encodeURIComponent(`Invoice ${number} from ${orgName}`);
    const body = encodeURIComponent(`Hi ${clientName},\n\nYou can view and print invoice ${number} here:\n${link()}\n\nThank you,\n${orgName}`);
    return `mailto:${clientEmail ?? ""}?subject=${subject}&body=${body}`;
  };

  function markSent() {
    start(async () => {
      const res = await markInvoiceSentAction(invoiceId);
      if (res.ok) {
        toast.success("Invoice marked as sent");
        setOpen(false);
      } else toast.error(res.error ?? "Something went wrong");
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button variant={trigger === "outline" || !isDraft ? "outline" : "default"}>
            <Send /> {isDraft ? "Send invoice" : "Share link"}
          </Button>
        }
      />
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{isDraft ? "Send invoice" : "Share invoice"}</DialogTitle>
          <DialogDescription>
            Your client can open this private link to review the line items and see the payment status. They don&apos;t need an account.
          </DialogDescription>
        </DialogHeader>
        <div className="flex gap-2">
          <Input readOnly value={typeof window === "undefined" ? `/i/${token}` : link()} onFocus={(e) => e.currentTarget.select()} aria-label="Invoice link" />
          <Button type="button" variant="outline" onClick={copy}>
            {copied ? <Check /> : <Copy />} {copied ? "Copied" : "Copy"}
          </Button>
        </div>
        <a href={mailto()} className={buttonVariants({ variant: "outline" }) + " w-full"}>
          <Mail /> Compose email{clientEmail ? ` to ${clientEmail}` : ""}
        </a>
        <DialogFooter>
          <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
            {isDraft ? "Cancel" : "Done"}
          </Button>
          {isDraft && (
            <Button type="button" onClick={markSent} disabled={pending}>
              {pending ? "Saving…" : "Mark as sent"}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
