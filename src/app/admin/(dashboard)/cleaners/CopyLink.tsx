"use client";

// Copy-to-clipboard + WhatsApp shortcut for a cleaner's job link. Before this,
// sending someone their link meant selecting the <code> text by hand and
// finding WhatsApp yourself — two clicks now do both.

import { useState } from "react";

export default function CopyLink({ url, phone }: { url: string; phone: string | undefined }) {
  const [copied, setCopied] = useState(false);

  const message = `Here's your SAAFI job link: ${url}`;
  const digits = phone ? phone.replace(/\D/g, "") : "";
  const waHref = digits
    ? `https://wa.me/${digits}?text=${encodeURIComponent(message)}`
    : `https://wa.me/?text=${encodeURIComponent(message)}`;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard permission denied or unavailable — the code block is still
      // there to select by hand.
    }
  };

  return (
    <span className="ml-2 inline-flex items-center gap-2">
      <button
        type="button"
        onClick={copy}
        className="border border-slate-300 bg-white px-2 py-1 text-xs font-medium text-slate-600 hover:bg-slate-50"
      >
        {copied ? "Copied ✓" : "Copy link"}
      </button>
      <a
        href={waHref}
        target="_blank"
        rel="noreferrer"
        className="border border-brand-600 px-2 py-1 text-xs font-medium text-brand-700 hover:bg-brand-50"
      >
        Send on WhatsApp
      </a>
    </span>
  );
}
