import { ArrowRight, BarChart3, Check, FileText, Receipt, ShieldCheck, Users } from "lucide-react";
import Link from "next/link";
import { Logo } from "@/components/app/logo";
import { StatusBadge } from "@/components/app/status-badge";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";

const FEATURES = [
  {
    icon: FileText,
    title: "Invoices that look professional",
    body: "Line items, quantity, rate, discount and tax. Totals are calculated for you, to the cent, and every invoice has a clean printable view.",
  },
  {
    icon: Users,
    title: "Clients in one place",
    body: "Keep contact details, invoice history and what each client still owes together. Add a new client without leaving the invoice.",
  },
  {
    icon: Receipt,
    title: "Expenses by category",
    body: "Record spending in seconds, file it under a category and see exactly where each month's money went.",
  },
  {
    icon: BarChart3,
    title: "Know where you stand",
    body: "Revenue, outstanding and overdue balances, expenses and cash-flow trend on one dashboard. Reports are built from your real data.",
  },
];

const STEPS = [
  { n: "1", title: "Add a client", body: "Name and email is enough to start." },
  { n: "2", title: "Build the invoice", body: "Add line items; discount and tax apply automatically." },
  { n: "3", title: "Send the link", body: "Your client opens a private page, reviews the items and sees the status." },
  { n: "4", title: "Record the payment", body: "Partial or full. Status and dashboard numbers update instantly." },
];

const STATUSES = ["draft", "sent", "viewed", "partially_paid", "paid", "overdue"] as const;

export default function MarketingPage() {
  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-30 border-b bg-background/85 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
          <Logo />
          <nav className="hidden items-center gap-6 text-sm text-muted-foreground md:flex" aria-label="Main">
            <a href="#features" className="hover:text-foreground">Features</a>
            <a href="#how" className="hover:text-foreground">How it works</a>
            <a href="#pricing" className="hover:text-foreground">Pricing</a>
          </nav>
          <div className="flex items-center gap-2">
            <Link href="/login" className={buttonVariants({ variant: "ghost" })}>Log in</Link>
            <Link href="/signup" className={buttonVariants()}>Get started</Link>
          </div>
        </div>
      </header>

      <main className="flex-1">
        {/* Hero */}
        <section className="mx-auto grid max-w-6xl items-center gap-12 px-4 py-16 sm:px-6 lg:grid-cols-2 lg:py-24">
          <div>
            <p className="mb-4 inline-flex items-center gap-2 rounded-full border bg-card px-3 py-1 text-xs font-medium text-muted-foreground">
              <span className="size-1.5 rounded-full bg-success" aria-hidden /> Built for freelancers &amp; small agencies
            </p>
            <h1 className="text-4xl font-semibold tracking-tight text-balance sm:text-5xl">
              Get paid faster. See your finances at a glance.
            </h1>
            <p className="mt-5 max-w-lg text-lg text-muted-foreground text-pretty">
              LedgerOS is the simple way to send professional invoices, track money coming in and understand your cash flow. No accounting degree required.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link href="/signup" className={buttonVariants({ size: "lg" }) + " h-10 px-4 text-base"}>
                Create your workspace <ArrowRight />
              </Link>
              <a href="#how" className={buttonVariants({ variant: "outline", size: "lg" }) + " h-10 px-4 text-base"}>
                See how it works
              </a>
            </div>
            <ul className="mt-8 flex flex-wrap gap-x-6 gap-y-2 text-sm text-muted-foreground">
              {["Set up in minutes", "No credit card", "Clients need no account"].map((t) => (
                <li key={t} className="flex items-center gap-1.5">
                  <Check className="size-4 text-success" aria-hidden /> {t}
                </li>
              ))}
            </ul>
          </div>

          <ProductPreview />
        </section>

        {/* Statuses */}
        <section className="border-y bg-card">
          <div className="mx-auto flex max-w-6xl flex-col items-center gap-4 px-4 py-8 text-center sm:px-6">
            <p className="text-sm text-muted-foreground">Always know where every invoice stands</p>
            <div className="flex flex-wrap justify-center gap-2">
              {STATUSES.map((s) => (
                <StatusBadge key={s} status={s} />
              ))}
            </div>
          </div>
        </section>

        {/* Features */}
        <section id="features" className="mx-auto max-w-6xl scroll-mt-20 px-4 py-20 sm:px-6">
          <div className="max-w-2xl">
            <h2 className="text-3xl font-semibold tracking-tight text-balance">Everything you need. Nothing you don&apos;t.</h2>
            <p className="mt-3 text-muted-foreground">As easy as a modern productivity app, not a traditional accounting suite.</p>
          </div>
          <div className="mt-10 grid gap-4 sm:grid-cols-2">
            {FEATURES.map((f) => (
              <Card key={f.title}>
                <CardContent className="space-y-3">
                  <span className="flex size-10 items-center justify-center rounded-lg bg-accent text-accent-foreground">
                    <f.icon className="size-5" aria-hidden />
                  </span>
                  <h3 className="text-lg font-semibold">{f.title}</h3>
                  <p className="text-sm text-muted-foreground">{f.body}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>

        {/* How it works */}
        <section id="how" className="scroll-mt-20 border-y bg-card">
          <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
            <h2 className="text-3xl font-semibold tracking-tight">From client to paid in four steps</h2>
            <ol className="mt-10 grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
              {STEPS.map((s) => (
                <li key={s.n} className="space-y-2">
                  <span className="flex size-8 items-center justify-center rounded-full bg-primary text-sm font-semibold text-primary-foreground">{s.n}</span>
                  <h3 className="font-semibold">{s.title}</h3>
                  <p className="text-sm text-muted-foreground">{s.body}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* Pricing */}
        <section id="pricing" className="mx-auto max-w-6xl scroll-mt-20 px-4 py-20 sm:px-6">
          <div className="mx-auto max-w-md">
            <Card className="ring-2 ring-primary/20">
              <CardContent className="space-y-5">
                <div>
                  <p className="text-sm font-medium text-primary">Early access</p>
                  <p className="mt-1 text-4xl font-semibold tracking-tight">Free</p>
                  <p className="mt-1 text-sm text-muted-foreground">While LedgerOS is in early access.</p>
                </div>
                <Separator />
                <ul className="space-y-2.5 text-sm">
                  {["Unlimited clients and invoices", "Expense tracking and categories", "Dashboard and reports", "Owner and finance/admin roles", "Shareable, printable invoice pages"].map((t) => (
                    <li key={t} className="flex items-center gap-2">
                      <Check className="size-4 shrink-0 text-success" aria-hidden /> {t}
                    </li>
                  ))}
                </ul>
                <Link href="/signup" className={buttonVariants({ size: "lg" }) + " h-10 w-full text-base"}>
                  Get started
                </Link>
              </CardContent>
            </Card>
          </div>
        </section>
      </main>

      <footer className="border-t">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-4 py-8 text-sm text-muted-foreground sm:flex-row sm:px-6">
          <Logo />
          <p className="flex items-center gap-1.5">
            <ShieldCheck className="size-4" aria-hidden /> Your data stays in your workspace.
          </p>
          <p>© {new Date().getFullYear()} LedgerOS</p>
        </div>
      </footer>
    </div>
  );
}

/** Illustrative sample data, drawn with the same tokens as the real dashboard. */
function ProductPreview() {
  const bars = [
    [46, 28],
    [58, 31],
    [52, 36],
    [70, 34],
    [64, 30],
    [86, 38],
  ];
  return (
    <div className="relative" aria-hidden>
      <div className="rounded-2xl border bg-card p-5 shadow-xl shadow-primary/5">
        <div className="mb-4 flex items-center justify-between">
          <p className="text-sm font-medium">Dashboard</p>
          <span className="text-xs text-muted-foreground">Sample data</span>
        </div>
        <div className="grid grid-cols-2 gap-3">
          {[
            ["Revenue this month", "$18,420.00", "text-foreground"],
            ["Outstanding", "$7,350.00", "text-foreground"],
            ["Overdue", "$1,200.00", "text-destructive"],
            ["Expenses", "$3,980.00", "text-foreground"],
          ].map(([label, value, cls]) => (
            <div key={label} className="rounded-xl border bg-background p-3">
              <p className="text-xs text-muted-foreground">{label}</p>
              <p className={`tabular mt-1 text-xl font-semibold tracking-tight ${cls}`}>{value}</p>
            </div>
          ))}
        </div>
        <div className="mt-4 rounded-xl border bg-background p-3">
          <div className="mb-2 flex items-center gap-4 text-xs text-muted-foreground">
            <span className="flex items-center gap-1.5"><span className="size-2.5 rounded-[3px] bg-chart-1" />Revenue</span>
            <span className="flex items-center gap-1.5"><span className="size-2.5 rounded-[3px] bg-chart-2" />Expenses</span>
          </div>
          <div className="flex h-28 items-end justify-between gap-2 border-b px-1">
            {bars.map(([r, e], i) => (
              <div key={i} className="flex flex-1 items-end justify-center gap-0.5">
                <div className="w-3 rounded-t-[4px] bg-chart-1" style={{ height: `${r}%` }} />
                <div className="w-3 rounded-t-[4px] bg-chart-2" style={{ height: `${e}%` }} />
              </div>
            ))}
          </div>
        </div>
        <div className="mt-4 divide-y rounded-xl border bg-background text-sm">
          {[
            ["INV-0042", "Acme Inc.", "paid", "$4,200.00"],
            ["INV-0043", "Northwind", "partially_paid", "$2,750.00"],
            ["INV-0041", "Globex", "overdue", "$1,200.00"],
          ].map(([n, c, s, a]) => (
            <div key={n} className="flex items-center justify-between gap-3 px-3 py-2.5">
              <span className="min-w-0">
                <span className="block font-medium">{n}</span>
                <span className="block truncate text-xs text-muted-foreground">{c}</span>
              </span>
              <StatusBadge status={s as "paid" | "partially_paid" | "overdue"} />
              <span className="tabular font-semibold">{a}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
