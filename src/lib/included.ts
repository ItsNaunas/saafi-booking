// What a clean covers, in the customer's words. The source is SAAFI's own
// "CLEANER SOP CHECKLIST" (PDF, 2026-08-26) — the same sheet lib/checklist.ts
// gives the cleaners. Naunas 2026-11-05: the PDF is the source of truth.
//
// Every line names the checklist keys it stands for (`sop`), and
// scripts/included-check.ts fails if any of them stop existing. That is the
// guard against the site promising something the cleaner's list doesn't ask
// for. A line may summarise several checklist items; it may never add one.
//
// Still open with SAAFI (2026-11-05), so deliberately NOT written here yet:
// hallways & landings (the site sells them, the SOP has no section for them),
// linen changes (SOP says "if booked", there is no extra to book), and the
// oven (SOP: deep only, if booked — the site and the £235 deep base still
// include it until they confirm the price).

export type IncludedRoom = {
  title: string;
  /** One line for cards and the home page. */
  summary: string;
  items: { text: string; sop: string[] }[];
};

export const STANDARD_ROOMS: IncludedRoom[] = [
  {
    title: "Kitchen",
    summary: "Worktops, hob, sink and cupboard fronts cleaned, floor mopped, bin emptied.",
    items: [
      { text: "Worktops cleaned and disinfected, food marks removed", sop: ["s.kit.worktops", "s.kit.residue"] },
      { text: "Splashback", sop: ["s.kit.splashback"] },
      { text: "Cupboard doors and handles wiped", sop: ["s.kit.cupboards"] },
      { text: "Outsides of appliances wiped", sop: ["s.kit.appliances"] },
      { text: "Hob, controls and surrounds", sop: ["s.kit.hob"] },
      { text: "Sink and taps cleaned and disinfected", sop: ["s.kit.sink"] },
      { text: "Floor vacuumed or swept, and mopped", sop: ["s.kit.floor"] },
      { text: "Bin emptied, with a fresh liner", sop: ["s.kit.bin"] },
    ],
  },
  {
    title: "Bathrooms",
    summary: "Toilet, bath or shower, sink and mirror cleaned, tiles wiped, floor mopped.",
    items: [
      { text: "Toilet bowl, seat and lid cleaned and disinfected", sop: ["s.bath.toilet"] },
      { text: "Bath and shower, soap residue removed", sop: ["s.bath.shower", "s.bath.soap"] },
      { text: "Shower fittings", sop: ["s.bath.fittings"] },
      { text: "Sink and taps cleaned and disinfected", sop: ["s.bath.sink"] },
      { text: "Mirror and glass you can reach", sop: ["s.bath.mirror"] },
      { text: "Tiles and door handles wiped", sop: ["s.bath.tiles"] },
      { text: "Floor vacuumed or swept, and mopped", sop: ["s.bath.floor"] },
    ],
  },
  {
    title: "Bedrooms",
    summary: "Dusted and wiped, carpets vacuumed, hard floors mopped, bed made if you ask.",
    items: [
      { text: "Furniture, shelves and ledges dusted", sop: ["s.bed.dust"] },
      { text: "Hard surfaces wiped", sop: ["s.bed.surfaces"] },
      { text: "Cobwebs removed", sop: ["s.bed.cobwebs"] },
      { text: "Door handles and skirting wiped", sop: ["s.bed.handles", "s.bed.skirting"] },
      { text: "Bed made if you'd like it", sop: ["s.bed.bed"] },
      { text: "Carpets and rugs vacuumed thoroughly", sop: ["s.bed.carpets"] },
      { text: "Hard floors vacuumed or swept, and mopped", sop: ["s.bed.floors"] },
    ],
  },
  {
    title: "Living & dining",
    summary: "Dusted, handles and high-touch points wiped, floors done, things put back.",
    items: [
      { text: "Furniture, shelves and ledges dusted", sop: ["s.liv.dust"] },
      { text: "Hard surfaces wiped", sop: ["s.liv.surfaces"] },
      { text: "Cobwebs removed", sop: ["s.liv.cobwebs"] },
      { text: "Handles and high-touch points wiped", sop: ["s.liv.touch"] },
      { text: "Skirting dusted", sop: ["s.liv.skirting"] },
      { text: "Carpets and rugs vacuumed thoroughly", sop: ["s.liv.carpets"] },
      { text: "Hard floors vacuumed or swept, and mopped", sop: ["s.liv.floors"] },
      { text: "Anything we move put back where it was", sop: ["s.liv.return"] },
    ],
  },
];

export const DEEP_ROOMS: IncludedRoom[] = [
  {
    title: "Kitchen",
    summary: "Cleared and degreased, limescale off, into the corners and behind the furniture.",
    items: [
      { text: "Worktops cleared and cleaned right into the corners and edges", sop: ["d.kit.worktops"] },
      { text: "Grease and build-up removed", sop: ["d.kit.grease"] },
      { text: "Splashback deep-cleaned", sop: ["d.kit.splashback"] },
      { text: "Cupboard fronts and handles", sop: ["d.kit.cupboards"] },
      { text: "Outsides of appliances and the build-up around them", sop: ["d.kit.appliances"] },
      { text: "Hob, controls and surrounds degreased", sop: ["d.kit.hob"] },
      { text: "Sink and taps deep-cleaned, limescale removed", sop: ["d.kit.sink"] },
      { text: "Skirting, floor edges and corners, cobwebs removed", sop: ["d.kit.skirting"] },
      { text: "Behind and under the furniture", sop: ["d.kit.behind"] },
      { text: "Floor thoroughly vacuumed and mopped", sop: ["d.kit.floor"] },
      { text: "Bin emptied and disinfected, with a fresh liner", sop: ["d.kit.bin"] },
    ],
  },
  {
    title: "Bathrooms",
    summary: "Soap scum and limescale off, tiles and grout cleaned, the toilet base included.",
    items: [
      { text: "Toilet bowl, seat, lid and base deep-cleaned", sop: ["d.bath.toilet"] },
      { text: "Bath and shower cleaned right into the corners", sop: ["d.bath.shower"] },
      { text: "Soap scum and limescale removed", sop: ["d.bath.scum"] },
      { text: "Shower fittings, screen and glass", sop: ["d.bath.fittings"] },
      { text: "Sink and taps deep-cleaned, limescale removed", sop: ["d.bath.sink"] },
      { text: "Tiles and grout cleaned", sop: ["d.bath.grout"] },
      { text: "Skirting, door surfaces and handles", sop: ["d.bath.doors"] },
      { text: "Cobwebs, corners and edges", sop: ["d.bath.cobwebs"] },
      { text: "Floor thoroughly vacuumed and mopped", sop: ["d.bath.floor"] },
    ],
  },
  {
    title: "Bedrooms",
    summary: "Thorough dusting, skirting and door frames, behind and under the furniture.",
    items: [
      { text: "Furniture, shelves and fittings thoroughly dusted", sop: ["d.bed.dust"] },
      { text: "Skirting boards you can reach", sop: ["d.bed.skirting"] },
      { text: "Doors, frames and handles", sop: ["d.bed.doors"] },
      { text: "Cobwebs removed", sop: ["d.bed.cobwebs"] },
      { text: "Behind and under the furniture", sop: ["d.bed.behind"] },
      { text: "Hard furniture surfaces cleaned", sop: ["d.bed.surfaces"] },
      { text: "Bed made", sop: ["d.bed.linen"] },
      { text: "Carpets vacuumed right to the edges", sop: ["d.bed.carpets"] },
      { text: "Hard floors vacuumed or swept, and mopped", sop: ["d.bed.floors"] },
      { text: "Bins emptied", sop: ["d.bed.bins"] },
    ],
  },
  {
    title: "Living & dining",
    summary: "Thorough dusting, skirting and door frames, behind and under the furniture.",
    items: [
      { text: "Furniture, shelves and fittings thoroughly dusted", sop: ["d.liv.dust"] },
      { text: "Skirting boards", sop: ["d.liv.skirting"] },
      { text: "Doors, frames and handles", sop: ["d.liv.doors"] },
      { text: "Cobwebs removed", sop: ["d.liv.cobwebs"] },
      { text: "Behind and under the furniture", sop: ["d.liv.behind"] },
      { text: "Hard surfaces cleaned", sop: ["d.liv.surfaces"] },
      { text: "Carpets vacuumed right to the edges", sop: ["d.liv.carpets"] },
      { text: "Hard floors vacuumed or swept, and mopped", sop: ["d.liv.floors"] },
      { text: "Bins emptied and anything we move put back", sop: ["d.liv.bins"] },
    ],
  },
];

/**
 * What each extra covers, by add-on key. Shown under the extra on the quote
 * form and on the service pages. No oven line yet — see the header.
 */
export const STANDARD_EXTRA_COVERS: Record<string, { text: string; sop: string[] }> = {
  windows: { text: "Inside glass, sills and frames", sop: ["s.x.win.1"] },
  ironing: { text: "Washed, dried, folded and put back", sop: ["s.x.lau.1"] },
  laundry: { text: "Washed, dried, folded and put back", sop: ["s.x.lau.1"] },
  dusting: { text: "Furniture, surfaces and shelves", sop: ["s.x.dus.1"] },
  fridge: { text: "Shelves, drawers and the outside", sop: ["s.x.fri.1"] },
};

export const DEEP_EXTRA_COVERS: Record<string, { text: string; sop: string[] }> = {
  windows: { text: "Inside, plus outside glass where it's safe", sop: ["d.x.win.1"] },
  laundry: { text: "Sorted, stains treated, folded neatly", sop: ["d.x.lau.1"] },
  dusting: { text: "Fittings, skirting and behind furniture", sop: ["d.x.dus.1"] },
  fridge: { text: "Shelves out, seals cleaned, dried before refilling", sop: ["d.x.fri.1"] },
};

/** The SOP's company-wide rules, as limits a customer should know about. */
export const WE_DONT = [
  { text: "Move heavy furniture — we clean behind and under what can be moved safely", sop: ["d.kit.behind"] },
  { text: "Stand on unstable furniture to reach high places", sop: [] },
  { text: "Use a product we think could damage a surface — we stop and leave it rather than risk it", sop: ["d.fin.damage"] },
  { text: "Restore grout — we clean it, but stained or worn grout may not come back like new", sop: ["d.bath.grout"] },
  { text: "Clean outside windows unless it's safe to reach them", sop: ["d.x.win.1"] },
];

/** The SOP's final check & sign-off. */
export const BEFORE_WE_LEAVE = [
  { text: "Every room and extra you booked is done", sop: ["s.fin.rooms", "d.fin.rooms"] },
  { text: "Floors, surfaces and mirrors checked", sop: ["s.fin.checked"] },
  { text: "Everything put back where it was", sop: ["s.fin.returned", "d.fin.returned"] },
  { text: "Our equipment out and the property left secure", sop: ["s.fin.secure"] },
  { text: "Any damage or problem reported straight away", sop: ["s.fin.reported"] },
];
