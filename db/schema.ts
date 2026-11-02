import { relations } from "drizzle-orm";
import {
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  date,
  uniqueIndex,
  boolean,
} from "drizzle-orm/pg-core";
import { nanoid } from "nanoid";

const id = () =>
  text("id")
    .primaryKey()
    .$defaultFn(() => nanoid(12));

const createdAt = () => timestamp("created_at", { withTimezone: true }).notNull().defaultNow();

export const roleEnum = pgEnum("role", ["owner", "admin"]);
export const invoiceStatusEnum = pgEnum("invoice_status", [
  "draft",
  "sent",
  "viewed",
  "partially_paid",
  "paid",
]);
export const discountTypeEnum = pgEnum("discount_type", ["percent", "fixed"]);
export const paymentMethodEnum = pgEnum("payment_method", [
  "bank_transfer",
  "card",
  "cash",
  "check",
  "other",
]);

export const organizations = pgTable("organizations", {
  id: id(),
  name: text("name").notNull(),
  currency: text("currency").notNull().default("USD"),
  email: text("email"),
  phone: text("phone"),
  address: text("address"),
  invoicePrefix: text("invoice_prefix").notNull().default("INV-"),
  nextInvoiceNumber: integer("next_invoice_number").notNull().default(1),
  defaultPaymentTermsDays: integer("default_payment_terms_days").notNull().default(14),
  defaultNotes: text("default_notes"),
  defaultTerms: text("default_terms"),
  createdAt: createdAt(),
});

export const users = pgTable(
  "users",
  {
    id: id(),
    email: text("email").notNull(),
    name: text("name").notNull(),
    passwordHash: text("password_hash").notNull(),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex("users_email_idx").on(t.email)],
);

export const memberships = pgTable(
  "memberships",
  {
    id: id(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    orgId: text("org_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    role: roleEnum("role").notNull().default("admin"),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex("memberships_user_org_idx").on(t.userId, t.orgId), index("memberships_org_idx").on(t.orgId)],
);

export const clients = pgTable(
  "clients",
  {
    id: id(),
    orgId: text("org_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    company: text("company"),
    email: text("email"),
    phone: text("phone"),
    address: text("address"),
    notes: text("notes"),
    archivedAt: timestamp("archived_at", { withTimezone: true }),
    createdAt: createdAt(),
  },
  (t) => [index("clients_org_idx").on(t.orgId)],
);

export const taxSettings = pgTable(
  "tax_settings",
  {
    id: id(),
    orgId: text("org_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    rateBps: integer("rate_bps").notNull(),
    isDefault: boolean("is_default").notNull().default(false),
    createdAt: createdAt(),
  },
  (t) => [index("tax_settings_org_idx").on(t.orgId)],
);

export const categories = pgTable(
  "categories",
  {
    id: id(),
    orgId: text("org_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    color: text("color").notNull().default("#64748b"),
    createdAt: createdAt(),
  },
  (t) => [index("categories_org_idx").on(t.orgId)],
);

export const invoices = pgTable(
  "invoices",
  {
    id: id(),
    orgId: text("org_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    clientId: text("client_id")
      .notNull()
      .references(() => clients.id, { onDelete: "restrict" }),
    number: text("number").notNull(),
    status: invoiceStatusEnum("status").notNull().default("draft"),
    issueDate: date("issue_date").notNull(),
    dueDate: date("due_date").notNull(),
    discountType: discountTypeEnum("discount_type").notNull().default("percent"),
    /** basis points when percent, cents when fixed */
    discountValue: integer("discount_value").notNull().default(0),
    taxName: text("tax_name"),
    taxRateBps: integer("tax_rate_bps").notNull().default(0),
    notes: text("notes"),
    terms: text("terms"),
    shareToken: text("share_token")
      .notNull()
      .$defaultFn(() => nanoid(24)),
    subtotalCents: integer("subtotal_cents").notNull().default(0),
    discountCents: integer("discount_cents").notNull().default(0),
    taxCents: integer("tax_cents").notNull().default(0),
    totalCents: integer("total_cents").notNull().default(0),
    paidCents: integer("paid_cents").notNull().default(0),
    sentAt: timestamp("sent_at", { withTimezone: true }),
    viewedAt: timestamp("viewed_at", { withTimezone: true }),
    createdAt: createdAt(),
  },
  (t) => [
    index("invoices_org_idx").on(t.orgId),
    index("invoices_client_idx").on(t.clientId),
    uniqueIndex("invoices_org_number_idx").on(t.orgId, t.number),
    uniqueIndex("invoices_share_token_idx").on(t.shareToken),
  ],
);

export const invoiceItems = pgTable(
  "invoice_items",
  {
    id: id(),
    invoiceId: text("invoice_id")
      .notNull()
      .references(() => invoices.id, { onDelete: "cascade" }),
    position: integer("position").notNull().default(0),
    description: text("description").notNull(),
    /** hundredths of a unit */
    quantity: integer("quantity").notNull(),
    rateCents: integer("rate_cents").notNull(),
    amountCents: integer("amount_cents").notNull(),
  },
  (t) => [index("invoice_items_invoice_idx").on(t.invoiceId)],
);

export const payments = pgTable(
  "payments",
  {
    id: id(),
    orgId: text("org_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    invoiceId: text("invoice_id")
      .notNull()
      .references(() => invoices.id, { onDelete: "cascade" }),
    amountCents: integer("amount_cents").notNull(),
    paidAt: date("paid_at").notNull(),
    method: paymentMethodEnum("method").notNull().default("bank_transfer"),
    reference: text("reference"),
    createdAt: createdAt(),
  },
  (t) => [index("payments_invoice_idx").on(t.invoiceId), index("payments_org_paid_idx").on(t.orgId, t.paidAt)],
);

export const expenses = pgTable(
  "expenses",
  {
    id: id(),
    orgId: text("org_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    categoryId: text("category_id").references(() => categories.id, { onDelete: "set null" }),
    vendor: text("vendor").notNull(),
    description: text("description"),
    amountCents: integer("amount_cents").notNull(),
    date: date("date").notNull(),
    createdAt: createdAt(),
  },
  (t) => [index("expenses_org_date_idx").on(t.orgId, t.date)],
);

export const activityLogs = pgTable(
  "activity_logs",
  {
    id: id(),
    orgId: text("org_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    userId: text("user_id").references(() => users.id, { onDelete: "set null" }),
    entityType: text("entity_type").notNull(),
    entityId: text("entity_id").notNull(),
    action: text("action").notNull(),
    meta: jsonb("meta").$type<Record<string, unknown>>(),
    createdAt: createdAt(),
  },
  (t) => [index("activity_org_created_idx").on(t.orgId, t.createdAt), index("activity_entity_idx").on(t.entityType, t.entityId)],
);

// ---------- relations ----------

export const organizationsRelations = relations(organizations, ({ many }) => ({
  memberships: many(memberships),
  clients: many(clients),
  invoices: many(invoices),
}));

export const membershipsRelations = relations(memberships, ({ one }) => ({
  user: one(users, { fields: [memberships.userId], references: [users.id] }),
  org: one(organizations, { fields: [memberships.orgId], references: [organizations.id] }),
}));

export const clientsRelations = relations(clients, ({ many }) => ({
  invoices: many(invoices),
}));

export const invoicesRelations = relations(invoices, ({ one, many }) => ({
  client: one(clients, { fields: [invoices.clientId], references: [clients.id] }),
  org: one(organizations, { fields: [invoices.orgId], references: [organizations.id] }),
  items: many(invoiceItems),
  payments: many(payments),
}));

export const invoiceItemsRelations = relations(invoiceItems, ({ one }) => ({
  invoice: one(invoices, { fields: [invoiceItems.invoiceId], references: [invoices.id] }),
}));

export const paymentsRelations = relations(payments, ({ one }) => ({
  invoice: one(invoices, { fields: [payments.invoiceId], references: [invoices.id] }),
}));

export const expensesRelations = relations(expenses, ({ one }) => ({
  category: one(categories, { fields: [expenses.categoryId], references: [categories.id] }),
}));

export type Organization = typeof organizations.$inferSelect;
export type User = typeof users.$inferSelect;
export type Client = typeof clients.$inferSelect;
export type Invoice = typeof invoices.$inferSelect;
export type InvoiceItem = typeof invoiceItems.$inferSelect;
export type Payment = typeof payments.$inferSelect;
export type Expense = typeof expenses.$inferSelect;
export type Category = typeof categories.$inferSelect;
export type TaxSetting = typeof taxSettings.$inferSelect;
export type Role = (typeof roleEnum.enumValues)[number];
