/**
 * Town pages for searches like "cleaners Kidlington". Only towns already in
 * serviceAreas (lib/business.ts) — every one is a real place SAAFI covers.
 * Facts here are geography only (postcodes, where the town is); nothing about
 * the service is claimed that the service pages don't already say.
 */
export type Area = {
  slug: string;
  name: string;
  /** Outward codes, shown on the page and used to pre-fill the quote. */
  postcodes: string[];
  where: string;
  /** Neighbourhoods and villages people search by. */
  nearby: string[];
};

export const AREAS: Area[] = [
  {
    slug: "kidlington",
    name: "Kidlington",
    postcodes: ["OX5"],
    where: "just north of Oxford",
    nearby: ["Begbroke", "Yarnton", "Woodstock", "Islip", "Kirtlington"],
  },
  {
    slug: "abingdon",
    name: "Abingdon",
    postcodes: ["OX13", "OX14"],
    where: "south of Oxford on the Thames",
    nearby: ["Radley", "Drayton", "Sutton Courtenay", "Kennington", "Steventon"],
  },
  {
    slug: "witney",
    name: "Witney",
    postcodes: ["OX28", "OX29"],
    where: "west of Oxford",
    nearby: ["Ducklington", "Curbridge", "Hailey", "Eynsham", "Carterton"],
  },
  {
    slug: "bicester",
    name: "Bicester",
    postcodes: ["OX25", "OX26", "OX27"],
    where: "north-east of Oxford",
    nearby: ["Launton", "Ambrosden", "Chesterton", "Kingsmere", "Elmsbrook"],
  },
  {
    slug: "didcot",
    name: "Didcot",
    postcodes: ["OX11"],
    where: "south of Oxford",
    nearby: ["Harwell", "Blewbury", "Great Western Park", "Milton", "Cholsey"],
  },
];

export const areaBySlug = (slug: string) => AREAS.find((a) => a.slug === slug);
