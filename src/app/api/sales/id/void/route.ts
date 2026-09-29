import { asc, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { products, saleItems, sales, stockMovements } from "@/db/schema";
import { jsonError, serializeSale, serializeSaleItem } from "@/lib/util";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(_req: Request, ctx: Ctx) {
  const { id: raw } = await ctx.params;
  const id = Number(raw);
  if (!Number.isInteger(id) || id <= 0) return jsonError("Invalid sale id");

  try {
    const result = await db.transaction(async (tx) => {
      const [sale] = await tx.select().from(sales).where(eq(sales.id, id)).for("update");
      if (!sale) throw new Error("NOT_FOUND");
      if (sale.status === "voided") throw new Error("ALREADY");

      const items = await tx.select().from(saleItems).where(eq(saleItems.saleId, id)).orderBy(asc(saleItems.id));
      const now = new Date();
      for (const it of items) {
        if (!it.productId) continue;
        await tx
          .update(products)
          .set({ stock: sql`${products.stock} + ${it.qty}::numeric`, updatedAt: now })
          .where(eq(products.id, it.productId));
        await tx.insert(stockMovements).values({
          productId: it.productId,
          change: it.qty,
          reason: "void",
          reference: sale.invoiceNo,
          createdAt: now,
        });
      }
      const [updated] = await tx
        .update(sales)
        .set({ status: "voided", voidedAt: now })
        .where(eq(sales.id, id))
        .returning();
      return { sale: updated, items };
    });
    return Response.json({ sale: serializeSale(result.sale), items: result.items.map(serializeSaleItem) });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "";
    if (msg === "NOT_FOUND") return jsonError("Invoice not found", 404);
    if (msg === "ALREADY") return jsonError("This invoice is already voided", 409);
    console.error(e);
    return jsonError("Could not void invoice", 500);
  }
}