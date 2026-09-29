import { and, desc, eq, gte, ilike, inArray, or, sql } from "drizzle-orm";
import { db } from "@/db";
import { products, saleItems, sales, stockMovements } from "@/db/schema";
import { ensureSeeded } from "@/lib/seed";
import { parseTz, startOfLocalDay } from "@/lib/time";
import {
  calcTotals,
  invoiceNumber,
  jsonError,
  num,
  round2,
  round3,
  serializeSale,
  serializeSaleItem,
  type DiscountType,
} from "@/lib/util";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  await ensureSeeded();
  const url = new URL(req.url);
  const range = url.searchParams.get("range") ?? "today";
  const search = url.searchParams.get("search")?.trim();
  const method = url.searchParams.get("method");
  const status = url.searchParams.get("status");
  const tz = parseTz(url.searchParams.get("tz"));
  const limit = Math.min(Math.max(Number(url.searchParams.get("limit")) || 200, 1), 500);

  const conds = [];
  if (range === "today") conds.push(gte(sales.createdAt, startOfLocalDay(tz, 0)));
  else if (range === "7d") conds.push(gte(sales.createdAt, startOfLocalDay(tz, 6)));
  else if (range === "30d") conds.push(gte(sales.createdAt, startOfLocalDay(tz, 29)));
  if (method && method !== "all") conds.push(eq(sales.paymentMethod, method));
  if (status && status !== "all") conds.push(eq(sales.status, status));
  if (search) {
    const like = `%${search.replace(/[%_]/g, "")}%`;
    conds.push(or(ilike(sales.invoiceNo, like), ilike(sales.customerName, like), ilike(sales.customerPhone, like)));
  }
  const where = conds.length ? and(...conds) : undefined;

  const rows = await db
    .select({
      sale: sales,
      itemCount: sql<number>`(select count(*)::int from sale_items si where si.sale_id = "sales"."id")`,
    })
    .from(sales)
    .where(where)
    .orderBy(desc(sales.createdAt), desc(sales.id))
    .limit(limit);

  const [summary] = await db
    .select({
      count: sql<number>`count(*)`,
      revenue: sql<string>`coalesce(sum(${sales.total}), 0)`,
    })
    .from(sales)
    .where(and(eq(sales.status, "completed"), ...(where ? [where] : [])));

  return Response.json({
    sales: rows.map((r) => ({ ...serializeSale(r.sale), itemCount: Number(r.itemCount) })),
    summary: { count: Number(summary.count), revenue: num(summary.revenue) },
  });
}

type CheckoutBody = {
  items?: { productId?: unknown; qty?: unknown }[];
  discountType?: string;
  discountValue?: unknown;
  customerName?: unknown;
  customerPhone?: unknown;
  paymentMethod?: unknown;
  amountPaid?: unknown;
  note?: unknown;
};

class CheckoutError extends Error {
  status: number;
  constructor(message: string, status = 400) {
    super(message);
    this.status = status;
  }
}

const cleanText = (v: unknown, max = 80) => (typeof v === "string" && v.trim() ? v.trim().slice(0, max) : null);

export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as CheckoutBody | null;
  if (!body || !Array.isArray(body.items) || body.items.length === 0) return jsonError("Cart is empty");

  // Merge duplicate lines
  const wanted = new Map<number, number>();
  for (const it of body.items) {
    const pid = Number(it.productId);
    const qty = Number(it.qty);
    if (!Number.isInteger(pid) || pid <= 0 || !Number.isFinite(qty) || qty <= 0) {
      return jsonError("Invalid item in cart");
    }
    wanted.set(pid, round3((wanted.get(pid) ?? 0) + qty));
  }

  const discountType: DiscountType =
    body.discountType === "percent" || body.discountType === "amount" ? body.discountType : "none";
  const discountValue = Number(body.discountValue) || 0;
  const paymentMethod = ["cash", "card", "upi"].includes(String(body.paymentMethod))
    ? String(body.paymentMethod)
    : "cash";

  try {
    const result = await db.transaction(async (tx) => {
      const ids = [...wanted.keys()].sort((a, b) => a - b);
      const rows = await tx.select().from(products).where(inArray(products.id, ids)).for("update");
      const byId = new Map(rows.map((r) => [r.id, r]));

      for (const id of ids) {
        const p = byId.get(id);
        const qty = wanted.get(id)!;
        if (!p || !p.isActive) throw new CheckoutError("A product in the cart is no longer available", 409);
        if (num(p.stock) < qty) {
          throw new CheckoutError(`Not enough stock for ${p.name} (available: ${num(p.stock)} ${p.unit})`, 409);
        }
      }

      const lines = ids.map((id) => {
        const p = byId.get(id)!;
        return { p, qty: wanted.get(id)! };
      });
      const calc = calcTotals(
        lines.map(({ p, qty }) => ({ price: num(p.price), qty, taxRate: num(p.taxRate) })),
        discountType,
        discountValue,
      );

      let amountPaid = paymentMethod === "cash" ? Number(body.amountPaid) : calc.total;
      if (!Number.isFinite(amountPaid)) amountPaid = calc.total;
      if (amountPaid + 0.001 < calc.total) throw new CheckoutError("Amount received is less than the total due");
      amountPaid = round2(amountPaid);
      const changeDue = paymentMethod === "cash" ? round2(amountPaid - calc.total) : 0;

      const now = new Date();
      const [sale] = await tx
        .insert(sales)
        .values({
          invoiceNo: `TMP-${now.getTime()}-${Math.random().toString(36).slice(2, 7)}`,
          customerName: cleanText(body.customerName),
          customerPhone: cleanText(body.customerPhone, 24),
          subtotal: String(calc.subtotal),
          discount: String(calc.discount),
          tax: String(calc.tax),
          total: String(calc.total),
          paymentMethod,
          amountPaid: String(amountPaid),
          changeDue: String(changeDue),
          status: "completed",
          note: cleanText(body.note, 200),
          createdAt: now,
        })
        .returning();

      const invoiceNo = invoiceNumber(sale.id, now);
      await tx.update(sales).set({ invoiceNo }).where(eq(sales.id, sale.id));

      const itemRows = await tx
        .insert(saleItems)
        .values(
          lines.map(({ p, qty }, i) => ({
            saleId: sale.id,
            productId: p.id,
            name: p.name,
            sku: p.sku,
            emoji: p.emoji,
            unit: p.unit,
            price: p.price,
            qty: String(qty),
            taxRate: p.taxRate,
            lineSubtotal: String(calc.lines[i].lineSubtotal),
            lineTax: String(calc.lines[i].lineTax),
          })),
        )
        .returning();

      for (const { p, qty } of lines) {
        await tx
          .update(products)
          .set({ stock: sql`${products.stock} - ${String(qty)}::numeric`, updatedAt: now })
          .where(eq(products.id, p.id));
      }
      await tx.insert(stockMovements).values(
        lines.map(({ p, qty }) => ({
          productId: p.id,
          change: String(-qty),
          reason: "sale",
          reference: invoiceNo,
          createdAt: now,
        })),
      );

      return { sale: { ...sale, invoiceNo }, items: itemRows };
    });

    return Response.json(
      { sale: serializeSale(result.sale), items: result.items.map(serializeSaleItem) },
      { status: 201 },
    );
  } catch (e) {
    if (e instanceof CheckoutError) return jsonError(e.message, e.status);
    console.error(e);
    return jsonError("Checkout failed. Please try again.", 500);
  }
}