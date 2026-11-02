import { formatDistanceToNow } from "date-fns";
import { formatMoney } from "@/lib/money";

export type ActivityItem = {
  id: string;
  entityType: string;
  action: string;
  meta: Record<string, unknown> | null;
  createdAt: Date;
  userName: string | null;
};

function describe(a: ActivityItem, currency: string): string {
  const m = a.meta ?? {};
  const num = typeof m.number === "string" ? ` ${m.number}` : "";
  switch (`${a.entityType}.${a.action}`) {
    case "invoice.created":
      return `created invoice${num}`;
    case "invoice.updated":
      return `edited invoice${num}`;
    case "invoice.sent":
      return `sent invoice${num}`;
    case "invoice.viewed":
      return `Client viewed invoice${num}`;
    case "invoice.deleted":
      return `deleted invoice${num}`;
    case "invoice.payment_recorded":
      return `recorded a ${typeof m.amountCents === "number" ? formatMoney(m.amountCents, currency) : ""} payment on${num || " an invoice"}`;
    case "invoice.payment_removed":
      return `removed a payment from${num || " an invoice"}`;
    case "client.created":
      return `added client ${typeof m.name === "string" ? m.name : ""}`.trim();
    case "client.updated":
      return "updated client details";
    case "client.archived":
      return "archived the client";
    case "client.restored":
      return "restored the client";
    case "expense.created":
      return `recorded an expense${typeof m.vendor === "string" ? ` at ${m.vendor}` : ""}`;
    case "expense.deleted":
      return "deleted an expense";
    case "organization.created":
      return "created the workspace";
    default:
      return `${a.entityType} ${a.action}`;
  }
}

export function ActivityFeed({ items, currency }: { items: ActivityItem[]; currency: string }) {
  if (items.length === 0) return <p className="px-4 py-6 text-sm text-muted-foreground">No activity yet.</p>;
  return (
    <ul className="divide-y">
      {items.map((a) => {
        const text = describe(a, currency);
        const clientEvent = a.action === "viewed";
        return (
          <li key={a.id} className="flex items-start justify-between gap-3 px-4 py-3 text-sm">
            <span>
              {!clientEvent && <span className="font-medium">{a.userName ?? "Someone"} </span>}
              <span className={clientEvent ? "" : "text-muted-foreground"}>{text}</span>
            </span>
            <time className="shrink-0 text-xs text-muted-foreground" dateTime={a.createdAt.toISOString()}>
              {formatDistanceToNow(a.createdAt, { addSuffix: true })}
            </time>
          </li>
        );
      })}
    </ul>
  );
}
