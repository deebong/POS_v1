import { and, asc, desc, eq, gte, sql } from "drizzle-orm";
import { db } from "@/db";
import { products, saleItems, sales } from "@/db/schema";
import { ensureSeeded } from "@/lib/seed";
import { localDayKey, parseTz, startOfLocalDay } from "@/lib/time";
import { num, round2, serializeProduct, serializeSale } from "@/lib/util";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  await ensureSeeded();
  const tz = parseTz(new URL(req.url).searchParams.get("tz"));

  const since14 = startOfLocalDay(tz, 13);
  const since7 = startOfLocalDay(tz, 6);

  const saleRows = await db
    .select()
    .from(sales)
    .where(and(eq(sales.status, "completed"), gte(sales.createdAt, since14)));

  const itemRows = await db
    .select({
      name: saleItems.name,
      emoji: saleItems.emoji,
      unit: saleItems.unit,
      qty: saleItems.qty,
      lineSubtotal: saleItems.lineSubtotal,
      createdAt: sales.createdAt,
    })
    .from(saleItems)
    .innerJoin(sales, eq(sales.id, saleItems.saleId))
    .where(and(eq(sales.status, "completed"), gte(sales.createdAt, since7)));

  // Day buckets (oldest -> newest) for the last 14 days
  const keys: string[] = [];
  for (let d = 13; d >= 0; d--) keys.push(localDayKey(startOfLocalDay(tz, d), tz));
  const buckets = new Map(keys.map((k) => [k, { date: k, revenue: 0, orders: 0, items: 0 }]));

  for (const s of saleRows) {
    const b = buckets.get(localDayKey(s.createdAt, tz));
    if (b) {
      b.revenue += num(s.total);
      b.orders += 1;
    }
  }
  for (const it of itemRows) {
    const b = buckets.get(localDayKey(it.createdAt, tz));
    if (b) b.items += it.unit === "kg" || it.unit === "l" ? 1 : num(it.qty);
  }

  const all = keys.map((k) => {
    const b = buckets.get(k)!;
    return { ...b, revenue: round2(b.revenue) };
  });
  const series = all.slice(7);
  const today = all[13];
  const yesterday = all[12];
  const weekRevenue = round2(series.reduce((s, d) => s + d.revenue, 0));
  const prevWeekRevenue = round2(all.slice(0, 7).reduce((s, d) => s + d.revenue, 0));
  const weekOrders = series.reduce((s, d) => s + d.orders, 0);

  // Top products (7 days)
  const top = new Map<string, { name: string; emoji: string; unit: string; qty: number; revenue: number }>();
  for (const it of itemRows) {
    const t = top.get(it.name) ?? { name: it.name, emoji: it.emoji, unit: it.unit, qty: 0, revenue: 0 };
    t.qty += num(it.qty);
    t.revenue += num(it.lineSubtotal);
    top.set(it.name, t);
  }
  const topProducts = [...top.values()]
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 6)
    .map((t) => ({ ...t, qty: Math.round(t.qty * 100) / 100, revenue: round2(t.revenue) }));

  // Payment split (7 days)
  const split: Record<string, { method: string; revenue: number; count: number }> = {};
  for (const s of saleRows) {
    if (s.createdAt < since7) continue;
    const e = (split[s.paymentMethod] ??= { method: s.paymentMethod, revenue: 0, count: 0 });
    e.revenue += num(s.total);
    e.count += 1;
  }
  const paymentSplit = Object.values(split).map((e) => ({ ...e, revenue: round2(e.revenue) }));

  // Inventory
  const lowStock = await db
    .select()
    .from(products)
    .where(and(eq(products.isActive, true), sql`${products.stock} <= ${products.reorderLevel}`))
    .orderBy(asc(sql`${products.stock} / nullif(${products.reorderLevel}, 0)`), asc(products.name))
    .limit(8);

  const [inv] = await db
    .select({
      total: sql<number>`count(*)`,
      stockValue: sql<string>`coalesce(sum(${products.stock} * ${products.cost}), 0)`,
      retailValue: sql<string>`coalesce(sum(${products.stock} * ${products.price}), 0)`,
      low: sql<number>`count(*) filter (where ${products.stock} <= ${products.reorderLevel} and ${products.stock} > 0)`,
      out: sql<number>`count(*) filter (where ${products.stock} <= 0)`,
    })
    .from(products)
    .where(eq(products.isActive, true));

  const recent = await db
    .select({
      sale: sales,
      itemCount: sql<number>`(select count(*)::int from sale_items si where si.sale_id = "sales"."id")`,
    })
    .from(sales)
    .orderBy(desc(sales.createdAt), desc(sales.id))
    .limit(7);

  return Response.json({
    today: {
      revenue: today.revenue,
      orders: today.orders,
      items: Math.round(today.items * 100) / 100,
      avgOrder: today.orders ? round2(today.revenue / today.orders) : 0,
    },
    yesterday: {
      revenue: yesterday.revenue,
      orders: yesterday.orders,
      items: Math.round(yesterday.items * 100) / 100,
      avgOrder: yesterday.orders ? round2(yesterday.revenue / yesterday.orders) : 0,
    },
    week: { revenue: weekRevenue, prevRevenue: prevWeekRevenue, orders: weekOrders },
    series,
    topProducts,
    paymentSplit,
    lowStock: lowStock.map(serializeProduct),
    inventory: {
      total: Number(inv.total),
      stockValue: round2(num(inv.stockValue)),
      retailValue: round2(num(inv.retailValue)),
      low: Number(inv.low),
      out: Number(inv.out),
    },
    recent: recent.map((r) => ({ ...serializeSale(r.sale), itemCount: Number(r.itemCount) })),
  });
}