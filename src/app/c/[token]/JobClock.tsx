"use client";

// The running clock on a started job — the "minute-by-minute tracker" from the
// 2026-08-25 review. Ticks every second, written straight to the text nodes
// rather than through state: a re-render per second to change two characters
// is the same mistake AnimatedPrice already avoids, and the effect's job is
// synchronising an external system (the DOM) with the wall clock.

import { useEffect, useRef } from "react";

export default function JobClock({ startedAt }: { startedAt: string }) {
  const big = useRef<HTMLSpanElement>(null);
  const small = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const start = new Date(startedAt).getTime();
    const pad = (n: number) => String(n).padStart(2, "0");
    const tick = () => {
      const secs = Math.max(0, Math.floor((Date.now() - start) / 1000));
      if (big.current)
        big.current.textContent = `${Math.floor(secs / 3600)}:${pad(Math.floor((secs % 3600) / 60))}`;
      if (small.current) small.current.textContent = `:${pad(secs % 60)}`;
    };
    tick();
    const t = setInterval(tick, 1000);
    return () => clearInterval(t);
  }, [startedAt]);

  return (
    // Empty until the effect's first tick — the static started-at line below
    // carries the information for no-JS clients.
    <p className="tnum text-3xl font-bold tracking-tight text-slate-900" aria-hidden="true">
      <span ref={big} />
      <span ref={small} className="text-lg font-medium text-slate-400" />
    </p>
  );
}
