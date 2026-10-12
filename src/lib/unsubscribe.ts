// Signed unsubscribe links for marketing email. The token is an HMAC of the
// address under SESSION_SECRET, so a link can only unsubscribe the address it
// was sent to, and no table of tokens is needed.
//
// Two ways in, both required by Gmail/Yahoo bulk-sender rules:
//   - the footer link -> /unsubscribe page with a button (a GET never
//     unsubscribes, because mail scanners follow every link in an email)
//   - the List-Unsubscribe header -> POST /api/unsubscribe (RFC 8058 one-click)

import { site } from "./business";

const LABEL = "unsubscribe-v1:";

async function hmacHex(payload: string, secret: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(payload));
  return Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("")
    .slice(0, 32);
}

const b64url = (s: string) => Buffer.from(s, "utf8").toString("base64url");
export const fromB64url = (s: string) => Buffer.from(s, "base64url").toString("utf8");

export async function unsubscribeToken(email: string): Promise<string | null> {
  const secret = process.env.SESSION_SECRET;
  return secret ? hmacHex(LABEL + email.toLowerCase(), secret) : null;
}

export async function verifyUnsubscribe(email: string, token: string | null | undefined): Promise<boolean> {
  const expected = await unsubscribeToken(email);
  if (!expected || !token || token.length !== expected.length) return false;
  let diff = 0;
  for (let i = 0; i < token.length; i++) diff |= token.charCodeAt(i) ^ expected.charCodeAt(i);
  return diff === 0;
}

/** Page link (footer) and one-click endpoint (header) for one address. Null pre-config. */
export async function unsubscribeUrls(email: string): Promise<{ page: string; oneClick: string } | null> {
  const t = await unsubscribeToken(email);
  if (!t) return null;
  const base = process.env.NEXT_PUBLIC_SITE_URL ?? site.url;
  const qs = `e=${b64url(email.toLowerCase())}&t=${t}`;
  return { page: `${base}/unsubscribe?${qs}`, oneClick: `${base}/api/unsubscribe?${qs}` };
}
