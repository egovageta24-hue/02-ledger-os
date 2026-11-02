# LedgerOS

Invoicing and finance workspace for freelancers and small agencies: clients → invoices → payments → expenses → dashboard and reports.

Next.js 16 (App Router) · TypeScript · Tailwind 4 · shadcn/ui · Neon Postgres · Drizzle · Zod · React Hook Form · Recharts

## Setup

```bash
npm install
cp .env.example .env.local     # add your Neon DATABASE_URL and a random SESSION_SECRET
npm run db:migrate             # apply db/migrations to Neon
npm run db:seed                # optional demo workspace (demo@ledgeros.dev / demo12345)
npm run dev
```

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` / `build` / `start` | Next.js |
| `npm test` | Unit tests (money, status logic) and integration tests (real actions + queries on in-process Postgres via PGlite, no database needed) |
| `npm run lint` | ESLint |
| `npm run db:generate` | Generate a migration after editing `db/schema.ts` |
| `npm run db:migrate` / `db:push` | Apply migrations / push schema (dev) |
| `npm run db:seed` | Seed the demo workspace |

## How it works

- **Money** is integer cents; rates are basis points; quantities are hundredths. `lib/money.ts` is the single source of truth for totals. The builder previews with it and the server recomputes with it on every save, so client-sent totals are never trusted.
- **Statuses**: `draft → sent → viewed → partially_paid → paid` are stored. **Overdue is derived** (past due date with a balance, not draft/paid) in `lib/invoice-status.ts` and mirrored in SQL (`overdueCondition`), so it can never go stale.
- **Payments** drive `paidCents` and status (`syncPaid`). Overpayment is rejected; removing a payment steps the status back. Invoices with payments are locked from editing.
- **Client view**: `/i/<token>` is a private, login-free page showing line items and payment status. The first view moves `sent → viewed`. Drafts are never public. "Send" gives a copyable link and a prefilled email; actual email delivery is Phase 2.
- **Roles**: `owner` (everything, including workspace settings, team and roles) and `admin` (finance/admin: invoices, payments, expenses, taxes, categories). Enforced in server actions (`requireOwner`), not just hidden in the UI. Every query is scoped by the session's workspace.
- **Auth**: email + password (bcrypt), signed httpOnly JWT cookie, route guard in `proxy.ts`.
- **Charts** use the shadcn `chart` wrapper over Recharts with a validated categorical palette, a legend, a tooltip and a table view for each chart.

## Not included (Phase 2)

Recurring invoices, overdue reminders, Stripe payments, CSV/PDF export (the printable view supports "Save as PDF" from the browser), multi-currency (one currency per workspace).
