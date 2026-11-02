import { Badge } from "@/components/ui/badge";
import { cn } from "cn";
import { STATUS_LABELS, type InvoiceStatus } from "@/lib/invoice-status";

const STYLES: Record<InvoiceStatus, { badge: string; dot: string }> = {
  draft: { badge: "bg-muted text-muted-foreground", dot: "bg-muted-foreground/60" },
  sent: { badge: "bg-info-soft text-info", dot: "bg-info" },
  viewed: { badge: "bg-info-soft text-info", dot: "bg-info" },
  partially_paid: { badge: "bg-warning-soft text-warning-foreground", dot: "bg-warning" },
  paid: { badge: "bg-success-soft text-success", dot: "bg-success" },
  overdue: { badge: "bg-danger-soft text-destructive", dot: "bg-destructive" },
};

export function StatusBadge({ status, className }: { status: InvoiceStatus; className?: string }) {
  const s = STYLES[status];
  return (
    <Badge variant="outline" className={cn("gap-1.5 border-transparent font-medium", s.badge, className)}>
      <span aria-hidden className={cn("size-1.5 rounded-full", s.dot)} />
      {STATUS_LABELS[status]}
    </Badge>
  );
}
