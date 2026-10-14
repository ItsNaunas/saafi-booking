// Secret-URL token for the public ICS calendar feed.
// The feed lives OUTSIDE the /admin cookie guard (calendar apps can't send the
// session cookie), so access is gated by an unguessable token in the URL —
// exactly like a Google/Apple Calendar "secret address". The token is an HMAC
// of a fixed label under SESSION_SECRET, so it's stable and needs no new env var.

const FEED_LABEL = "calendar-feed-v1";

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
    .join("");
}

/** The current feed token, or null if SESSION_SECRET isn't configured. */
export async function calendarFeedToken(): Promise<string | null> {
  const secret = process.env.SESSION_SECRET;
  if (!secret) return null;
  return hmacHex(FEED_LABEL, secret);
}

/** Constant-time check of a token from the request URL. */
export async function verifyFeedToken(token: string | undefined): Promise<boolean> {
  if (!token) return false;
  const expected = await calendarFeedToken();
  if (!expected || token.length !== expected.length) return false;
  let diff = 0;
  for (let i = 0; i < token.length; i++) diff |= token.charCodeAt(i) ^ expected.charCodeAt(i);
  return diff === 0;
}

/** Token for the 15-minute Airbnb sync endpoint, derived like the feed token. */
export async function airbnbSyncToken(): Promise<string | null> {
  const secret = process.env.SESSION_SECRET;
  if (!secret) return null;
  return hmacHex("airbnb-sync-v1", secret);
}
