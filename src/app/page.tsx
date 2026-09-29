import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

// The POS UI is a plain HTML/CSS/JS app served from /public/pos.
// `/` is rewritten to it in next.config.ts; this is only a fallback.
export default function HomePage() {
  redirect("/pos/index.html");
}