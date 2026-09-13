import { NextRequest, NextResponse } from "next/server";
import { SESSION_COOKIE, verifySessionToken } from "@/lib/session";

// Next 16 renamed Middleware to Proxy; same job, same matcher.
export async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;
  if (pathname === "/admin/login") return NextResponse.next();

  const secret = process.env.SESSION_SECRET;
  const token = req.cookies.get(SESSION_COOKIE)?.value;
  const ok = secret ? await verifySessionToken(token, secret) : false;
  if (!ok) {
    const url = req.nextUrl.clone();
    url.pathname = "/admin/login";
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/admin/:path*"],
};
