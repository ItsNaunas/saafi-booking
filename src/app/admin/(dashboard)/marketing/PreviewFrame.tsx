"use client";

// The real email HTML in a sandboxed frame, at phone or desktop width —
// most of SAAFI's customers will read it on a phone.

import { useState } from "react";

export default function PreviewFrame({ html, subject }: { html: string; subject: string }) {
  const [phone, setPhone] = useState(true);
  return (
    <div className="bg-slate-100 p-3">
      <div className="mb-2 flex items-center justify-between gap-2">
        <p className="min-w-0 truncate text-xs text-slate-500">
          <span className="font-semibold uppercase tracking-wide text-slate-400">Subject</span> {subject || "(no subject yet)"}
        </p>
        <div className="flex shrink-0 text-xs ring-1 ring-slate-300">
          {[
            [true, "Phone"],
            [false, "Desktop"],
          ].map(([v, label]) => (
            <button
              key={String(label)}
              type="button"
              onClick={() => setPhone(v as boolean)}
              aria-pressed={phone === v}
              className={`px-2.5 py-1 font-medium ${phone === v ? "bg-slate-800 text-white" : "bg-white text-slate-600"}`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>
      <iframe
        title="Email preview"
        sandbox=""
        srcDoc={html}
        className="mx-auto block h-[620px] bg-white transition-[width]"
        style={{ width: phone ? 375 : "100%", maxWidth: "100%" }}
      />
    </div>
  );
}
