// Supabase Storage via plain REST, same pattern as the PostgREST data layer.
// One private bucket, job-photos: before/after shots a cleaner takes on
// their phone. Private on purpose — customers' homes never get a public URL;
// the admin page mints short-lived signed links instead.

import { secret } from "./env";

export const PHOTO_BUCKET = "job-photos";

function creds() {
  const url = process.env.SUPABASE_URL;
  const key = secret("SUPABASE_SECRET_KEY");
  if (!url || !key) throw new Error("SUPABASE_URL / SUPABASE_SECRET_KEY not configured");
  // BOTH headers, always: with the new sb_secret_ keys the storage API
  // rejects a bare Authorization header ("Invalid Compact JWS") — found live
  // 2026-09-02, when it had silently broken every storage call in production.
  const authHeaders = { Authorization: `Bearer ${key}`, apikey: key };
  return { url, key, authHeaders };
}

/** Upload one image. Path convention: {bookingId}/{phase}-{timestamp}.jpg */
export async function uploadJobPhoto(
  path: string,
  bytes: ArrayBuffer,
  contentType: string
): Promise<void> {
  const { url, authHeaders } = creds();
  const res = await fetch(`${url}/storage/v1/object/${PHOTO_BUCKET}/${path}`, {
    method: "POST",
    headers: {
      ...authHeaders,
      "Content-Type": contentType,
      "x-upsert": "true",
    },
    body: bytes,
  });
  if (!res.ok) throw new Error(`storage upload ${path}: ${res.status} ${await res.text()}`);
}

/** A short-lived viewing link for the admin page. Null when signing fails. */
export async function signedPhotoUrl(path: string, expiresInSeconds = 3600): Promise<string | null> {
  const { url, authHeaders } = creds();
  const res = await fetch(`${url}/storage/v1/object/sign/${PHOTO_BUCKET}/${path}`, {
    method: "POST",
    headers: { ...authHeaders, "Content-Type": "application/json" },
    body: JSON.stringify({ expiresIn: expiresInSeconds }),
  });
  if (!res.ok) return null;
  const data = (await res.json()) as { signedURL?: string };
  return data.signedURL ? `${url}/storage/v1${data.signedURL}` : null;
}

/**
 * Ensure the private bucket exists — idempotent, called from the upload path
 * so the feature self-provisions the first time a photo is taken.
 */
export async function ensurePhotoBucket(): Promise<void> {
  const { url, authHeaders } = creds();
  const res = await fetch(`${url}/storage/v1/bucket`, {
    method: "POST",
    headers: { ...authHeaders, "Content-Type": "application/json" },
    body: JSON.stringify({
      id: PHOTO_BUCKET,
      name: PHOTO_BUCKET,
      public: false,
      file_size_limit: 10 * 1024 * 1024,
      allowed_mime_types: ["image/jpeg", "image/png", "image/webp", "image/heic"],
    }),
  });
  // 400/409 = already exists; anything else the caller's try/catch reports.
  if (!res.ok && res.status !== 400 && res.status !== 409) {
    throw new Error(`storage bucket: ${res.status} ${await res.text()}`);
  }
}
