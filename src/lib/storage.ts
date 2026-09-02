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
  return { url, key };
}

/** Upload one image. Path convention: {bookingId}/{phase}-{timestamp}.jpg */
export async function uploadJobPhoto(
  path: string,
  bytes: ArrayBuffer,
  contentType: string
): Promise<void> {
  const { url, key } = creds();
  const res = await fetch(`${url}/storage/v1/object/${PHOTO_BUCKET}/${path}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": contentType,
      "x-upsert": "true",
    },
    body: bytes,
  });
  if (!res.ok) throw new Error(`storage upload ${path}: ${res.status} ${await res.text()}`);
}

/** A short-lived viewing link for the admin page. Null when signing fails. */
export async function signedPhotoUrl(path: string, expiresInSeconds = 3600): Promise<string | null> {
  const { url, key } = creds();
  const res = await fetch(`${url}/storage/v1/object/sign/${PHOTO_BUCKET}/${path}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({ expiresIn: expiresInSeconds }),
  });
  if (!res.ok) return null;
  const data = (await res.json()) as { signedURL?: string };
  return data.signedURL ? `${url}/storage/v1${data.signedURL}` : null;
}

// The bucket's own limits, enforced by Supabase on every upload — including
// the signed-URL uploads that never pass through our servers. 50MB covers a
// ~1-minute 1080p phone walkthrough; the videos are deep-clean proof
// (2026-09-01 meeting), the images are the cleaners' before/after shots.
const BUCKET_LIMIT_BYTES = 50 * 1024 * 1024;
const BUCKET_MIME_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
  "video/mp4",
  "video/quicktime",
  "video/webm",
  "video/3gpp",
];

/**
 * Ensure the private bucket exists with the current limits — idempotent,
 * called from the upload paths so the feature self-provisions. An existing
 * bucket (created back when it was images-only at 10MB) gets its limits
 * updated in place, once per server process.
 */
let bucketCurrent = false;
export async function ensurePhotoBucket(): Promise<void> {
  if (bucketCurrent) return;
  const { url, key } = creds();
  const headers = { Authorization: `Bearer ${key}`, "Content-Type": "application/json" };
  const config = {
    public: false,
    file_size_limit: BUCKET_LIMIT_BYTES,
    allowed_mime_types: BUCKET_MIME_TYPES,
  };
  const res = await fetch(`${url}/storage/v1/bucket`, {
    method: "POST",
    headers,
    body: JSON.stringify({ id: PHOTO_BUCKET, name: PHOTO_BUCKET, ...config }),
  });
  if (res.ok) {
    bucketCurrent = true;
    return;
  }
  // 400/409 = already exists — bring its limits up to date instead.
  if (res.status === 400 || res.status === 409) {
    const upd = await fetch(`${url}/storage/v1/bucket/${PHOTO_BUCKET}`, {
      method: "PUT",
      headers,
      body: JSON.stringify(config),
    });
    if (upd.ok) bucketCurrent = true;
    // A failed update is not fatal for images — the old limits still allow
    // them — so don't throw; video uploads will surface it as their own error.
    else console.error(`[storage] bucket update failed: ${upd.status} ${await upd.text()}`);
    return;
  }
  throw new Error(`storage bucket: ${res.status} ${await res.text()}`);
}

/**
 * Mint a one-shot signed upload URL so the browser can PUT a file straight to
 * Supabase Storage. Exists for the deep-clean walkthrough: a phone video blows
 * straight past the request-body cap on our own API routes, so the file must
 * never travel through them.
 */
export async function signedUploadUrl(path: string): Promise<string | null> {
  const { url, key } = creds();
  const res = await fetch(`${url}/storage/v1/object/upload/sign/${PHOTO_BUCKET}/${path}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${key}` },
  });
  if (!res.ok) {
    console.error(`[storage] signed upload ${path}: ${res.status} ${await res.text()}`);
    return null;
  }
  const data = (await res.json()) as { url?: string };
  return data.url ? `${url}/storage/v1${data.url}` : null;
}
