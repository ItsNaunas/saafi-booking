import type { LucideIcon } from "lucide-react";

/**
 * The site's one icon setting.
 *
 * Before this existed, icons were authored by hand a file at a time and the
 * site had drifted to NINE stroke weights — 1, 1.4, 1.5, 1.7, 1.8, 2, 2.25 and
 * 2.4 — none of them a decision. Everything now comes from lucide-react on a
 * single 24px grid at one weight, so that drift cannot come back.
 *
 * Size with a Tailwind class (`size-5`, `size-8 sm:size-9`) rather than the
 * `size` prop, so responsive sizes work. The stroke scales with the box, which
 * is how line-icon systems are meant to behave.
 *
 * `strokeWidth` is overridable for one documented reason: below about 16px a
 * 1.5 stroke renders under a pixel and dissolves. Small glyphs — the tick in a
 * checkbox, an arrow in a button — take a heavier weight as deliberate optical
 * compensation, not as a second style.
 */
export const ICON_STROKE = 1.5;

export default function Icon({
  glyph: Glyph,
  className = "size-5",
  strokeWidth = ICON_STROKE,
}: {
  glyph: LucideIcon;
  className?: string;
  /** Only raise this for glyphs rendered under ~16px. See above. */
  strokeWidth?: number;
}) {
  return (
    <Glyph
      strokeWidth={strokeWidth}
      className={`shrink-0 ${className}`}
      aria-hidden="true"
    />
  );
}
