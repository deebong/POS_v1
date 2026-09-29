import { and, asc, eq, ilike, or, sql } from "drizzle-orm";
import { db } from "@/db";
import { products, stockMovements } from "@/db/schema";
import { ensureSeeded } from "@/lib/seed";
import { dbErrorCode, parseProductBody } from "@/lib/products";
import { jsonError, serializeProduct } from "@/lib/util";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  await ensureSeeded();
  const url = new URL(req.url);
  const search = url.searchParams.get("search")?.trim();
  const category = url.searchParams.get("category")?.trim();
  const status = url.searchParams.get("status");
  const includeInactive = url.searchParams.get("includeInactive") === "1";

  const conds = [];
  if (!includeInactive) conds.push(eq(products.isActive, true));
  if (category && category !== "all") conds.push(eq(products.category, category));
  if (search) {
    const like = `%${search.replace(/[%_]/g, "")}%`;
    conds.push(or(ilike(products.name, like), ilike(products.sku, like), ilike(products.barcode, like)));
  }
  if (status === "low") conds.push(sql`${products.stock} <= ${products.reorderLevel} and ${products.stock} > 0`);
  if (status === "out") conds.push(sql`${products.stock} <= 0`);

  const rows = await db
    .select()
    .from(products)
    .where(conds.length ? and(...conds) : undefined)
    .orderBy(asc(products.category), asc(products.name));

  return Response.json({ products: rows.map(serializeProduct) });
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  if (!body || typeof body !== "object") return jsonError("Invalid request body");
  const { data, error } = parseProductBody(body as Record<string, unknown>);
  if (!data) return jsonError(error ?? "Invalid product");

  try {
    const created = await db.transaction(async (tx) => {
      const now = new Date();
      const [row] = await tx
        .insert(products)
        .values({ ...data, createdAt: now, updatedAt: now })
        .returning();
      if (Number(data.stock) > 0) {
        await tx.insert(stockMovements).values({
          productId: row.id,
          change: data.stock,
          reason: "initial",
          reference: "Opening stock",
          createdAt: now,
        });
      }
      return row;
    });
    return Response.json({ product: serializeProduct(created) }, { status: 201 });
  } catch (e) {
    if (dbErrorCode(e) === "23505") return jsonError("A product with this SKU or barcode already exists", 409);
    console.error(e);
    return jsonError("Could not create product", 500);
  }
}