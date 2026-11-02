import { z } from "zod";
import { parseMoneyToCents, parsePercentToBps, parseQuantity } from "./money";

/* ---------- primitives ---------- */

const text = (label: string, max = 200) =>
  z
    .string()
    .trim()
    .min(1, `${label} is required`)
    .max(max, `${label} must be ${max} characters or fewer`);

const optionalText = (max = 500) =>
  z
    .string()
    .trim()
    .max(max, `Must be ${max} characters or fewer`)
    .optional()
    .transform((v) => (v ? v : null));

const optionalEmail = z
  .string()
  .trim()
  .optional()
  .transform((v, ctx) => {
    if (!v) return null;
    if (!z.email().safeParse(v).success) {
      ctx.addIssue({ code: "custom", message: "Enter a valid email address" });
      return z.NEVER;
    }
    return v.toLowerCase();
  });

const isoDate = (label: string) =>
  z
    .string()
    .min(1, `${label} is required`)
    .refine((v) => /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(Date.parse(v)), `${label} must be a valid date`);

/** Money typed by a user ("1,200.50") -> cents. */
export const moneyField = (label: string, opts: { allowZero?: boolean; max?: number } = {}) =>
  z
    .string()
    .trim()
    .min(1, `${label} is required`)
    .transform((v, ctx) => {
      const cents = parseMoneyToCents(v);
      if (cents === null) {
        ctx.addIssue({ code: "custom", message: `${label} must be a valid amount` });
        return z.NEVER;
      }
      if (!opts.allowZero && cents <= 0) {
        ctx.addIssue({ code: "custom", message: `${label} must be greater than 0` });
        return z.NEVER;
      }
      if (cents > (opts.max ?? 100_000_000_00)) {
        ctx.addIssue({ code: "custom", message: `${label} is too large` });
        return z.NEVER;
      }
      return cents;
    });

/** Optional percent typed by a user ("8.25") -> basis points; blank = 0. */
const percentField = (label: string) =>
  z
    .string()
    .trim()
    .optional()
    .transform((v, ctx) => {
      if (!v) return 0;
      const bps = parsePercentToBps(v);
      if (bps === null) {
        ctx.addIssue({ code: "custom", message: `${label} must be a number` });
        return z.NEVER;
      }
      if (bps > 10000) {
        ctx.addIssue({ code: "custom", message: `${label} can't exceed 100%` });
        return z.NEVER;
      }
      return bps;
    });

/* ---------- auth / onboarding ---------- */

export const signupSchema = z.object({
  name: text("Name", 100),
  email: z.string().trim().min(1, "Email is required").pipe(z.email("Enter a valid email address")),
  password: z
    .string()
    .min(8, "Password must be at least 8 characters")
    .max(100, "Password is too long"),
});
export type SignupInput = z.input<typeof signupSchema>;

export const loginSchema = z.object({
  email: z.string().trim().min(1, "Email is required").pipe(z.email("Enter a valid email address")),
  password: z.string().min(1, "Password is required"),
});
export type LoginInput = z.input<typeof loginSchema>;

export const CURRENCIES = ["USD", "EUR", "GBP", "CAD", "AUD", "INR"] as const;

export const onboardingSchema = z.object({
  name: text("Workspace name", 100),
  currency: z.enum(CURRENCIES, { error: "Choose a currency" }),
  invoicePrefix: z
    .string()
    .trim()
    .max(10, "Prefix must be 10 characters or fewer")
    .regex(/^[A-Za-z0-9-_]*$/, "Use letters, numbers, - or _"),
  taxName: optionalText(50),
  taxRate: percentField("Tax rate"),
  paymentTermsDays: z
    .string()
    .trim()
    .transform((v, ctx) => {
      const n = v === "" ? 14 : Number(v);
      if (!Number.isInteger(n) || n < 0 || n > 365) {
        ctx.addIssue({ code: "custom", message: "Enter whole days between 0 and 365" });
        return z.NEVER;
      }
      return n;
    }),
});
export type OnboardingInput = z.input<typeof onboardingSchema>;

/* ---------- clients ---------- */

export const clientSchema = z.object({
  name: text("Name", 120),
  company: optionalText(120),
  email: optionalEmail,
  phone: optionalText(40),
  address: optionalText(300),
  notes: optionalText(1000),
});
export type ClientInput = z.input<typeof clientSchema>;
export type ClientValues = z.output<typeof clientSchema>;

/* ---------- invoices ---------- */

export const lineItemSchema = z.object({
  description: text("Description", 300),
  quantity: z
    .string()
    .trim()
    .min(1, "Qty required")
    .transform((v, ctx) => {
      const q = parseQuantity(v);
      if (q === null || q <= 0) {
        ctx.addIssue({ code: "custom", message: "Qty must be more than 0" });
        return z.NEVER;
      }
      if (q > 1_000_000_00) {
        ctx.addIssue({ code: "custom", message: "Qty is too large" });
        return z.NEVER;
      }
      return q;
    }),
  rate: moneyField("Rate", { allowZero: true }),
});

export const invoiceSchema = z
  .object({
    clientId: z.string().min(1, "Choose a client"),
    issueDate: isoDate("Issue date"),
    dueDate: isoDate("Due date"),
    items: z.array(lineItemSchema).min(1, "Add at least one line item").max(100, "Too many line items"),
    discountType: z.enum(["percent", "fixed"]),
    discountValue: z.string().trim().optional(),
    taxName: optionalText(50),
    taxRate: percentField("Tax rate"),
    notes: optionalText(1000),
    terms: optionalText(1000),
  })
  .transform((v, ctx) => {
    // discount: percent -> bps, fixed -> cents
    let discountValue = 0;
    if (v.discountValue) {
      if (v.discountType === "percent") {
        const bps = parsePercentToBps(v.discountValue);
        if (bps === null || bps > 10000) {
          ctx.addIssue({ code: "custom", path: ["discountValue"], message: "Enter a percentage from 0 to 100" });
          return z.NEVER;
        }
        discountValue = bps;
      } else {
        const cents = parseMoneyToCents(v.discountValue);
        if (cents === null) {
          ctx.addIssue({ code: "custom", path: ["discountValue"], message: "Enter a valid amount" });
          return z.NEVER;
        }
        discountValue = cents;
      }
    }
    if (v.dueDate < v.issueDate) {
      ctx.addIssue({ code: "custom", path: ["dueDate"], message: "Due date can't be before the issue date" });
      return z.NEVER;
    }
    return { ...v, discountValue };
  });
export type InvoiceInput = z.input<typeof invoiceSchema>;
export type InvoiceValues = z.output<typeof invoiceSchema>;

/* ---------- payments ---------- */

export const PAYMENT_METHODS = ["bank_transfer", "card", "cash", "check", "other"] as const;
export const PAYMENT_METHOD_LABELS: Record<(typeof PAYMENT_METHODS)[number], string> = {
  bank_transfer: "Bank transfer",
  card: "Card",
  cash: "Cash",
  check: "Check",
  other: "Other",
};

export const paymentSchema = z.object({
  amount: moneyField("Amount"),
  paidAt: isoDate("Payment date"),
  method: z.enum(PAYMENT_METHODS),
  reference: optionalText(120),
});
export type PaymentInput = z.input<typeof paymentSchema>;

/* ---------- expenses / categories / tax / settings ---------- */

export const expenseSchema = z.object({
  vendor: text("Vendor", 120),
  description: optionalText(300),
  amount: moneyField("Amount"),
  date: isoDate("Date"),
  categoryId: z.string().optional().transform((v) => (v ? v : null)),
});
export type ExpenseInput = z.input<typeof expenseSchema>;

export const categorySchema = z.object({
  name: text("Name", 50),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/, "Pick a color"),
});
export type CategoryInput = z.input<typeof categorySchema>;

export const taxSchema = z.object({
  name: text("Name", 50),
  rate: z
    .string()
    .trim()
    .min(1, "Rate is required")
    .transform((v, ctx) => {
      const bps = parsePercentToBps(v);
      if (bps === null || bps > 10000) {
        ctx.addIssue({ code: "custom", message: "Enter a percentage from 0 to 100" });
        return z.NEVER;
      }
      return bps;
    }),
  isDefault: z.boolean(),
});
export type TaxInput = z.input<typeof taxSchema>;

export const workspaceSchema = z.object({
  name: text("Workspace name", 100),
  currency: z.enum(CURRENCIES),
  email: optionalEmail,
  phone: optionalText(40),
  address: optionalText(300),
});
export type WorkspaceInput = z.input<typeof workspaceSchema>;

export const invoiceDefaultsSchema = z.object({
  invoicePrefix: z
    .string()
    .trim()
    .max(10, "Prefix must be 10 characters or fewer")
    .regex(/^[A-Za-z0-9-_]*$/, "Use letters, numbers, - or _"),
  paymentTermsDays: onboardingSchema.shape.paymentTermsDays,
  defaultNotes: optionalText(1000),
  defaultTerms: optionalText(1000),
});
export type InvoiceDefaultsInput = z.input<typeof invoiceDefaultsSchema>;

export const inviteSchema = z.object({
  name: text("Name", 100),
  email: z.string().trim().min(1, "Email is required").pipe(z.email("Enter a valid email address")),
  password: z.string().min(8, "Password must be at least 8 characters").max(100),
  role: z.enum(["owner", "admin"]),
});
export type InviteInput = z.input<typeof inviteSchema>;

export const profileSchema = z.object({
  name: text("Name", 100),
});
export type ProfileInput = z.input<typeof profileSchema>;
