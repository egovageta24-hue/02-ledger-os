/**
 * Money math for LedgerOS.
 *
 * Conventions (shared by the invoice builder preview and the server, which is authoritative):
 *  - money is integer cents
 *  - rates / percentages are integer basis points (1% = 100 bps)
 *  - quantities are integer hundredths (1.5 units = 150)
 *  - rounding is half-up, done once per component (line amount, discount, tax)
 */

export type DiscountType = "percent" | "fixed";

export type LineItemInput = {
  /** Quantity in hundredths, e.g. 1.5 -> 150 */
  quantity: number;
  /** Unit rate in cents */
  rateCents: number;
};

export type InvoiceTotalsInput = {
  items: LineItemInput[];
  discountType: DiscountType;
  /** basis points when percent, cents when fixed */
  discountValue: number;
  taxRateBps: number;
};

export type InvoiceTotals = {
  lineAmounts: number[];
  subtotalCents: number;
  discountCents: number;
  taxableCents: number;
  taxCents: number;
  totalCents: number;
};

/** Integer division of non-negative ints, rounded half-up, without float error. */
function divRound(numerator: number, denominator: number): number {
  const m = numerator * 2 + denominator;
  const d = denominator * 2;
  return (m - (m % d)) / d;
}

export function calcLineAmount(quantity: number, rateCents: number): number {
  return divRound(Math.max(0, quantity) * Math.max(0, rateCents), 100);
}

export function calcInvoiceTotals(input: InvoiceTotalsInput): InvoiceTotals {
  const lineAmounts = input.items.map((i) => calcLineAmount(i.quantity, i.rateCents));
  const subtotalCents = lineAmounts.reduce((a, b) => a + b, 0);

  const rawDiscount =
    input.discountType === "percent"
      ? divRound(subtotalCents * Math.max(0, input.discountValue), 10000)
      : Math.max(0, input.discountValue);
  const discountCents = Math.min(rawDiscount, subtotalCents);

  const taxableCents = subtotalCents - discountCents;
  const taxCents = divRound(taxableCents * Math.max(0, input.taxRateBps), 10000);

  return {
    lineAmounts,
    subtotalCents,
    discountCents,
    taxableCents,
    taxCents,
    totalCents: taxableCents + taxCents,
  };
}

// ---------- formatting ----------

export function formatMoney(cents: number, currency = "USD", opts?: { compact?: boolean }): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    ...(opts?.compact
      ? { notation: "compact", maximumFractionDigits: 1 }
      : { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
  }).format(cents / 100);
}

export function formatBps(bps: number): string {
  const pct = bps / 100;
  return `${Number.isInteger(pct) ? pct : pct.toFixed(2).replace(/0+$/, "").replace(/\.$/, "")}%`;
}

export function formatQuantity(hundredths: number): string {
  const q = hundredths / 100;
  return Number.isInteger(q) ? String(q) : q.toFixed(2).replace(/0+$/, "").replace(/\.$/, "");
}

// ---------- parsing user input ----------

/**
 * Parse a decimal string ("1,234.56", "$12", "12.5") into a scaled integer.
 * Returns null for empty/invalid input or more than `decimals` fractional digits being meaningful.
 */
function parseScaled(raw: string | number | null | undefined, scale: number, decimals: number): number | null {
  if (raw === null || raw === undefined) return null;
  const s = String(raw).trim().replace(/[$,\s]/g, "");
  if (s === "" || !/^\d*\.?\d*$/.test(s) || s === ".") return null;
  const [whole = "0", frac = ""] = s.split(".");
  const padded = (frac + "0".repeat(decimals)).slice(0, decimals);
  const roundUp = frac.length > decimals && Number(frac[decimals]) >= 5 ? 1 : 0;
  const value = Number(whole || "0") * scale + Number(padded || "0") + roundUp;
  return Number.isSafeInteger(value) ? value : null;
}

/** "12.34" -> 1234 */
export function parseMoneyToCents(raw: string | number | null | undefined): number | null {
  return parseScaled(raw, 100, 2);
}

/** "1.5" -> 150 */
export function parseQuantity(raw: string | number | null | undefined): number | null {
  return parseScaled(raw, 100, 2);
}

/** "8.25" -> 825 */
export function parsePercentToBps(raw: string | number | null | undefined): number | null {
  return parseScaled(raw, 100, 2);
}

/** cents -> "1234.50" for inputs */
export function centsToInput(cents: number): string {
  return (cents / 100).toFixed(2);
}
