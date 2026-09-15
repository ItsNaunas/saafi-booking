"use client";

import { useEffect, useRef, useState } from "react";
import {
  COMPANY_RULES,
  checklistTotal,
  type ChecklistSection,
} from "@/lib/checklist";

/**
 * The SOP checklist for one job, ticked on a phone.
 *
 * Ticks are kept in the phone's own storage, not sent to the server as they
 * happen: a cleaner is often in a stranger's house on bad signal, and a
 * network round-trip per tap would be slow and lossy. The state survives the
 * screen locking, the browser closing and the phone restarting. It is written
 * to the booking once, by the hidden field below, when Finish is pressed.
 *
 * Nothing here blocks Finish. A checklist that must be completed is a
 * checklist that gets ticked dishonestly by someone standing in a kitchen
 * with no bin; the honest version records what was actually done and lets the
 * office see the gaps.
 */
export default function JobChecklist({
  bookingId,
  sections,
}: {
  bookingId: string;
  sections: ChecklistSection[];
}) {
  const storageKey = `saafi-checklist-${bookingId}`;
  const [done, setDone] = useState<Set<string>>(new Set());
  const [open, setOpen] = useState(false);
  // Until the restore has run, an empty set is "not loaded yet", not "nothing
  // ticked" — saving in that state would wipe the list on every remount.
  const ready = useRef(false);

  /* eslint-disable react-hooks/set-state-in-effect -- localStorage exists
     only after mount; reading it during render would make the first client
     paint disagree with the server's HTML. */
  useEffect(() => {
    try {
      const raw = localStorage.getItem(storageKey);
      if (raw) {
        const keys = JSON.parse(raw) as unknown;
        if (Array.isArray(keys)) setDone(new Set(keys.filter((k): k is string => typeof k === "string")));
      }
    } catch {
      // Storage blocked — the list still works, it just won't survive a reload.
    }
    ready.current = true;
  }, [storageKey]);
  /* eslint-enable react-hooks/set-state-in-effect */

  useEffect(() => {
    if (!ready.current) return;
    try {
      localStorage.setItem(storageKey, JSON.stringify([...done]));
    } catch {
      // Private mode: ticking still works for this session.
    }
  }, [done, storageKey]);

  const total = checklistTotal(sections);
  const count = done.size;
  const allDone = count >= total;

  function toggle(key: string) {
    setDone((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  return (
    <div className="mb-3 border border-slate-200 bg-white">
      {/* The hidden field the Finish form posts. Inside the same form, so no
          wiring between components is needed. */}
      <input type="hidden" name="checklist" value={JSON.stringify([...done])} />

      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-3 px-3 py-2.5 text-left"
      >
        <span className="text-sm font-semibold text-slate-800">
          Checklist
          <span
            className={`ml-2 tnum font-bold ${allDone ? "text-brand-700" : "text-slate-500"}`}
          >
            {count} of {total}
          </span>
        </span>
        <span className="flex items-center gap-2">
          {/* A bar, not a percentage: it reads at a glance with wet hands. */}
          <span aria-hidden="true" className="h-1.5 w-16 bg-slate-200">
            <span
              className="block h-full bg-brand-500 transition-all"
              style={{ width: `${total ? Math.round((count / total) * 100) : 0}%` }}
            />
          </span>
          <span className="text-xs text-slate-400">{open ? "hide" : "show"}</span>
        </span>
      </button>

      {/* Said once, where they will see it before pressing Finish, and only
          after they have started ticking — nagging at 0 of 43 would train
          them to ignore it. Deliberately not a blocking dialog: a checklist
          that must be completed gets ticked dishonestly. */}
      {count > 0 && count < total && (
        <p className="border-t border-slate-100 px-3 py-2 text-xs text-amber-700">
          {total - count} not ticked &mdash; you can still finish, the office will see.
        </p>
      )}

      {open && (
        <div className="border-t border-slate-100 px-3 py-3">
          <ul className="mb-3 space-y-0.5 bg-slate-50 px-3 py-2 text-[11px] leading-snug text-slate-500">
            {COMPANY_RULES.map((r) => (
              <li key={r}>{r}</li>
            ))}
          </ul>

          <div className="space-y-4">
            {sections.map((section) => {
              const sectionDone = section.items.filter((i) => done.has(i.key)).length;
              return (
                <div key={section.key}>
                  <p className="mb-1.5 flex items-baseline justify-between gap-2 text-xs font-bold uppercase tracking-wide text-slate-500">
                    {section.title}
                    <span className="tnum font-medium normal-case tracking-normal text-slate-400">
                      {sectionDone}/{section.items.length}
                    </span>
                  </p>
                  <ul className="space-y-0.5">
                    {section.items.map((item) => {
                      const on = done.has(item.key);
                      return (
                        <li key={item.key}>
                          {/* Whole row is the target — a 16px tick box is not
                              something to hit accurately wearing gloves. */}
                          <label
                            className={`flex min-h-11 cursor-pointer items-center gap-3 px-2 py-1.5 text-sm ${
                              on ? "text-slate-400 line-through" : "text-slate-700"
                            }`}
                          >
                            <input
                              type="checkbox"
                              checked={on}
                              onChange={() => toggle(item.key)}
                              className="size-5 shrink-0 accent-brand-600"
                            />
                            <span>{item.label}</span>
                          </label>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
