import { describe, expect, it } from "vitest";
import {
  calcInvoiceTotals,
  calcLineAmount,
  formatBps,
  formatMoney,
  formatQuantity,
  parseMoneyToCents,
  parsePercentToBps,
  parseQuantity,
} from "./money";
import { balanceCents, daysOverdue, effectiveStatus, statusAfterPayment } from "./invoice-status";

describe("calcLineAmount", () => {
  it("multiplies quantity (hundredths) by rate (cents)", () => {
    expect(calcLineAmount(100, 5000)).toBe(5000); // 1 x $50
    expect(calcLineAmount(250, 4000)).toBe(10000); // 2.5 x $40
  });
  it("rounds half-up to the cent", () => {
    expect(calcLineAmount(333, 1000)).toBe(3330); // 3.33 x $10.00
    expect(calcLineAmount(1, 50)).toBe(1); // 0.01 x $0.50 = 0.005 -> 0.01
  });
  it("never goes negative", () => {
    expect(calcLineAmount(-100, 5000)).toBe(0);
    expect(calcLineAmount(100, -5000)).toBe(0);
  });
});

describe("calcInvoiceTotals", () => {
  const items = [
    { quantity: 1000, rateCents: 15000 }, // 10h x $150 = $1,500
    { quantity: 100, rateCents: 25000 }, // 1 x $250 = $250
  ];

  it("sums line items with no discount or tax", () => {
    const t = calcInvoiceTotals({ items, discountType: "percent", discountValue: 0, taxRateBps: 0 });
    expect(t).toMatchObject({ subtotalCents: 175000, discountCents: 0, taxCents: 0, totalCents: 175000 });
    expect(t.lineAmounts).toEqual([150000, 25000]);
  });

  it("applies percent discount before tax", () => {
    const t = calcInvoiceTotals({ items, discountType: "percent", discountValue: 1000, taxRateBps: 825 });
    // subtotal 1750.00, 10% off = 175.00, taxable 1575.00, tax 8.25% = 129.9375 -> 129.94
    expect(t.discountCents).toBe(17500);
    expect(t.taxableCents).toBe(157500);
    expect(t.taxCents).toBe(12994);
    expect(t.totalCents).toBe(170494);
  });

  it("applies fixed discount", () => {
    const t = calcInvoiceTotals({ items, discountType: "fixed", discountValue: 5000, taxRateBps: 1000 });
    expect(t.discountCents).toBe(5000);
    expect(t.taxCents).toBe(17000);
    expect(t.totalCents).toBe(187000);
  });

  it("clamps a fixed discount larger than the subtotal", () => {
    const t = calcInvoiceTotals({ items, discountType: "fixed", discountValue: 999999, taxRateBps: 1000 });
    expect(t.discountCents).toBe(175000);
    expect(t.totalCents).toBe(0);
  });

  it("clamps a >100% discount", () => {
    const t = calcInvoiceTotals({ items, discountType: "percent", discountValue: 15000, taxRateBps: 0 });
    expect(t.totalCents).toBe(0);
  });

  it("handles the 3 x $33.33 @ 8.25% edge case", () => {
    const t = calcInvoiceTotals({
      items: [{ quantity: 300, rateCents: 3333 }],
      discountType: "percent",
      discountValue: 0,
      taxRateBps: 825,
    });
    expect(t.subtotalCents).toBe(9999);
    expect(t.taxCents).toBe(825); // 824.92 -> 825
    expect(t.totalCents).toBe(10824);
  });

  it("returns zeros for an empty invoice", () => {
    const t = calcInvoiceTotals({ items: [], discountType: "percent", discountValue: 0, taxRateBps: 825 });
    expect(t.totalCents).toBe(0);
  });

  it("total always equals subtotal - discount + tax", () => {
    for (let q = 1; q < 400; q += 37) {
      for (let r = 1; r < 20000; r += 1733) {
        const t = calcInvoiceTotals({
          items: [{ quantity: q, rateCents: r }],
          discountType: "percent",
          discountValue: 750,
          taxRateBps: 1999,
        });
        expect(t.totalCents).toBe(t.subtotalCents - t.discountCents + t.taxCents);
      }
    }
  });
});

describe("parsing", () => {
  it("parses money", () => {
    expect(parseMoneyToCents("12.34")).toBe(1234);
    expect(parseMoneyToCents("$1,234.5")).toBe(123450);
    expect(parseMoneyToCents("7")).toBe(700);
    expect(parseMoneyToCents("0.005")).toBe(1);
    expect(parseMoneyToCents(".5")).toBe(50);
  });
  it("rejects bad input", () => {
    for (const bad of ["", " ", "abc", "-5", "1.2.3", ".", null, undefined]) {
      expect(parseMoneyToCents(bad as string)).toBeNull();
    }
  });
  it("parses quantity and percent", () => {
    expect(parseQuantity("1.5")).toBe(150);
    expect(parsePercentToBps("8.25")).toBe(825);
  });
});

describe("formatting", () => {
  it("formats", () => {
    expect(formatMoney(123456)).toBe("$1,234.56");
    expect(formatBps(825)).toBe("8.25%");
    expect(formatBps(1000)).toBe("10%");
    expect(formatQuantity(150)).toBe("1.5");
    expect(formatQuantity(200)).toBe("2");
  });
});

describe("invoice status", () => {
  const base = { totalCents: 10000, paidCents: 0 };
  it("derives overdue only for unpaid, non-draft, past-due invoices", () => {
    expect(effectiveStatus({ ...base, status: "sent", dueDate: "2026-01-01" }, "2026-02-01")).toBe("overdue");
    expect(effectiveStatus({ ...base, status: "viewed", dueDate: "2026-01-01" }, "2026-02-01")).toBe("overdue");
    expect(effectiveStatus({ ...base, status: "partially_paid", paidCents: 4000, dueDate: "2026-01-01" }, "2026-02-01")).toBe("overdue");
    expect(effectiveStatus({ ...base, status: "draft", dueDate: "2026-01-01" }, "2026-02-01")).toBe("draft");
    expect(effectiveStatus({ ...base, status: "paid", paidCents: 10000, dueDate: "2026-01-01" }, "2026-02-01")).toBe("paid");
    expect(effectiveStatus({ ...base, status: "sent", dueDate: "2026-02-01" }, "2026-02-01")).toBe("sent");
  });
  it("moves status with payments", () => {
    expect(statusAfterPayment("sent", 10000, 4000, null)).toBe("partially_paid");
    expect(statusAfterPayment("viewed", 10000, 10000, null)).toBe("paid");
    expect(statusAfterPayment("paid", 10000, 6000, null)).toBe("partially_paid");
    expect(statusAfterPayment("partially_paid", 10000, 0, new Date())).toBe("viewed");
    expect(statusAfterPayment("partially_paid", 10000, 0, null)).toBe("sent");
    expect(statusAfterPayment("draft", 10000, 5000, null)).toBe("draft");
  });
  it("computes balance and days overdue", () => {
    expect(balanceCents({ totalCents: 10000, paidCents: 2500 })).toBe(7500);
    expect(balanceCents({ totalCents: 10000, paidCents: 12000 })).toBe(0);
    expect(daysOverdue("2026-01-01", "2026-01-31")).toBe(30);
  });
});
