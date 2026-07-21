import Link from "next/link";
import { logout } from "@/app/admin/actions";

const NAV = [
  { href: "/admin", label: "Pipeline" },
  { href: "/admin/calendar", label: "Calendar" },
  { href: "/admin/customers", label: "Customers" },
  { href: "/admin/pricing", label: "Pricing" },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-slate-50">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
          <div className="flex items-center gap-6">
            <span className="font-bold text-slate-900">
              SAAFI <span className="text-emerald-600">Admin</span>
            </span>
            <nav className="flex gap-1">
              {NAV.map((n) => (
                <Link
                  key={n.href}
                  href={n.href}
                  className="rounded-lg px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                >
                  {n.label}
                </Link>
              ))}
            </nav>
          </div>
          <form action={logout}>
            <button className="rounded-lg px-3 py-1.5 text-sm font-medium text-slate-500 hover:bg-slate-100">
              Sign out
            </button>
          </form>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-6">{children}</main>
    </div>
  );
}
