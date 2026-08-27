import { redirect } from "next/navigation";
import { cookies, headers } from "next/headers";
import { createHash, timingSafeEqual } from "crypto";
import { createSessionToken, SESSION_COOKIE, SESSION_TTL_MS } from "@/lib/session";

// Per-IP failure counter. Module scope means per warm instance on Vercel —
// not bulletproof, but with the failure delay below it turns "unlimited free
// guesses" into a genuinely slow, lossy exercise.
const failures = new Map<string, { n: number; resetAt: number }>();
const LOCK_AFTER = 8;
const WINDOW_MS = 15 * 60 * 1000;

/** Same-length digests + timingSafeEqual: the compare leaks nothing. */
function passwordMatches(given: string, expected: string): boolean {
  const a = createHash("sha256").update(given).digest();
  const b = createHash("sha256").update(expected).digest();
  return timingSafeEqual(a, b);
}

async function login(formData: FormData) {
  "use server";
  const password = String(formData.get("password") ?? "");
  const expected = process.env.ADMIN_PASSWORD;
  const secret = process.env.SESSION_SECRET;

  const ip = ((await headers()).get("x-forwarded-for") ?? "?").split(",")[0].trim();
  const now = Date.now();
  const rec = failures.get(ip);
  if (rec && rec.resetAt > now && rec.n >= LOCK_AFTER) {
    redirect("/admin/login?error=locked");
  }

  if (!expected || !secret || !passwordMatches(password, expected)) {
    const cur = rec && rec.resetAt > now ? rec : { n: 0, resetAt: now + WINDOW_MS };
    failures.set(ip, { n: cur.n + 1, resetAt: cur.resetAt });
    // A flat delay on every failure caps the guess rate no matter how many
    // instances the counter is spread across.
    await new Promise((r) => setTimeout(r, 400));
    redirect("/admin/login?error=1");
  }
  failures.delete(ip);
  const token = await createSessionToken(secret);
  const jar = await cookies();
  jar.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_TTL_MS / 1000,
  });
  redirect("/admin");
}

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
      <form
        action={login}
        className="w-full max-w-sm bg-white p-8 shadow-lg ring-1 ring-slate-200"
      >
        <h1 className="text-xl font-bold text-slate-900">
          SAAFI <span className="text-brand-600">Admin</span>
        </h1>
        <p className="mt-1 mb-5 text-sm text-slate-500">Sign in to manage bookings.</p>
        <input
          type="password"
          name="password"
          placeholder="Password"
          autoFocus
          className="w-full border border-slate-300 px-4 py-2.5 outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-200"
        />
        {error === "locked" ? (
          <p className="mt-3 bg-red-50 px-3 py-2 text-sm font-medium text-red-700">
            Too many attempts — wait 15 minutes and try again.
          </p>
        ) : error ? (
          <p className="mt-3 bg-red-50 px-3 py-2 text-sm font-medium text-red-700">
            Wrong password — try again.
          </p>
        ) : null}
        <button
          type="submit"
          className="mt-4 w-full bg-brand-600 py-2.5 font-semibold text-white transition hover:bg-brand-700"
        >
          Sign in
        </button>
      </form>
    </main>
  );
}
