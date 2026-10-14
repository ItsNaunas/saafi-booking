"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "/admin/marketing", label: "Overview" },
  { href: "/admin/marketing/automations", label: "Automatic emails" },
  { href: "/admin/marketing/campaigns", label: "Campaigns" },
  { href: "/admin/marketing/contacts", label: "Contacts" },
];

export default function Tabs() {
  const path = usePathname();
  const active = (href: string) =>
    href === "/admin/marketing"
      ? path === href
      : path.startsWith(href) || (href.endsWith("/campaigns") && path.startsWith("/admin/marketing/campaign/"));
  return (
    <nav className="-mx-4 mb-5 flex gap-1 overflow-x-auto border-b border-slate-200 px-4" aria-label="Marketing">
      {TABS.map((t) => (
        <Link
          key={t.href}
          href={t.href}
          aria-current={active(t.href) ? "page" : undefined}
          className={`shrink-0 border-b-2 px-3 py-2 text-sm font-medium ${
            active(t.href) ? "border-brand-600 text-brand-700" : "border-transparent text-slate-500 hover:text-slate-800"
          }`}
        >
          {t.label}
        </Link>
      ))}
    </nav>
  );
}
