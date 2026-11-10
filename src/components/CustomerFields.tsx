"use client";

// The customer half of the manual booking form, with autofill (Dulla,
// 2026-11-10: "if I type a name it can let me auto fill, and that name is
// linked to the same email phone number etc").
//
// Typing in Name or Phone lists past customers; picking one fills phone,
// email, postcode and address. Every field stays a plain editable input, so
// ignoring the list and typing a new customer works exactly as before.

import { useMemo, useState } from "react";
import type { KnownCustomer } from "@/lib/supabaseAdmin";

type Values = KnownCustomer;
type FieldName = keyof Values;

export default function CustomerFields({
  known,
  initial,
}: {
  known: KnownCustomer[];
  initial?: Partial<Values> | null;
}) {
  const [v, setV] = useState<Values>({
    name: initial?.name ?? "",
    phone: initial?.phone ?? "",
    email: initial?.email ?? "",
    postcode: initial?.postcode ?? "",
    address_line: initial?.address_line ?? "",
  });
  // Which field the list is showing under, and the highlighted row.
  const [openOn, setOpenOn] = useState<"name" | "phone" | null>(null);
  const [active, setActive] = useState(0);

  const query = openOn ? v[openOn].trim() : "";
  const matches = useMemo(() => {
    if (!openOn) return [];
    if (openOn === "name") {
      const q = query.toLowerCase();
      if (q.length < 2) return [];
      return known.filter((c) => c.name.toLowerCase().includes(q)).slice(0, 6);
    }
    const q = query.replace(/\D/g, "");
    if (q.length < 3) return [];
    return known.filter((c) => c.phone.replace(/\D/g, "").includes(q)).slice(0, 6);
  }, [openOn, query, known]);

  function pick(c: KnownCustomer) {
    setV({ ...c });
    setOpenOn(null);
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (!matches.length) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((a) => (a + 1) % matches.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((a) => (a - 1 + matches.length) % matches.length);
    } else if (e.key === "Enter") {
      e.preventDefault(); // pick, don't submit the form
      pick(matches[active] ?? matches[0]);
    } else if (e.key === "Escape") {
      setOpenOn(null);
    }
  }

  const input = (name: FieldName, type = "text") => {
    const lookup = name === "name" || name === "phone";
    return (
      <div className="relative">
        <input
          name={name}
          type={type}
          value={v[name]}
          autoComplete="off"
          onChange={(e) => {
            setV((p) => ({ ...p, [name]: e.target.value }));
            if (lookup) {
              setOpenOn(name);
              setActive(0);
            }
          }}
          onFocus={lookup ? () => setOpenOn(name) : undefined}
          onBlur={lookup ? () => setOpenOn((o) => (o === name ? null : o)) : undefined}
          onKeyDown={lookup ? onKeyDown : undefined}
          className="w-full border border-slate-300 px-3 py-2 outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-200"
        />
        {openOn === name && matches.length > 0 && (
          <ul className="absolute z-20 mt-1 w-full min-w-64 bg-white py-1 shadow-lg ring-1 ring-slate-200">
            <li className="px-3 pb-1 text-xs text-slate-400">Past customers</li>
            {matches.map((c, i) => (
              <li key={`${c.phone}|${c.address_line}`}>
                <button
                  type="button"
                  // mousedown, not click: fires before the input's blur closes the list
                  onMouseDown={(e) => {
                    e.preventDefault();
                    pick(c);
                  }}
                  onMouseEnter={() => setActive(i)}
                  className={`block w-full px-3 py-2 text-left text-sm ${i === active ? "bg-brand-50" : ""}`}
                >
                  <span className="font-medium text-slate-900">{c.name}</span>
                  <span className="block text-xs text-slate-500">
                    {c.phone}
                    {(c.address_line || c.postcode) && " · "}
                    {[c.address_line, c.postcode].filter(Boolean).join(", ")}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    );
  };

  const label = (text: string, hint?: string) => (
    <span className="mb-1 block text-sm font-medium text-slate-700">
      {text} {hint && <span className="font-normal text-slate-400">({hint})</span>}
    </span>
  );

  return (
    <>
      <label className="block">
        {label("Customer name *", "type to find past customers")}
        {input("name")}
      </label>
      <label className="block">
        {label("Phone *")}
        {input("phone", "tel")}
      </label>
      <label className="block">
        {label("Email", "optional")}
        {input("email", "email")}
      </label>
      <label className="block">
        {label("Postcode")}
        {input("postcode")}
      </label>
      <label className="block sm:col-span-2">
        {label("Address line")}
        {input("address_line")}
      </label>
    </>
  );
}
