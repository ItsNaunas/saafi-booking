import { NextRequest, NextResponse } from "next/server";
import { ensurePhotoBucket, signedUploadUrl } from "@/lib/storage";

// Deep-clean walkthrough uploads (2026-09-01 meeting): the customer attaches
// a quick video or photos of the house so SAAFI can vet the job before anyone
// drives to it. The file goes browser → Supabase Storage directly on a signed
// one-shot URL minted here — it must not travel through this route, which has
// a request-body cap far below a phone video.
//
// Deliberately public, like the bookings endpoint it feeds. The URL only
// allows one PUT to one server-chosen path in a private bucket, the bucket
// enforces mime and size on the upload itself, and files that never get
// attached to a booking just sit unreferenced until tidied.

export const runtime = "nodejs";

const DRAFT_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

const EXT_FOR: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/heic": "heic",
  "video/mp4": "mp4",
  "video/quicktime": "mov",
  "video/webm": "webm",
  "video/3gpp": "3gp",
};

const MAX_BYTES = 50 * 1024 * 1024; // mirrors the bucket limit

function bad(message: string, status = 400) {
  return NextResponse.json({ ok: false, error: message }, { status });
}

export async function POST(req: NextRequest) {
  let body: { draftId?: unknown; type?: unknown; size?: unknown };
  try {
    body = await req.json();
  } catch {
    return bad("Invalid JSON body");
  }

  const draftId = String(body.draftId ?? "").toLowerCase();
  if (!DRAFT_ID.test(draftId)) return bad("Bad upload session");

  const type = String(body.type ?? "");
  const ext = EXT_FOR[type];
  if (!ext) return bad("That file type isn't supported — a photo or a phone video works best");

  const size = Number(body.size);
  if (!Number.isFinite(size) || size <= 0) return bad("Couldn't read that file");
  if (size > MAX_BYTES)
    return bad("That video is too big — keep it under a minute, or send a few photos instead");

  try {
    await ensurePhotoBucket();
    // Server-chosen path: the client never gets to name a file into the bucket.
    const path = `proof/${draftId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
    const uploadUrl = await signedUploadUrl(path);
    if (!uploadUrl) return bad("Upload isn't available right now — you can pick a reason instead", 503);
    return NextResponse.json({ ok: true, path, uploadUrl });
  } catch (e) {
    console.error("[deep-proof] signed upload failed:", e);
    return bad("Upload isn't available right now — you can pick a reason instead", 503);
  }
}
