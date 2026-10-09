import Link from "next/link";
import { contact } from "@/lib/business";

/**
 * The light header for every public page that isn't the home page (which has
 * its own over the hero photo). `quoteHref` lets a page pre-select its own
 * service on the quote form.
 */
export default function SiteHeader({ quoteHref = "/quote" }: { quoteHref?: string }) {
  return (
    <header className="border-b border-slate-200 bg-white">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-5 py-5 sm:px-8">
        <Link href="/" className="text-xl font-bold tracking-tight text-slate-900">
          SAAFI <span className="text-brand-600">Cleaning</span>
        </Link>
        <div className="flex shrink-0 items-center gap-4">
          <Link href="/guides" className="hidden text-sm font-medium text-slate-600 hover:text-slate-900 sm:block">
            Guides
          </Link>
          <a
            href={`tel:${contact.phoneHref}`}
            className="hidden text-sm font-semibold text-slate-900 hover:text-brand-600 sm:block"
          >
            {contact.phoneDisplay}
          </a>
          <Link
            href={quoteHref}
            className="inline-flex items-center justify-center rounded-full bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white outline-none transition hover:bg-slate-800 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-brand-300"
          >
            Get a quote
          </Link>
        </div>
      </div>
    </header>
  );
}
