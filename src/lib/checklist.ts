// The cleaner's SOP checklist, from SAAFI's own "CLEANER SOP CHECKLIST"
// sheet (2026-09-14). Deliberately in code rather than the database: the SOP
// changes once or twice a year, an admin editor for that is more surface area
// than it earns, and a mid-job edit would move the list under a cleaner who is
// halfway through it.
//
// Keys are stable and never reused. A finished job stores the keys that were
// ticked, so a checklist saved last month still reads correctly after the SOP
// is edited — anything it no longer recognises is simply not shown.

export type ChecklistItem = { key: string; label: string };

export type ChecklistSection = {
  key: string;
  title: string;
  items: ChecklistItem[];
  /**
   * Show only when this add-on was booked. The SOP's own rule — its extras
   * blocks are headed "ONLY IF BOOKED" — and it keeps the list short enough
   * that a cleaner actually works through it.
   */
  needsAddon?: string[];
};

/* ------------------------------------------------------------------ *
 *  Standard clean
 * ------------------------------------------------------------------ */

const STANDARD: ChecklistSection[] = [
  {
    key: "s.kitchen",
    title: "Kitchen",
    items: [
      { key: "s.kit.worktops", label: "Clean & disinfect worktops" },
      { key: "s.kit.residue", label: "Remove food residue & marks" },
      { key: "s.kit.splashback", label: "Clean splashback" },
      { key: "s.kit.cupboards", label: "Wipe cupboard doors & handles" },
      { key: "s.kit.appliances", label: "Wipe appliance exteriors" },
      { key: "s.kit.hob", label: "Clean hob, controls & surrounds" },
      { key: "s.kit.sink", label: "Clean & disinfect sink, taps" },
      { key: "s.kit.floor", label: "Vacuum/sweep & mop floor" },
      { key: "s.kit.bin", label: "Empty bin & replace liner" },
    ],
  },
  {
    key: "s.bathroom",
    title: "Bathroom",
    items: [
      { key: "s.bath.toilet", label: "Clean & disinfect toilet bowl, seat, lid" },
      { key: "s.bath.shower", label: "Clean bath/shower surfaces" },
      { key: "s.bath.soap", label: "Remove soap residue & dirt" },
      { key: "s.bath.fittings", label: "Clean shower fittings" },
      { key: "s.bath.sink", label: "Clean & disinfect sink, taps" },
      { key: "s.bath.mirror", label: "Clean mirror & accessible glass" },
      { key: "s.bath.tiles", label: "Wipe tiles & door handles" },
      { key: "s.bath.floor", label: "Vacuum/sweep & mop floor" },
      { key: "s.bath.bin", label: "Empty bin where included" },
    ],
  },
  {
    key: "s.bedrooms",
    title: "Bedrooms",
    items: [
      { key: "s.bed.dust", label: "Dust furniture, shelves & ledges" },
      { key: "s.bed.surfaces", label: "Wipe suitable hard surfaces" },
      { key: "s.bed.cobwebs", label: "Remove cobwebs" },
      { key: "s.bed.handles", label: "Wipe door handles" },
      { key: "s.bed.skirting", label: "Dust/wipe skirting where required" },
      { key: "s.bed.bed", label: "Make bed where requested" },
      { key: "s.bed.linen", label: "Change linen only if booked" },
      { key: "s.bed.carpets", label: "Vacuum carpets/rugs thoroughly" },
      { key: "s.bed.floors", label: "Vacuum/sweep & mop hard floors" },
      { key: "s.bed.bin", label: "Empty bin where included" },
    ],
  },
  {
    key: "s.living",
    title: "Living & dining",
    items: [
      { key: "s.liv.dust", label: "Dust furniture, shelves & ledges" },
      { key: "s.liv.surfaces", label: "Wipe suitable hard surfaces" },
      { key: "s.liv.cobwebs", label: "Remove cobwebs" },
      { key: "s.liv.touch", label: "Wipe handles / high-touch points" },
      { key: "s.liv.skirting", label: "Dust/wipe skirting" },
      { key: "s.liv.carpets", label: "Vacuum carpets/rugs thoroughly" },
      { key: "s.liv.floors", label: "Vacuum/sweep & mop hard floors" },
      { key: "s.liv.bins", label: "Empty bins where included" },
      { key: "s.liv.return", label: "Return moved items to place" },
    ],
  },
  {
    key: "s.x.windows",
    title: "Windows (booked extra)",
    needsAddon: ["windows"],
    items: [{ key: "s.x.win.1", label: "Internal glass, sills, frames" }],
  },
  {
    key: "s.x.laundry",
    title: "Laundry (booked extra)",
    needsAddon: ["ironing", "laundry"],
    items: [{ key: "s.x.lau.1", label: "Wash, dry, fold, return" }],
  },
  {
    key: "s.x.dusting",
    title: "Dusting (booked extra)",
    needsAddon: ["dusting"],
    items: [{ key: "s.x.dus.1", label: "Furniture, surfaces, shelves" }],
  },
  {
    key: "s.x.fridge",
    title: "Fridge (booked extra)",
    needsAddon: ["fridge"],
    items: [{ key: "s.x.fri.1", label: "Shelves, drawers, exterior" }],
  },
  {
    key: "s.x.oven",
    title: "Oven (booked extra)",
    needsAddon: ["oven"],
    items: [
      { key: "s.x.ov.1", label: "Remove racks/trays & loose debris" },
      { key: "s.x.ov.2", label: "Clean interior, door glass & seals" },
      { key: "s.x.ov.3", label: "Reassemble; remove product residue" },
    ],
  },
  {
    key: "s.final",
    title: "Final check & sign-off",
    items: [
      { key: "s.fin.rooms", label: "Every booked room completed" },
      { key: "s.fin.checked", label: "Floors, surfaces & mirrors checked" },
      { key: "s.fin.returned", label: "Items returned to original position" },
      { key: "s.fin.secure", label: "Equipment removed, property secure" },
      { key: "s.fin.reported", label: "Any issues/damage reported" },
    ],
  },
];

/* ------------------------------------------------------------------ *
 *  Deep clean
 * ------------------------------------------------------------------ */

const DEEP: ChecklistSection[] = [
  {
    key: "d.kitchen",
    title: "Kitchen",
    items: [
      { key: "d.kit.worktops", label: "Remove items, deep-clean worktops incl. corners/edges" },
      { key: "d.kit.grease", label: "Remove grease & build-up" },
      { key: "d.kit.splashback", label: "Deep-clean splashback" },
      { key: "d.kit.cupboards", label: "Clean cupboard fronts & handles" },
      { key: "d.kit.appliances", label: "Clean appliance exteriors & surrounding build-up" },
      { key: "d.kit.hob", label: "Degrease hob, controls & surrounds" },
      { key: "d.kit.sink", label: "Deep-clean sink, taps & remove limescale" },
      { key: "d.kit.skirting", label: "Clean skirting, floor edges, corners, cobwebs" },
      { key: "d.kit.behind", label: "Clean behind/under furniture (no heavy moving)" },
      { key: "d.kit.floor", label: "Thoroughly vacuum, mop & check floor" },
      { key: "d.kit.bin", label: "Empty & disinfect bin, replace liner" },
    ],
  },
  {
    key: "d.bathroom",
    title: "Bathroom",
    items: [
      { key: "d.bath.toilet", label: "Deep-clean toilet bowl, seat, lid & base" },
      { key: "d.bath.shower", label: "Thoroughly clean bath/shower incl. corners" },
      { key: "d.bath.scum", label: "Remove soap scum & limescale (safely)" },
      { key: "d.bath.fittings", label: "Clean shower fittings & screen/glass" },
      { key: "d.bath.sink", label: "Deep-clean sink, taps, remove limescale" },
      { key: "d.bath.grout", label: "Clean tiles & grout (no restoration promised)" },
      { key: "d.bath.doors", label: "Clean skirting, door surfaces, handles" },
      { key: "d.bath.cobwebs", label: "Remove cobwebs, clean corners & edges" },
      { key: "d.bath.floor", label: "Thoroughly vacuum, mop & check floor" },
    ],
  },
  {
    key: "d.bedrooms",
    title: "Bedrooms",
    items: [
      { key: "d.bed.dust", label: "Thoroughly dust furniture, shelves, fittings" },
      { key: "d.bed.skirting", label: "Clean accessible skirting boards" },
      { key: "d.bed.doors", label: "Clean door surfaces, frames & handles" },
      { key: "d.bed.cobwebs", label: "Remove cobwebs" },
      { key: "d.bed.behind", label: "Dust behind/under furniture (no heavy moving)" },
      { key: "d.bed.surfaces", label: "Clean hard furniture surfaces" },
      { key: "d.bed.linen", label: "Make bed; change linen if booked" },
      { key: "d.bed.carpets", label: "Thoroughly vacuum carpets, incl. edges" },
      { key: "d.bed.floors", label: "Vacuum/sweep & mop hard floors" },
      { key: "d.bed.bins", label: "Empty bins" },
    ],
  },
  {
    key: "d.living",
    title: "Living & dining",
    items: [
      { key: "d.liv.dust", label: "Thoroughly dust furniture, shelves, fittings" },
      { key: "d.liv.skirting", label: "Clean skirting boards" },
      { key: "d.liv.doors", label: "Clean door surfaces, frames & handles" },
      { key: "d.liv.cobwebs", label: "Remove cobwebs" },
      { key: "d.liv.behind", label: "Clean behind/under furniture (no heavy moving)" },
      { key: "d.liv.surfaces", label: "Clean appropriate hard surfaces" },
      { key: "d.liv.carpets", label: "Thoroughly vacuum carpets, incl. edges" },
      { key: "d.liv.floors", label: "Vacuum/sweep & mop hard floors" },
      { key: "d.liv.bins", label: "Empty bins; return moved items" },
    ],
  },
  {
    // Shown on every deep clean, not gated on an add-on, because the deep
    // price includes the oven in the kitchen (lib/deepClean.ts) and the site
    // promises it. The SOP sheet heads this block "IF BOOKED", which
    // contradicts that — flagged with SAAFI 2026-09-14. Until they rule,
    // including it keeps the cleaner's list and the customer's promise in
    // step; the cost of the wrong call this way is a cleaned oven.
    key: "d.oven",
    title: "Oven",
    items: [
      { key: "d.ov.racks", label: "Remove racks/trays & loose debris" },
      { key: "d.ov.product", label: "Apply oven-cleaning product/method" },
      { key: "d.ov.interior", label: "Clean interior, door glass & seals" },
      { key: "d.ov.exterior", label: "Clean racks, exterior, controls, handle" },
      { key: "d.ov.reassemble", label: "Reassemble; remove product residue" },
    ],
  },
  {
    key: "d.x.windows",
    title: "Windows (booked extra)",
    needsAddon: ["windows"],
    items: [{ key: "d.x.win.1", label: "Incl. external glass where safe" }],
  },
  {
    key: "d.x.laundry",
    title: "Laundry (booked extra)",
    needsAddon: ["laundry", "ironing"],
    items: [{ key: "d.x.lau.1", label: "Separate, treat stains, fold neatly" }],
  },
  {
    key: "d.x.dusting",
    title: "Dusting (booked extra)",
    needsAddon: ["dusting"],
    items: [{ key: "d.x.dus.1", label: "Fittings, skirting, behind furniture" }],
  },
  {
    key: "d.x.fridge",
    title: "Fridge (booked extra)",
    needsAddon: ["fridge"],
    items: [{ key: "d.x.fri.1", label: "Remove shelves, seals, dry before refill" }],
  },
  {
    key: "d.final",
    title: "Final check & sign-off",
    items: [
      { key: "d.fin.rooms", label: "Every booked room & extra completed" },
      { key: "d.fin.damage", label: "Stop if cleaning could damage a surface" },
      { key: "d.fin.returned", label: "Items returned, equipment removed, issues reported" },
    ],
  },
];

/**
 * The rules that apply to every job. Shown once, above the list, as a
 * reminder rather than tick-boxes: "never mix chemicals" is not a task you
 * complete, and making it tickable teaches people to tick without reading.
 */
export const COMPANY_RULES = [
  "Work systematically, top to bottom",
  "Never mix cleaning chemicals",
  "Use clean cloths & equipment",
  "No standing on unstable furniture; no heavy lifting",
  "Report damage immediately",
];

/** The sections for one job: the right service, and only the extras booked. */
export function checklistFor(booking: {
  service_type?: "standard" | "deep";
  addons?: { key: string }[] | null;
}): ChecklistSection[] {
  const sections = booking.service_type === "deep" ? DEEP : STANDARD;
  const booked = new Set((booking.addons ?? []).map((a) => a.key));
  return sections.filter((s) => !s.needsAddon || s.needsAddon.some((k) => booked.has(k)));
}

/** How many boxes this job's list has, for "18 of 24" style progress. */
export function checklistTotal(sections: ChecklistSection[]): number {
  return sections.reduce((n, s) => n + s.items.length, 0);
}

/** What a finished job stores. `done` holds item keys, never labels. */
export type ChecklistRecord = {
  v: 1;
  done: string[];
  total: number;
  at: string;
};

/** Labels for the keys left unticked — what the office actually wants to see. */
export function missingLabels(
  sections: ChecklistSection[],
  record: ChecklistRecord | null
): string[] {
  if (!record) return [];
  const done = new Set(record.done);
  return sections.flatMap((s) =>
    s.items.filter((i) => !done.has(i.key)).map((i) => `${s.title}: ${i.label}`)
  );
}
