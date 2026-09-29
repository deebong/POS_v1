import { db } from "@/db";
import { settings } from "@/db/schema";

export const DEFAULT_SETTINGS = {
  storeName: "FreshMart Grocery",
  address: "42 Market Street, Greenfield",
  phone: "+1 (555) 013-2244",
  taxId: "TAX-00123456",
  currency: "$",
  taxLabel: "Tax",
  upiId: "",
  receiptFooter: "Thank you for shopping with us! Fresh food, every day.",
};

export type StoreSettings = typeof DEFAULT_SETTINGS;

export async function getSettings(): Promise<StoreSettings> {
  const rows = await db.select().from(settings);
  const out: Record<string, string> = { ...DEFAULT_SETTINGS };
  for (const r of rows) {
    if (r.key in DEFAULT_SETTINGS) out[r.key] = r.value;
  }
  return out as StoreSettings;
}

export async function saveSettings(input: Partial<StoreSettings>) {
  for (const key of Object.keys(DEFAULT_SETTINGS) as (keyof StoreSettings)[]) {
    const v = input[key];
    if (typeof v !== "string") continue;
    await db
      .insert(settings)
      .values({ key, value: v.trim().slice(0, 300) })
      .onConflictDoUpdate({ target: settings.key, set: { value: v.trim().slice(0, 300) } });
  }
  return getSettings();
}