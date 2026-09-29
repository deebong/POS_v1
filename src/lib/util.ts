import type { products, sales, saleItems } from "@/db/schema";

export const num = (v: unknown): number => {
  const n = Number(v ?? 0);
  return Number.isFinite(n) ? n : 0;
};

export const round2 = (n: number): number => Math.round((n + Number.EPSILON) * 100) / 100;
export const round3 = (n: number): number => Math.round((n + Number.EPSILON) * 1000) / 1000;

export type DiscountType = "none" | "percent" | "amount";

export type CalcInput = { price: number; qty: number; taxRate: number };
export type CalcLine = CalcInput & { lineSubtotal: number; lineTax: number };

/**
 * Shared billing maths. Prices are tax-exclusive; discount is applied to the
 * subtotal and tax is calculated on the discounted amount of each line.
 */
export function calcTotals(lines: CalcInput[], discountType: DiscountType, discountValue: number) {
  const priced = lines.map((l) => ({ ...l, lineSubtotal: round2(l.price * l.qty) }));
  const subtotal = round2(priced.reduce((s, l) => s + l.lineSubtotal, 0));
  let discount = 0;
  if (discountType === "percent") {
    discount = round2((subtotal * Math.min(Math.max(discountValue, 0), 100)) / 100);
  } else if (discountType === "amount") {
    discount = Math.min(round2(Math.max(discountValue, 0)), subtotal);
  }
  const ratio = subtotal > 0 ? discount / subtotal : 0;
  const outLines: CalcLine[] = priced.map((l) => ({
    ...l,
    lineTax: round2(l.lineSubtotal * (1 - ratio) * (l.taxRate / 100)),
  }));
  const tax = round2(outLines.reduce((s, l) => s + l.lineTax, 0));
  const total = round2(subtotal - discount + tax);
  return { lines: outLines, subtotal, discount, tax, total };
}

type ProductRow = typeof products.$inferSelect;
type SaleRow = typeof sales.$inferSelect;
type SaleItemRow = typeof saleItems.$inferSelect;

export function serializeProduct(p: ProductRow) {
  return {
    id: p.id,
    sku: p.sku,
    barcode: p.barcode,
    name: p.name,
    category: p.category,
    emoji: p.emoji,
    unit: p.unit,
    price: num(p.price),
    cost: num(p.cost),
    taxRate: num(p.taxRate),
    stock: num(p.stock),
    reorderLevel: num(p.reorderLevel),
    isActive: p.isActive,
    createdAt: p.createdAt.toISOString(),
    updatedAt: p.updatedAt.toISOString(),
  };
}

export function serializeSale(s: SaleRow) {
  return {
    id: s.id,
    invoiceNo: s.invoiceNo,
    customerName: s.customerName,
    customerPhone: s.customerPhone,
    subtotal: num(s.subtotal),
    discount: num(s.discount),
    tax: num(s.tax),
    total: num(s.total),
    paymentMethod: s.paymentMethod,
    amountPaid: num(s.amountPaid),
    changeDue: num(s.changeDue),
    status: s.status,
    note: s.note,
    createdAt: s.createdAt.toISOString(),
    voidedAt: s.voidedAt ? s.voidedAt.toISOString() : null,
  };
}

export function serializeSaleItem(i: SaleItemRow) {
  return {
    id: i.id,
    productId: i.productId,
    name: i.name,
    sku: i.sku,
    emoji: i.emoji,
    unit: i.unit,
    price: num(i.price),
    qty: num(i.qty),
    taxRate: num(i.taxRate),
    lineSubtotal: num(i.lineSubtotal),
    lineTax: num(i.lineTax),
  };
}

export function invoiceNumber(id: number, createdAt: Date) {
  const d = createdAt.toISOString().slice(0, 10).replace(/-/g, "");
  return `INV-${d}-${String(id).padStart(5, "0")}`;
}

export function jsonError(message: string, status = 400) {
  return Response.json({ error: message }, { status });
}