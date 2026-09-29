import { getSettings, saveSettings, type StoreSettings } from "@/lib/settings";
import { jsonError } from "@/lib/util";

export const dynamic = "force-dynamic";

export async function GET() {
  return Response.json({ settings: await getSettings() });
}

export async function PUT(req: Request) {
  const body = (await req.json().catch(() => null)) as Partial<StoreSettings> | null;
  if (!body || typeof body !== "object") return jsonError("Invalid request body");
  if (typeof body.storeName === "string" && !body.storeName.trim()) return jsonError("Store name is required");
  return Response.json({ settings: await saveSettings(body) });
}