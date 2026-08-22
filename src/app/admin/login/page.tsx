import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { createSessionToken, SESSION_COOKIE, SESSION_TTL_MS } from "@/lib/session";

async function login(formData: FormData) {
  "use server";
  const password = String(formData.get("password") ?? "");
  const expected = process.env.ADMIN_PASSWORD;
  const secret = process.env.SESSION_SECRET;
  if (!expected || !secret || password !== expected) {
    redirect("/admin/login?error=1");
  }
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
        className="w-full max-w-sm rounded-2xl bg-white p-8 shadow-lg ring-1 ring-slate-200"
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
          className="w-full rounded-xl border border-slate-300 px-4 py-2.5 outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-200"
        />
        {error && (
          <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm font-medium text-red-700">
            Wrong password — try again.
          </p>
        )}
        <button
          type="submit"
          className="mt-4 w-full rounded-xl bg-brand-600 py-2.5 font-semibold text-white transition hover:bg-brand-700"
        >
          Sign in
        </button>
      </form>
    </main>
  );
}
