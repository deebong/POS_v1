import QRCode from "qrcode";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const data = url.searchParams.get("data") ?? "";
  if (!data || data.length > 600) {
    return Response.json({ error: "Provide `data` (max 600 chars)" }, { status: 400 });
  }
  const format = url.searchParams.get("format") === "png" ? "png" : "svg";
  const size = Math.min(Math.max(Number(url.searchParams.get("size")) || 320, 96), 1200);
  const filename = (url.searchParams.get("name") || "qr").replace(/[^a-z0-9_-]/gi, "_").slice(0, 60);
  const disposition = url.searchParams.get("download") === "1" ? `attachment; filename="${filename}.${format}"` : "inline";

  const headers: Record<string, string> = {
    "Cache-Control": "public, max-age=86400",
    "Content-Disposition": disposition,
  };

  if (format === "png") {
    const buf = await QRCode.toBuffer(data, { width: size, margin: 2, errorCorrectionLevel: "M" });
    return new Response(new Uint8Array(buf), { headers: { ...headers, "Content-Type": "image/png" } });
  }
  const svg = await QRCode.toString(data, { type: "svg", margin: 1, errorCorrectionLevel: "M" });
  return new Response(svg, { headers: { ...headers, "Content-Type": "image/svg+xml; charset=utf-8" } });
}