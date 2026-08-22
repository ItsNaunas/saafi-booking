import { listCustomers } from "@/lib/supabaseAdmin";

export const dynamic = "force-dynamic";

export default async function CustomersPage() {
  const customers = await listCustomers();

  return (
    <div>
      <h1 className="mb-4 text-2xl font-bold text-slate-900">Customers</h1>
      {customers.length === 0 && (
        <p className="text-slate-500">No customers yet — they appear automatically with their first booking.</p>
      )}
      <div className="overflow-x-auto rounded-xl bg-white shadow-sm ring-1 ring-slate-200">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-400">
            <tr>
              <th className="px-4 py-3">Name</th>
              <th className="px-4 py-3">Contact</th>
              <th className="px-4 py-3">Address</th>
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
    </div>
  );
}
