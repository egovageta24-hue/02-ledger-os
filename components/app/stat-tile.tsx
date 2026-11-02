import { ArrowDownRight, ArrowUpRight, Minus } from "lucide-react";
import type { ReactNode } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Money } from "./money";

/**
 * KPI tile: label, strong value, optional delta vs a named period.
 * `upIsGood` decides whether a rise reads as good (revenue) or bad (expenses, overdue).
 */
export function StatTile({
  label,
  cents,
  currency,
  hint,
  delta,
  upIsGood = true,
  tone,
  icon,
}: {
  label: string;
  cents: number;
  currency: string;
  hint?: ReactNode;
  delta?: { current: number; previous: number; vs: string };
  upIsGood?: boolean;
  tone?: "danger";
  icon?: ReactNode;
}) {
  let deltaEl: ReactNode = null;
  if (delta) {
    const diff = delta.current - delta.previous;
    const pct = delta.previous > 0 ? Math.round((diff / delta.previous) * 100) : null;
    const good = diff === 0 ? null : diff > 0 === upIsGood;
    const Icon = diff === 0 ? Minus : diff > 0 ? ArrowUpRight : ArrowDownRight;
    deltaEl = (
      <p className="flex items-center gap-1 text-xs text-muted-foreground">
        <span
          className={
            "inline-flex items-center gap-0.5 font-medium " +
            (good === null ? "" : good ? "text-success" : "text-destructive")
          }
        >
          <Icon className="size-3.5" aria-hidden />
          {pct === null ? (diff === 0 ? "0%" : "New") : `${diff > 0 ? "+" : ""}${pct}%`}
        </span>
        {delta.vs}
      </p>
    );
  }

  return (
    <Card>
      <CardContent className="space-y-2">
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <span>{label}</span>
          {icon && <span className="[&_svg]:size-4">{icon}</span>}
        </div>
        <Money cents={cents} currency={currency} size="xl" className={tone === "danger" && cents > 0 ? "text-destructive" : undefined} />
        {deltaEl}
        {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
      </CardContent>
    </Card>
  );
}
