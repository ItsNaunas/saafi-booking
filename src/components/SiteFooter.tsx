import Link from "next/link";
import { contact, socials } from "@/lib/business";

/**
 * The footer on every public page. Shared so the service pages carry the
 * same name, number and links as the home page — Google reads a business's
 * details from every page, and two footers drift.
 *
 * Service links go to the service pages (internal links are how those pages
 * get found and ranked); section links are absolute (`/#how`) so they work
 * from any page, not just the home page.
 */
const LINK =
  "outline-none transition hover:text-brand-400 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-brand-300";

export default function SiteFooter() {
  return (
    <footer className="bg-slate-900 text-slate-400">
      <div className="mx-auto grid max-w-6xl gap-10 px-4 py-14 sm:grid-cols-2 md:grid-cols-4">
        <div>
          <span className="text-lg font-bold tracking-tight text-white">
            SAAFI <span className="text-brand-400">Cleaning</span>
          </span>
          <p className="mt-3 text-sm leading-relaxed">
            Family-run home cleaning across Oxford and Oxfordshire, with a clear
            price for every visit and no surprises on the bill.
          </p>
        </div>
        <div>
          <h4 className="text-sm font-semibold uppercase tracking-wider text-white">Services</h4>
          <ul className="mt-4 space-y-2 text-sm">
            <li>
              <Link href="/regular-cleaning" className={LINK}>
                Regular cleaning
              </Link>
            </li>
            <li>
              <Link href="/one-off-cleaning" className={LINK}>
                One-off cleaning
              </Link>
            </li>
            <li>
              <Link href="/deep-cleaning" className={LINK}>
                Deep cleaning
              </Link>
            </li>
            <li>
              <Link href="/deep-cleaning#end-of-tenancy" className={LINK}>
                End of tenancy cleaning
              </Link>
            </li>
          </ul>
        </div>
        <div>
          <h4 className="text-sm font-semibold uppercase tracking-wider text-white">Company</h4>
          <ul className="mt-4 space-y-2 text-sm">
            <li>
              <Link href="/#how" className={LINK}>
                How it works
              </Link>
            </li>
            <li>
              <Link href="/#pricing" className={LINK}>
                Pricing
              </Link>
            </li>
            <li>
              <Link href="/#faqs" className={LINK}>
                FAQs
              </Link>
            </li>
            <li>
              <a href="mailto:info@saaficleaningservice.com?subject=Cleaning%20work" className={LINK}>
                Work with us
              </a>
            </li>
          </ul>
        </div>
        <div>
          <h4 className="text-sm font-semibold uppercase tracking-wider text-white">Get in touch</h4>
          <ul className="mt-4 space-y-2 text-sm">
            <li>
              <a href={`tel:${contact.phoneHref}`} className={`text-base font-semibold text-white ${LINK}`}>
                {contact.phoneDisplay}
              </a>
            </li>
            <li className="text-xs">{contact.hours}</li>
            <li className="pt-1">
              <a href={`mailto:${contact.email}`} className={LINK}>
                {contact.email}
              </a>
            </li>
            <li>
              <Link href="/#areas" className={LINK}>
                Areas we cover
              </Link>
            </li>
            {socials.map((s) => (
              <li key={s.label}>
                <a href={s.url} target="_blank" rel="noopener noreferrer" className={LINK}>
                  {s.label} · {s.handle}
                </a>
              </li>
            ))}
          </ul>
        </div>
      </div>
      <div className="border-t border-slate-800">
        <div className="mx-auto max-w-6xl px-4 py-6 text-center text-xs">
          © {new Date().getFullYear()} SAAFI Cleaning Service. All rights reserved.
        </div>
      </div>
    </footer>
  );
}
