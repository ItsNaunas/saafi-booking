import { NextRequest, NextResponse } from "next/server";
import { verifyUnsubscribe, fromB64url } from "@/lib/unsubscribe";
import { suppressEmail } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * RFC 8058 one-click unsubscribe: Gmail/Yahoo POST here from their own
 * "Unsubscribe" button using the List-Unsubscribe header's URL. Only POST
 * unsubscribes — a GET is what link scanners do.
 */
export async function POST(req: NextRequest) {
  const e = req.nextUrl.searchParams.get("e") ?? "";
  const t = req.nextUrl.searchParams.get("t");
  let email = "";
  try {
    email = fromB64url(e).toLowerCase();
  } catch {
    /* fall through to 400 */
  }
  if (!email || !(await verifyUnsubscribe(email, t))) {
    return NextResponse.json({ ok: false }, { status: 400 });
  }
  try {
    await suppressEmail(email, "one-click");
  } catch (err) {
    console.error("[unsubscribe] failed:", String(err).slice(0, 200));
    return NextResponse.json({ ok: false }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}

export async function GET(req: NextRequest) {
  // Someone opened the header URL in a browser: send them to the page with a button.
  const url = req.nextUrl.clone();
  url.pathname = "/unsubscribe";
  return NextResponse.redirect(url);
}
