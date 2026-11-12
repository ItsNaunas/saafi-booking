import { listCustomers } from "@/lib/supabaseAdmin";
import { toggleCustomerInvoiced } from "@/app/admin/actions";

export const dynamic = "force-dynamic";

export default async function CustomersPage({
  searchParams,
}: {
  searchParams: Promise<{ invoiced?: string }>;
}) {
  const [customers, q] = await Promise.all([listCustomers(), searchParams]);

  return (
    <div>
      <h1 className="mb-4 text-2xl font-bold text-slate-900">Customers</h1>
      <p className="mb-4 max-w-2xl text-sm text-slate-500">
        <span className="font-semibold text-slate-700">Invoiced</span> customers pay you directly, like the
        Airbnb hosts. The site won&apos;t ask them to pay when they book, won&apos;t email a payment link
        or a reminder, and won&apos;t charge a saved card. The payment buttons on a booking still work if
        you choose to use them.
      </p>
      {q.invoiced === "fail" && (
        <p className="mb-4 bg-rose-50 px-3 py-2 text-sm font-medium text-rose-800 ring-1 ring-rose-200">
          That didn&apos;t save. If it keeps happening, the 2026-11-12 database update hasn&apos;t been run yet.
        </p>
      )}
      {customers.length === 0 ? (
        <p className="text-slate-500">No customers yet. They appear automatically with their first booking.</p>
      ) : (
        <div className="overflow-x-auto bg-white shadow-sm ring-1 ring-slate-200">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-400">
              <tr>
                <th className="px-4 py-3">Name</th>
                <th className="px-4 py-3">Contact</th>
                <th className="px-4 py-3">Address</th>
                <th className="px-4 py-3">Payment</th>
                <th className="px-4 py-3 text-right">Bookings</th>
                <th className="px-4 py-3 text-right">Since</th>
              </tr>
            </thead>
            <tbody>
              {customers.map((c) => (
                <tr key={c.id} className="border-b border-slate-100 last:border-0 hover:bg-slate-50">
                  <td className="px-4 py-3 font-medium text-slate-900">{c.name}</td>
                  <td className="px-4 py-3 text-slate-600">
                    <a href={`tel:${c.phone}`} className="text-brand-700 hover:underline">{c.phone}</a>
                    <span className="mx-1 text-slate-300">·</span>
                    <a href={`mailto:${c.email}`} className="hover:underline">{c.email}</a>
                  </td>
                  <td className="px-4 py-3 text-slate-600">
                    {c.address_line ? `${c.address_line}, ${c.postcode ?? ""}` : "—"}
                  </td>
                  <td className="px-4 py-3">
                    <form action={toggleCustomerInvoiced}>
                      <input type="hidden" name="id" value={c.id} />
                      <input type="hidden" name="invoiced" value={c.invoiced ? "false" : "true"} />
                      <button
                        role="switch"
                        aria-checked={Boolean(c.invoiced)}
                        aria-label={`Invoiced: ${c.invoiced ? "on" : "off"} for ${c.name}`}
                        className="flex min-h-11 items-center gap-2 text-xs font-semibold"
                      >
                        <span
                          className={`relative inline-block h-5 w-9 rounded-full transition ${
                            c.invoiced ? "bg-amber-500" : "bg-slate-300"
                          }`}
                        >
                          <span
                            className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-all ${
                              c.invoiced ? "left-[18px]" : "left-0.5"
                            }`}
                          />
                        </span>
                        <span className={c.invoiced ? "text-amber-800" : "text-slate-500"}>
                          {c.invoiced ? "Invoiced" : "Pays online"}
                        </span>
                      </button>
                    </form>
                  </td>
                  <td className="px-4 py-3 text-right font-semibold text-slate-800">
                    {c.bookings?.[0]?.count ?? 0}
                  </td>
                  <td className="px-4 py-3 text-right text-slate-500">
                    {new Date(c.created_at).toLocaleDateString("en-GB")}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
