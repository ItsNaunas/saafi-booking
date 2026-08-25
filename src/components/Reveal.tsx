"use client";

// One entrance, used deliberately.
//
// The temptation with scroll animation is to put the same fade on every block
// on the page, which reads as a template rather than as art direction. This is
// applied to a chosen set of moments instead: a section arriving, a row of
// cards landing in sequence, the price appearing.
//
// Three rules it enforces so the page can't drift:
//   - It fires ONCE. Elements that re-animate every time you scroll past turn
//     a page into a slot machine.
//   - It starts from a VISIBLE default. If JS never runs, or the observer is
//     unsupported, the content is already there — this only ever adds motion,
//     it is never load-bearing for legibility.
//   - It respects prefers-reduced-motion, checked at runtime rather than left
//     to a CSS media query, so reduced-motion users skip straight to the
//     final state with no transition at all.

import { useEffect, useRef, useState } from "react";

export default function Reveal({
  children,
  /** Milliseconds behind its neighbours. Use for rows, not for whole sections. */
  delay = 0,
  /** How far it travels. "none" fades only — for things that must not shift. */
  distance = 16,
  className = "",
}: {
  children: React.ReactNode;
  delay?: number;
  distance?: number | "none";
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [shown, setShown] = useState(false);
  const [armed, setArmed] = useState(false);

  useEffect(() => {
    const reduced = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    if (reduced || !("IntersectionObserver" in window)) return;

    const el = ref.current;
    if (!el) return;

    // Arming in an effect rather than in initial state keeps the server HTML
    // and the first client render identical — the hidden state only ever
    // exists on a client that is definitely going to animate it back.
    setArmed(true);

    const io = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return;
        setShown(true);
        io.disconnect();
      },
      // Fires a little before the element reaches the fold, so the motion has
      // finished by the time it is properly in view.
      { rootMargin: "0px 0px -12% 0px", threshold: 0.01 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  const hidden = armed && !shown;
  const travel = distance === "none" ? 0 : distance;

  return (
    <div
      ref={ref}
      className={className}
      style={{
        opacity: hidden ? 0 : 1,
        transform: hidden ? `translate3d(0, ${travel}px, 0)` : "none",
        // Exponential ease-out: quick to commit, slow to settle.
        transition: armed
          ? `opacity 620ms cubic-bezier(0.16, 1, 0.3, 1) ${delay}ms, transform 620ms cubic-bezier(0.16, 1, 0.3, 1) ${delay}ms`
          : undefined,
        willChange: hidden ? "opacity, transform" : undefined,
      }}
    >
      {children}
    </div>
  );
}
