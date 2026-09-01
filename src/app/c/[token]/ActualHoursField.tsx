"use client";

// The "Hours worked" input on the finish form, kept honest by the clock.
//
// It used to be server-rendered with the elapsed time *as of page load* —
// which, because the page re-renders the moment Start is tapped, was always
// the booked hours. Four hours later the JobClock above read 4:07 while this
// field still said 3, and the server prefers the typed value, so the stale
// number won and the overrun silently vanished.
//
// Now the field tracks the running time (to the nearest quarter hour, the
// billing granularity) until the cleaner touches it — after that their edit
// stands, because they know something the clock doesn't (a lunch break, a
// wrong Start tap). Same effect-writes-to-input pattern as JobClock: syncing
// an external clock into the DOM, not app state.

import { useEffect, useRef } from "react";

const roundQuarter = (h: number) => Math.round(h * 4) / 4;

export default function ActualHoursField({
  startedAt,
  bookedHours,
}: {
  startedAt: string;
  bookedHours: number;
}) {
  const input = useRef<HTMLInputElement>(null);
  const touched = useRef(false);

  useEffect(() => {
    const start = new Date(startedAt).getTime();
    const tick = () => {
      if (touched.current || !input.current) return;
      // Never sync while the field holds the cleaner's focus mid-edit.
      if (document.activeElement === input.current) return;
      const elapsed = roundQuarter(Math.max(0, (Date.now() - start) / 3_600_000));
      input.current.value = String(elapsed > 0 ? elapsed : bookedHours);
    };
    tick();
    const t = setInterval(tick, 30_000);
    return () => clearInterval(t);
  }, [startedAt, bookedHours]);

  return (
    <input
      ref={input}
      type="number"
      name="actual_hours"
      step="0.25"
      min="0.25"
      defaultValue={String(bookedHours)}
      onInput={() => {
        touched.current = true;
      }}
      className="w-full border border-slate-300 px-3 py-2 text-base"
    />
  );
}
