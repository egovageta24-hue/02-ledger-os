import { cn } from "cn";
import { formatMoney } from "@/lib/money";

/** Tabular, strong money figure. Use `size` for KPI-scale numbers. */
export function Money({
  cents,
  currency = "USD",
  size = "md",
  className,
  compact,
  muted,
}: {
  cents: number;
  currency?: string;
  size?: "sm" | "md" | "lg" | "xl";
  className?: string;
  compact?: boolean;
  muted?: boolean;
}) {
  return (
    <span
      className={cn(
        "tabular font-semibold tracking-tight",
        size === "sm" && "text-sm font-medium",
        size === "md" && "text-sm",
        size === "lg" && "text-xl",
        size === "xl" && "text-3xl",
        muted && "text-muted-foreground",
        className,
      )}
    >
      {formatMoney(cents, currency, { compact })}
    </span>
  );
}
