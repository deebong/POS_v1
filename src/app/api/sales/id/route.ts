import { asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { saleItems, sales } from "@/db/schema";
import { jsonError, serializeSale, serializeSaleItem } from "@/lib/util";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: Request, ctx: Ctx) {
  const { id: raw } = await ctx.params;
  const id = Number(raw);
  if (!Number.isInteger(id) || id <= 0) return jsonError("Invalid sale id");
  const [sale] = await db.select().from(sales).where(eq(sales.id, id));
  if (!sale) return jsonError("Invoice not found", 404);
  const items = await db.select().from(saleItems).where(eq(saleItems.saleId, id)).orderBy(asc(saleItems.id));
  return Response.json({ sale: serializeSale(sale), items: items.map(serializeSaleItem) });
}