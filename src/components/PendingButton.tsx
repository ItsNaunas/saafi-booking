"use client";

// A submit button that shows the form is actually doing something.
//
// Every admin and cleaner action used to be fire-and-hope: no pending state,
// no disable, and on a slow connection the only feedback was the page
// eventually changing — or not. A double-tap on "Finish job" was safe on the
// server but invisible on the phone. This wraps useFormStatus so any server-
// action form gets a working state for one import.

import { useFormStatus } from "react-dom";

export default function PendingButton({
  children,
  pendingLabel = "Working…",
  className,
  name,
  value,
}: {
  children: React.ReactNode;
  pendingLabel?: string;
  className?: string;
  /** For forms with several submit buttons: which one was pressed. */
  name?: string;
  value?: string;
}) {
  const { pending } = useFormStatus();
  return (
    <button name={name} value={value} disabled={pending} className={`${className ?? ""} disabled:opacity-60`}>
      {pending ? pendingLabel : children}
    </button>
  );
}
