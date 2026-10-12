import Link from "next/link";
import { logout } from "@/app/admin/actions";

const NAV = [
  { href: "/admin", label: "Pipeline" },
  { href: "/admin/calendar", label: "Calendar" },
  { href: "/admin/airbnb", label: "Airbnb" },
  { href: "/admin/marketing", label: "Marketing" },
  { href: "/admin/customers", label: "Customers" },
  { href: "/admin/cleaners", label: "Cleaners" },
  { href: "/admin/pricing", label: "Pricing" },
  { href: "/admin/reports", label: "Reports" },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-slate-50">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-y-2 px-4 py-3">
          <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
            <span className="font-bold text-slate-900">
              SAAFI <span className="text-brand-600">Admin</span>
            </span>
            <nav className="flex flex-wrap gap-1">
              {NAV.map((n) => (
                <Link
                  key={n.href}
                  href={n.href}
                  className="px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                >
                  {n.label}
                </Link>
              ))}
            </nav>
          </div>
          <form action={logout}>
            <button className="px-3 py-1.5 text-sm font-medium text-slate-500 hover:bg-slate-100">
              Sign out
            </button>
          </form>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-6">{children}</main>
    </div>
  );
}
