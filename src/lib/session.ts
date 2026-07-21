// Signed-cookie admin session. Web Crypto only, so it runs in both the
// Node runtime (server actions) and the Edge runtime (middleware).
// Cookie value: "<expiryMs>.<hmacHex>" — HMAC-SHA256 over the expiry with SESSION_SECRET.

export const SESSION_COOKIE = "saafi_admin";
export const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

async function hmac(payload: string, secret: string): Promise<string> {
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
    .join("");
}

export async function createSessionToken(secret: string): Promise<string> {
  const exp = String(Date.now() + SESSION_TTL_MS);
  return `${exp}.${await hmac(exp, secret)}`;
}

export async function verifySessionToken(token: string | undefined, secret: string): Promise<boolean> {
  if (!token) return false;
  const dot = token.indexOf(".");
  if (dot < 1) return false;
  const exp = token.slice(0, dot);
  const sig = token.slice(dot + 1);
  if (!/^\d+$/.test(exp) || Number(exp) < Date.now()) return false;
  const expected = await hmac(exp, secret);
  // constant-time-ish compare
  if (sig.length !== expected.length) return false;
  let diff = 0;
  for (let i = 0; i < sig.length; i++) diff |= sig.charCodeAt(i) ^ expected.charCodeAt(i);
  return diff === 0;
}
