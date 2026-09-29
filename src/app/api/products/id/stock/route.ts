import { eq } from "drizzle-orm";
import { db } from "@/db";
import { products, stockMovements } from "@/db/schema";
import { jsonError, num, round3, serializeProduct } from "@/lib/util";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(req: Request, ctx: Ctx) {
  const { id: rawId } = await ctx.params;
  const id = Number(rawId);
  if (!Number.isInteger(id) || id <= 0) return jsonError("Invalid product id");

  const body = (await req.json().catch(() => null)) as {
    mode?: string;
    quantity?: unknown;
    reason?: string;
  } | null;
  if (!body) return jsonError("Invalid request body");

  const mode = body.mode === "remove" || body.mode === "set" ? body.mode : "add";
  const qty = Number(body.quantity);
  if (!Number.isFinite(qty) || qty < 0 || (mode !== "set" && qty === 0)) {
    return jsonError("Enter a valid quantity");
  }
  const reason = typeof body.reason === "string" && body.reason.trim() ? body.reason.trim().slice(0, 80) : null;

  try {
    const updated = await db.transaction(async (tx) => {
      const [current] = await tx.select().from(products).where(eq(products.id, id)).for("update");
      if (!current) throw new Error("NOT_FOUND");
      const before = num(current.stock);
      const after = mode === "add" ? before + qty : mode === "remove" ? before - qty : qty;
      if (after < 0) throw new Error("NEGATIVE");
      const change = round3(after - before);
      const [row] = await tx
        .update(products)
        .set({ stock: String(round3(after)), updatedAt: new Date() })
        .where(eq(products.id, id))
        .returning();
      if (change !== 0) {
        await tx.insert(stockMovements).values({
          productId: id,
          change: String(change),
          reason: mode === "add" ? "restock" : "adjustment",
          reference: reason,
          createdAt: new Date(),
        });
      }
      return row;
    });
    return Response.json({ product: serializeProduct(updated) });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "";
    if (msg === "NOT_FOUND") return jsonError("Product not found", 404);
    if (msg === "NEGATIVE") return jsonError("Stock cannot go below zero", 400);
    console.error(e);
    return jsonError("Could not adjust stock", 500);
  }
}