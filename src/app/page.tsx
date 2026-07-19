import Link from "next/link";

const INCLUDED = [
  "Kitchen deep-wipe & surfaces",
  "Lounge & living spaces",
  "Hallways, stairs & landings",
  "Dusting & hoovering throughout",
];

const STEPS = [
  { n: "1", title: "Tell us about your home", text: "Postcode, rooms, and how long you'd like us to stay." },
  { n: "2", title: "Get an instant price", text: "Clear hourly pricing — no hidden extras, ever." },
  { n: "3", title: "We confirm by phone", text: "A quick call to lock in your date and time." },
];

export default function Home() {
  return (
    <main className="min-h-screen bg-white">
      {/* nav */}
      <header className="border-b border-slate-100">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-4">
          <span className="text-lg font-bold tracking-tight text-slate-900">
            SAAFI <span className="text-emerald-600">Cleaning</span>
          </span>
          <Link
            href="/quote"
            className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-700"
          >
            Free quote
          </Link>
        </div>
      </header>

      {/* hero */}
      <section className="mx-auto max-w-5xl px-4 pb-16 pt-20 text-center">
        <p className="mb-3 text-sm font-semibold uppercase tracking-widest text-emerald-600">
          Family-run · Fully committed to your home
        </p>
        <h1 className="mx-auto max-w-2xl text-4xl font-extrabold tracking-tight text-slate-900 sm:text-5xl">
          A spotless home, <span className="text-emerald-600">without the hassle</span>
        </h1>
        <p className="mx-auto mt-4 max-w-xl text-lg text-slate-600">
          Get an instant price for your clean in under a minute. Pick your rooms, choose your
          hours, and we&apos;ll take care of the rest.
        </p>
        <div className="mt-8 flex items-center justify-center gap-4">
          <Link
            href="/quote"
            className="rounded-xl bg-emerald-600 px-8 py-3.5 text-lg font-semibold text-white shadow-md transition hover:bg-emerald-700"
          >
            Get my free quote →
          </Link>
        </div>
        <p className="mt-3 text-sm text-slate-400">Takes under a minute · No payment needed</p>
      </section>

      {/* always included */}
      <section className="bg-slate-50 py-14">
        <div className="mx-auto max-w-5xl px-4">
          <h2 className="text-center text-2xl font-bold text-slate-900">
            Always included, every clean
          </h2>
          <div className="mx-auto mt-8 grid max-w-3xl grid-cols-1 gap-4 sm:grid-cols-2">
            {INCLUDED.map((item) => (
              <div
                key={item}
                className="flex items-center gap-3 rounded-xl bg-white p-4 shadow-sm ring-1 ring-slate-100"
              >
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-emerald-100 font-bold text-emerald-700">
                  ✓
                </span>
                <span className="font-medium text-slate-700">{item}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* how it works */}
      <section className="py-16">
        <div className="mx-auto max-w-5xl px-4">
          <h2 className="text-center text-2xl font-bold text-slate-900">How it works</h2>
          <div className="mt-10 grid gap-8 sm:grid-cols-3">
            {STEPS.map((s) => (
              <div key={s.n} className="text-center">
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-emerald-600 text-xl font-bold text-white">
                  {s.n}
                </div>
                <h3 className="mt-4 font-semibold text-slate-900">{s.title}</h3>
                <p className="mt-1 text-sm text-slate-500">{s.text}</p>
              </div>
            ))}
          </div>
          <div className="mt-12 text-center">
            <Link
              href="/quote"
              className="rounded-xl bg-emerald-600 px-8 py-3.5 text-lg font-semibold text-white shadow-md transition hover:bg-emerald-700"
            >
              Start my quote
            </Link>
          </div>
        </div>
      </section>

      <footer className="border-t border-slate-100 py-8 text-center text-sm text-slate-400">
        © {new Date().getFullYear()} SAAFI Cleaning Service · saaficleaningservice.com
      </footer>
    </main>
  );
}
