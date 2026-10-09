import Link from "next/link";
import { formatGBP } from "@/lib/pricing";
import type { HomeRow } from "@/lib/guidePrices";

/** Long-form article typography, without pulling in a typography plugin. */
export function Prose({ children }: { children: React.ReactNode }) {
  return (
    <div
      className={[
        "text-[17px] leading-relaxed text-slate-700",
        "[&_h2]:mt-12 [&_h2]:font-display [&_h2]:text-2xl [&_h2]:font-bold [&_h2]:tracking-tight [&_h2]:text-slate-900",
        "[&_h3]:mt-8 [&_h3]:text-lg [&_h3]:font-semibold [&_h3]:text-slate-900",
        "[&_p]:mt-4 [&_ul]:mt-4 [&_ul]:list-disc [&_ul]:space-y-2 [&_ul]:pl-6",
        "[&_ol]:mt-4 [&_ol]:list-decimal [&_ol]:space-y-2 [&_ol]:pl-6",
        "[&_strong]:font-semibold [&_strong]:text-slate-900",
        "[&_a]:font-medium [&_a]:text-brand-700 [&_a]:underline [&_a]:underline-offset-4",
      ].join(" ")}
    >
      {children}
    </div>
  );
}

type Col = "oneOff" | "fortnightly" | "weekly" | "deep";
const COL_LABEL: Record<Col, string> = {
  oneOff: "One-off clean",
  fortnightly: "Fortnightly",
  weekly: "Weekly",
  deep: "Deep clean",
};

/** Per-visit prices by home size, from the live config. */
export function PriceTable({ homes, cols }: { homes: HomeRow[]; cols: Col[] }) {
  return (
    <div className="mt-6 overflow-x-auto">
      <table className="w-full min-w-[28rem] border-collapse text-left text-[15px]">
        <thead>
          <tr className="border-b-2 border-slate-900">
            <th className="py-3 pr-4 font-semibold text-slate-900">Home</th>
            {cols.map((c) => (
              <th key={c} className="py-3 pr-4 font-semibold text-slate-900">
                {COL_LABEL[c]}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {homes.map((h) => (
            <tr key={h.label} className="border-b border-slate-200">
              <td className="py-3 pr-4">{h.label}</td>
              {cols.map((c) => (
                <td key={c} className="tnum py-3 pr-4 font-semibold text-slate-900">
                  {formatGBP(h[c])}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function GuideCta({ href = "/quote", text = "See your exact price" }: { href?: string; text?: string }) {
  return (
    <div className="mt-12 bg-brand-50 p-6 sm:p-8">
      <p className="font-display text-xl font-bold text-slate-900">Want the price for your home?</p>
      <p className="mt-2 text-slate-600">
        Pick your rooms and see the price in under a minute. We ring to confirm the date.
      </p>
      <Link
        href={href}
        className="mt-5 inline-flex items-center justify-center rounded-full bg-slate-900 px-6 py-3 text-sm font-semibold text-white no-underline transition hover:bg-slate-800"
      >
        {text}
      </Link>
    </div>
  );
}
