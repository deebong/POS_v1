import { round2, round3 } from "./util";

export function dbErrorCode(e: unknown): string | undefined {
  const err = e as { code?: string; cause?: { code?: string } } | null;
  return err?.code ?? err?.cause?.code;
}

type Body = Record<string, unknown>;

const str = (v: unknown, max = 120) => (typeof v === "string" ? v.trim().slice(0, max) : "");
const numOr = (v: unknown, fallback: number) => {
  if (v === "" || v === null || v === undefined) return fallback;
  const n = Number(v);
  return Number.isFinite(n) ? n : NaN;
};

export type ProductInput = {
  sku: string;
  barcode: string | null;
  name: string;
  category: string;
  emoji: string;
  unit: string;
  price: string;
  cost: string;
  taxRate: string;
  reorderLevel: string;
  isActive: boolean;
  stock: string;
};

export function parseProductBody(body: Body): { data?: ProductInput; error?: string } {
  const name = str(body.name);
  if (!name) return { error: "Product name is required" };

  const price = numOr(body.price, 0);
  const cost = numOr(body.cost, 0);
  const taxRate = numOr(body.taxRate, 0);
  const stock = numOr(body.stock, 0);
  const reorderLevel = numOr(body.reorderLevel, 10);
  if ([price, cost, taxRate, stock, reorderLevel].some((n) => Number.isNaN(n))) {
    return { error: "Price, cost, tax, stock and reorder level must be valid numbers" };
  }
  if (price < 0 || cost < 0 || stock < 0 || reorderLevel < 0) return { error: "Numbers cannot be negative" };
  if (taxRate < 0 || taxRate > 100) return { error: "Tax rate must be between 0 and 100" };

  const unit = str(body.unit, 12).toLowerCase() || "pc";
  let sku = str(body.sku, 40).toUpperCase();
  if (!sku) sku = "P-" + Date.now().toString(36).toUpperCase();
  const barcode = str(body.barcode, 40) || null;

  return {
    data: {
      sku,
      barcode,
      name,
      category: str(body.category, 60) || "General",
      emoji: str(body.emoji, 8) || "🛒",
      unit,
      price: String(round2(price)),
      cost: String(round2(cost)),
      taxRate: String(round2(taxRate)),
      reorderLevel: String(round3(reorderLevel)),
      isActive: body.isActive === undefined ? true : Boolean(body.isActive),
      stock: String(round3(stock)),
    },
  };
}