import Link from "next/link";
import { Money } from "@/components/app/money";

/** Horizontal magnitude bars. One hue by default (sequential job); pass `colors` for ordinal ramps. */
export function BarList({
  items,
  currency,
  colors,
  empty = "Nothing to show yet.",
}: {
  items: { label: string; cents: number; href?: string }[];
  currency: string;
  colors?: string[];
  empty?: string;
}) {
  const max = Math.max(...items.map((i) => i.cents), 0);
  if (items.length === 0 || max === 0) return <p className="py-6 text-sm text-muted-foreground">{empty}</p>;

  return (
    <ul className="space-y-3.5">
      {items.map((item, i) => {
        const pct = (item.cents / max) * 100;
        return (
          <li key={item.label} className="space-y-1.5">
            <div className="flex items-baseline justify-between gap-3 text-sm">
              {item.href ? (
                <Link href={item.href} className="truncate hover:underline">
                  {item.label}
                </Link>
              ) : (
                <span className="truncate">{item.label}</span>
              )}
              <Money cents={item.cents} currency={currency} />
            </div>
            <div className="h-2 rounded-full bg-muted" role="presentation">
              <div
                className="h-full rounded-r-[4px] rounded-l-full"
                style={{ width: `${item.cents > 0 ? Math.max(pct, 1.5) : 0}%`, background: colors?.[i] ?? "var(--chart-1)" }}
              />
            </div>
          </li>
        );
      })}
    </ul>
  );
}
