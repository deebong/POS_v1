import {
  boolean,
  index,
  integer,
  numeric,
  pgTable,
  serial,
  text,
  timestamp,
} from "drizzle-orm/pg-core";

export const products = pgTable(
  "products",
  {
    id: serial("id").primaryKey(),
    sku: text("sku").notNull().unique(),
    barcode: text("barcode").unique(),
    name: text("name").notNull(),
    category: text("category").notNull().default("General"),
    emoji: text("emoji").notNull().default("🛒"),
    unit: text("unit").notNull().default("pc"),
    price: numeric("price", { precision: 10, scale: 2 }).notNull().default("0"),
    cost: numeric("cost", { precision: 10, scale: 2 }).notNull().default("0"),
    taxRate: numeric("tax_rate", { precision: 5, scale: 2 }).notNull().default("0"),
    stock: numeric("stock", { precision: 12, scale: 3 }).notNull().default("0"),
    reorderLevel: numeric("reorder_level", { precision: 12, scale: 3 }).notNull().default("10"),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (t) => [index("products_category_idx").on(t.category), index("products_name_idx").on(t.name)],
);

export const sales = pgTable(
  "sales",
  {
    id: serial("id").primaryKey(),
    invoiceNo: text("invoice_no").notNull().unique(),
    customerName: text("customer_name"),
    customerPhone: text("customer_phone"),
    subtotal: numeric("subtotal", { precision: 12, scale: 2 }).notNull().default("0"),
    discount: numeric("discount", { precision: 12, scale: 2 }).notNull().default("0"),
    tax: numeric("tax", { precision: 12, scale: 2 }).notNull().default("0"),
    total: numeric("total", { precision: 12, scale: 2 }).notNull().default("0"),
    paymentMethod: text("payment_method").notNull().default("cash"),
    amountPaid: numeric("amount_paid", { precision: 12, scale: 2 }).notNull().default("0"),
    changeDue: numeric("change_due", { precision: 12, scale: 2 }).notNull().default("0"),
    status: text("status").notNull().default("completed"),
    note: text("note"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    voidedAt: timestamp("voided_at"),
  },
  (t) => [index("sales_created_idx").on(t.createdAt)],
);

export const saleItems = pgTable(
  "sale_items",
  {
    id: serial("id").primaryKey(),
    saleId: integer("sale_id")
      .notNull()
      .references(() => sales.id, { onDelete: "cascade" }),
    productId: integer("product_id").references(() => products.id, { onDelete: "set null" }),
    name: text("name").notNull(),
    sku: text("sku").notNull(),
    emoji: text("emoji").notNull().default("🛒"),
    unit: text("unit").notNull().default("pc"),
    price: numeric("price", { precision: 10, scale: 2 }).notNull(),
    qty: numeric("qty", { precision: 12, scale: 3 }).notNull(),
    taxRate: numeric("tax_rate", { precision: 5, scale: 2 }).notNull().default("0"),
    lineSubtotal: numeric("line_subtotal", { precision: 12, scale: 2 }).notNull(),
    lineTax: numeric("line_tax", { precision: 12, scale: 2 }).notNull().default("0"),
  },
  (t) => [index("sale_items_sale_idx").on(t.saleId), index("sale_items_product_idx").on(t.productId)],
);

export const stockMovements = pgTable(
  "stock_movements",
  {
    id: serial("id").primaryKey(),
    productId: integer("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "cascade" }),
    change: numeric("change", { precision: 12, scale: 3 }).notNull(),
    reason: text("reason").notNull(),
    reference: text("reference"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [index("stock_movements_product_idx").on(t.productId)],
);

export const settings = pgTable("settings", {
  key: text("key").primaryKey(),
  value: text("value").notNull().default(""),
});