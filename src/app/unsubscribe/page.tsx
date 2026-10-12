import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { verifyUnsubscribe, fromB64url } from "@/lib/unsubscribe";
import { suppressEmail } from "@/lib/supabaseAdmin";
import { contact } from "@/lib/business";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Unsubscribe", robots: { index: false, follow: false } };

async function unsubscribe(formData: FormData) {
  "use server";
  const e = String(formData.get("e") ?? "");
  const t = String(formData.get("t") ?? "");
  let email = "";
  try {
    email = fromB64url(e).toLowerCase();
  } catch {
    /* invalid link */
  }
  if (!email || !(await verifyUnsubscribe(email, t))) redirect("/unsubscribe?bad=1");
  await suppressEmail(email, "unsubscribe page");
  redirect(`/unsubscribe?done=1`);
}

export default async function UnsubscribePage({
  searchParams,
}: {
  searchParams: Promise<{ e?: string; t?: string; done?: string; bad?: string }>;
}) {
  const { e, t, done, bad } = await searchParams;
  let email = "";
  try {
    email = e ? fromB64url(e) : "";
  } catch {
    /* invalid link */
  }
  const valid = !!email && (await verifyUnsubscribe(email, t));

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
      <div className="w-full max-w-md bg-white p-6 text-center shadow-sm ring-1 ring-slate-200">
        <p className="mb-3 text-sm font-bold tracking-[0.16em] text-slate-900">SAAFI</p>
        {done ? (
          <>
            <h1 className="mb-2 text-xl font-bold text-slate-900">You&apos;re unsubscribed</h1>
            <p className="text-sm text-slate-600">
              No more offers from us. You&apos;ll still get emails about cleans you book, like confirmations and
              receipts.
            </p>
          </>
        ) : valid ? (
          <form action={unsubscribe}>
            <h1 className="mb-2 text-xl font-bold text-slate-900">Stop marketing emails?</h1>
            <p className="mb-4 text-sm text-slate-600">
              <b>{email}</b> won&apos;t get offers or news from SAAFI any more. Booking emails still arrive.
            </p>
            <input type="hidden" name="e" value={e} />
            <input type="hidden" name="t" value={t} />
            <button className="bg-brand-600 px-5 py-2.5 font-semibold text-white hover:bg-brand-700">
              Unsubscribe
            </button>
          </form>
        ) : (
          <>
            <h1 className="mb-2 text-xl font-bold text-slate-900">
              {bad ? "That link didn't work" : "Unsubscribe"}
            </h1>
            <p className="text-sm text-slate-600">
              Use the link at the bottom of one of our emails, or email{" "}
              <a href={`mailto:${contact.email}`} className="font-medium text-brand-700 underline">
                {contact.email}
              </a>{" "}
              and we&apos;ll take you off the list.
            </p>
          </>
        )}
      </div>
    </main>
  );
}
