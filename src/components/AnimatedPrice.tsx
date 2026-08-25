"use client";

// The hero's headline number counts up on arrival.
//
// The whole page argues that the price is knowable up front, so the number is
// the hero's real subject — worth one authored moment of its own rather than
// arriving as static text like everything around it.
//
// It counts from a fraction of the target rather than from zero: starting at
// £0.00 reads as "loading", starting near the target reads as a dial settling.
//
// The animating value is written straight to the text node rather than held in
// state. A 900ms count at 60fps is ~54 frames, and putting that through React
// would be 54 renders of a subtree to change four characters — the text node
// is the "external system" this effect exists to synchronise. It also means
// the server-rendered markup already contains the final price, so there is no
// flash of a wrong number and nothing to hydrate.

import { useEffect, useRef } from "react";
import { formatGBP } from "@/lib/pricing";

export default function AnimatedPrice({
  value,
  className = "",
}: {
  value: number;
  className?: string;
}) {
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const DURATION = 900;
    const from = value * 0.82;
    let frame = 0;
    let start: number | null = null;

    const tick = (now: number) => {
      start ??= now;
      const t = Math.min(1, (now - start) / DURATION);
      // Same exponential ease-out the reveals use, so the page has one curve.
      const eased = 1 - Math.pow(1 - t, 4);
      el.textContent = formatGBP(from + (value - from) * eased);
      if (t < 1) frame = requestAnimationFrame(tick);
    };

    frame = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(frame);
      el.textContent = formatGBP(value);
    };
  }, [value]);

  return (
    <span className={className}>
      {/* The animating copy is hidden from assistive tech — a value ticking
          54 times is not something to announce. The real one sits beside it. */}
      <span ref={ref} aria-hidden="true">
        {formatGBP(value)}
      </span>
      <span className="sr-only">{formatGBP(value)}</span>
    </span>
  );
}
