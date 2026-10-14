"use client";

// A submit button that asks first. For the actions a mis-tap shouldn't be
// able to do on its own: removing a calendar, deleting a draft.

import { useFormStatus } from "react-dom";

export default function ConfirmButton({
  children,
  confirm,
  pendingLabel = "…",
  className,
  name,
  value,
}: {
  children: React.ReactNode;
  /** For forms with several submit buttons: which one was pressed. */
  name?: string;
  value?: string;
  /** The question in the "are you sure?" box. */
  confirm: string;
  pendingLabel?: string;
  className?: string;
}) {
  const { pending } = useFormStatus();
  return (
    <button
      name={name}
      value={value}
      disabled={pending}
      onClick={(e) => {
        if (!window.confirm(confirm)) e.preventDefault();
      }}
      className={`${className ?? ""} disabled:opacity-60`}
    >
      {pending ? pendingLabel : children}
    </button>
  );
}
