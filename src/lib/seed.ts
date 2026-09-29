import { eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { products, saleItems, sales, settings, stockMovements } from "@/db/schema";
import { calcTotals, round2 } from "./util";

// sku, name, category, emoji, unit, price, cost, taxRate, stock, reorderLevel
type Seed = [string, string, string, string, string, number, number, number, number, number];

const SEED_PRODUCTS: Seed[] = [
  ["FV-1001", "Bananas", "Fruits & Veg", "🍌", "kg", 0.79, 0.45, 0, 62, 15],
  ["FV-1002", "Red Apples", "Fruits & Veg", "🍎", "kg", 2.49, 1.6, 0, 48, 15],
  ["FV-1003", "Vine Tomatoes", "Fruits & Veg", "🍅", "kg", 1.99, 1.1, 0, 35, 12],
  ["FV-1004", "Carrots", "Fruits & Veg", "🥕", "kg", 1.29, 0.7, 0, 40, 12],
  ["FV-1005", "Potatoes", "Fruits & Veg", "🥔", "kg", 1.1, 0.6, 0, 90, 20],
  ["FV-1006", "Broccoli", "Fruits & Veg", "🥦", "pc", 1.79, 1.0, 0, 26, 8],
  ["FV-1007", "Ripe Avocado", "Fruits & Veg", "🥑", "pc", 1.25, 0.7, 0, 7, 10],
  ["FV-1008", "Lemons", "Fruits & Veg", "🍋", "kg", 3.2, 2.1, 0, 14, 5],
  ["FV-1009", "Strawberries 250g", "Fruits & Veg", "🍓", "pack", 3.49, 2.2, 0, 18, 8],
  ["FV-1010", "Red Onions", "Fruits & Veg", "🧅", "kg", 0.99, 0.5, 0, 55, 15],
  ["DA-2001", "Whole Milk 1L", "Dairy & Eggs", "🥛", "pc", 1.15, 0.8, 0, 84, 24],
  ["DA-2002", "Mature Cheddar 200g", "Dairy & Eggs", "🧀", "pack", 3.99, 2.6, 0, 4, 10],
  ["DA-2003", "Free Range Eggs (12)", "Dairy & Eggs", "🥚", "pack", 3.29, 2.3, 0, 46, 12],
  ["DA-2004", "Greek Yogurt 500g", "Dairy & Eggs", "🥣", "pc", 1.49, 0.9, 0, 32, 10],
  ["DA-2005", "Salted Butter 250g", "Dairy & Eggs", "🧈", "pack", 2.79, 1.9, 0, 28, 8],
  ["BK-3001", "Sourdough Loaf", "Bakery", "🍞", "pc", 3.5, 1.7, 0, 16, 6],
  ["BK-3002", "Butter Croissant", "Bakery", "🥐", "pc", 1.2, 0.5, 0, 30, 10],
  ["BK-3003", "Bagels (4 pack)", "Bakery", "🥯", "pack", 2.6, 1.3, 0, 12, 6],
  ["BK-3004", "French Baguette", "Bakery", "🥖", "pc", 1.4, 0.6, 0, 0, 8],
  ["MS-4001", "Chicken Breast", "Meat & Seafood", "🍗", "kg", 7.99, 5.2, 0, 22, 8],
  ["MS-4002", "Lean Ground Beef", "Meat & Seafood", "🥩", "kg", 9.49, 6.6, 0, 18, 8],
  ["MS-4003", "Atlantic Salmon", "Meat & Seafood", "🐟", "kg", 16.99, 11.5, 0, 3.5, 5],
  ["MS-4004", "Smoked Bacon 200g", "Meat & Seafood", "🥓", "pack", 4.99, 3.2, 0, 20, 8],
  ["BV-5001", "Orange Juice 1L", "Beverages", "🍊", "pc", 2.99, 1.8, 0, 38, 12],
  ["BV-5002", "Sparkling Water 1.5L", "Beverages", "💧", "pc", 0.99, 0.4, 0, 120, 30],
  ["BV-5003", "Cola 330ml", "Beverages", "🥤", "pc", 1.1, 0.55, 8, 96, 30],
  ["BV-5004", "Green Tea (40 bags)", "Beverages", "🍵", "pack", 3.29, 1.9, 0, 25, 8],
  ["BV-5005", "Ground Coffee 250g", "Beverages", "☕", "pack", 5.49, 3.4, 0, 21, 8],
  ["BV-5006", "Energy Drink 250ml", "Beverages", "⚡", "pc", 1.99, 1.0, 8, 9, 12],
  ["SN-6001", "Salted Potato Chips", "Snacks", "🍟", "pc", 1.79, 0.9, 8, 58, 15],
  ["SN-6002", "Dark Chocolate 100g", "Snacks", "🍫", "pc", 2.29, 1.2, 8, 44, 12],
  ["SN-6003", "Roasted Peanuts 200g", "Snacks", "🥜", "pack", 1.99, 1.1, 0, 35, 10],
  ["SN-6004", "Microwave Popcorn", "Snacks", "🍿", "pack", 1.59, 0.8, 8, 27, 10],
  ["SN-6005", "Oat Cookies", "Snacks", "🍪", "pack", 2.19, 1.1, 8, 33, 10],
  ["PN-7001", "Basmati Rice 5kg", "Pantry", "🍚", "pack", 9.99, 7.0, 0, 19, 6],
  ["PN-7002", "Spaghetti 500g", "Pantry", "🍝", "pack", 1.39, 0.7, 0, 70, 20],
  ["PN-7003", "Olive Oil 500ml", "Pantry", "🫒", "pc", 6.99, 4.6, 0, 24, 8],
  ["PN-7004", "White Sugar 1kg", "Pantry", "🍬", "pack", 1.25, 0.8, 0, 52, 15],
  ["PN-7005", "Sea Salt 500g", "Pantry", "🧂", "pack", 0.69, 0.3, 0, 41, 10],
  ["PN-7006", "Wildflower Honey", "Pantry", "🍯", "pc", 4.99, 3.0, 0, 15, 6],
  ["PN-7007", "Tomato Ketchup", "Pantry", "🥫", "pc", 2.1, 1.1, 0, 29, 10],
  ["PN-7008", "Breakfast Cereal", "Pantry", "🥣", "pc", 3.99, 2.3, 0, 8, 10],
  ["HH-8001", "Dish Soap 500ml", "Household", "🧴", "pc", 2.49, 1.2, 10, 30, 10],
  ["HH-8002", "Paper Towels (2 rolls)", "Household", "🧻", "pack", 4.49, 2.6, 10, 26, 8],
  ["HH-8003", "Laundry Detergent 2L", "Household", "🧺", "pc", 8.99, 5.5, 10, 14, 6],
  ["HH-8004", "Trash Bags (30)", "Household", "🗑️", "pack", 3.99, 2.0, 10, 22, 8],
  ["PC-9001", "Toothpaste 100ml", "Personal Care", "🪥", "pc", 2.99, 1.5, 10, 36, 10],
  ["PC-9002", "Daily Shampoo 400ml", "Personal Care", "🧴", "pc", 4.99, 2.8, 10, 17, 8],
  ["PC-9003", "Antibacterial Hand Soap", "Personal Care", "🧼", "pc", 1.99, 0.9, 10, 40, 10],
  ["FZ-1101", "Vanilla Ice Cream 1L", "Frozen", "🍨", "pc", 4.49, 2.7, 0, 18, 6],
  ["FZ-1102", "Margherita Pizza", "Frozen", "🍕", "pc", 5.99, 3.4, 0, 13, 6],
  ["FZ-1103", "Garden Peas 900g", "Frozen", "🫛", "pack", 1.89, 1.0, 0, 31, 8],
];

function ean13(base12: string) {
  let sum = 0;
  for (let i = 0; i < 12; i++) sum += Number(base12[i]) * (i % 2 === 0 ? 1 : 3);
  return base12 + ((10 - (sum % 10)) % 10);
}

const rand = (n: number) => Math.floor(Math.random() * n);

/** Populates a fresh database with a demo grocery catalogue and some sales history. Runs once. */
export async function ensureSeeded() {
  const [flag] = await db.select().from(settings).where(eq(settings.key, "seeded"));
  if (flag) return;

  await db.transaction(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(918273)`);
    const [again] = await tx.select().from(settings).where(eq(settings.key, "seeded"));
    if (again) return;

    const now = new Date();

    const inserted = await tx
      .insert(products)
      .values(
        SEED_PRODUCTS.map((s, i) => ({
          sku: s[0],
          barcode: ean13("8901" + String(10000 + i).padStart(8, "0")),
          name: s[1],
          category: s[2],
          emoji: s[3],
          unit: s[4],
          price: String(s[5]),
          cost: String(s[6]),
          taxRate: String(s[7]),
          stock: String(s[8]),
          reorderLevel: String(s[9]),
          createdAt: now,
          updatedAt: now,
        })),
      )
      .returning();

    await tx.insert(stockMovements).values(
      inserted.map((p) => ({
        productId: p.id,
        change: p.stock,
        reason: "initial",
        reference: "Opening stock",
        createdAt: now,
      })),
    );

    // Demo sales history (last 14 days)
    type SaleDraft = {
      row: typeof sales.$inferInsert;
      items: Omit<typeof saleItems.$inferInsert, "saleId">[];
    };
    const drafts: SaleDraft[] = [];
    let seq = 0;
    for (let d = 13; d >= 0; d--) {
      const orders = d === 0 ? 13 : 14 + rand(14);
      for (let i = 0; i < orders; i++) {
        const ts =
          d === 0
            ? new Date(now.getTime() - Math.random() * 6 * 3600_000)
            : new Date(now.getTime() - d * 86400_000 - Math.random() * 12 * 3600_000);
        const picked = new Set<number>();
        const lineCount = 1 + rand(6);
        while (picked.size < lineCount) picked.add(rand(inserted.length));
        const chosen = [...picked].map((idx) => {
          const p = inserted[idx];
          const weighed = p.unit === "kg" || p.unit === "l";
          const qty = weighed ? Math.round((0.3 + Math.random() * 2) * 4) / 4 : 1 + (Math.random() < 0.3 ? rand(3) : 0);
          return { p, qty };
        });
        const useDiscount = Math.random() < 0.1;
        const calc = calcTotals(
          chosen.map(({ p, qty }) => ({ price: Number(p.price), qty, taxRate: Number(p.taxRate) })),
          useDiscount ? "percent" : "none",
          useDiscount ? 10 : 0,
        );
        const r = Math.random();
        const method = r < 0.4 ? "cash" : r < 0.8 ? "card" : "upi";
        const paid = method === "cash" ? Math.ceil(calc.total / 5) * 5 : calc.total;
        drafts.push({
          row: {
            invoiceNo: `TMP-${++seq}`,
            customerName: Math.random() < 0.25 ? "Walk-in customer" : null,
            subtotal: String(calc.subtotal),
            discount: String(calc.discount),
            tax: String(calc.tax),
            total: String(calc.total),
            paymentMethod: method,
            amountPaid: String(paid),
            changeDue: String(round2(paid - calc.total)),
            status: "completed",
            createdAt: ts,
          },
          items: chosen.map(({ p, qty }, k) => ({
            productId: p.id,
            name: p.name,
            sku: p.sku,
            emoji: p.emoji,
            unit: p.unit,
            price: p.price,
            qty: String(qty),
            taxRate: p.taxRate,
            lineSubtotal: String(calc.lines[k].lineSubtotal),
            lineTax: String(calc.lines[k].lineTax),
          })),
        });
      }
    }

    const saleRows = await tx
      .insert(sales)
      .values(drafts.map((d) => d.row))
      .returning({ id: sales.id });

    const itemRows = drafts.flatMap((d, i) => d.items.map((it) => ({ ...it, saleId: saleRows[i].id })));
    if (itemRows.length) await tx.insert(saleItems).values(itemRows);

    await tx.execute(
      sql`update sales set invoice_no = 'INV-' || to_char(created_at, 'YYYYMMDD') || '-' || lpad(id::text, 5, '0') where invoice_no like 'TMP-%'`,
    );

    await tx.insert(settings).values({ key: "seeded", value: "1" });
  });
}