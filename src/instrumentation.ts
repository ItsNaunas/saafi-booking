import type { Instrumentation } from "next";
import { sendOpsAlertEmail } from "@/lib/email";

// Server errors reach a human. Until this existed, a crash on a cleaner's
// link (Supabase 504, 2026-09-13) lived only in Vercel's logs — Dulla found
// it by being told "it doesn't work", two days later. Now the same failure
// emails the office with the route, the message and the digest that matches
// what the visitor's "Try again" screen would show.
//
// Throttled per error digest so a bad ten minutes sends one email, not one
// per request. The map is per server instance, which is fine: the aim is
// "not silent", not "exactly once".

const QUIET_MS = 15 * 60 * 1000;
const lastSent = new Map<string, number>();

// Next signals redirects and not-found by throwing; they are control flow,
// not failures, and must never page anyone.
const CONTROL_FLOW = /NEXT_REDIRECT|NEXT_NOT_FOUND|NEXT_HTTP_ERROR_FALLBACK/;

export const onRequestError: Instrumentation.onRequestError = async (err, request, context) => {
  const message = err instanceof Error ? err.message : String(err);
  if (CONTROL_FLOW.test(message)) return;

  const digest =
    typeof err === "object" && err !== null && "digest" in err
      ? String((err as { digest: unknown }).digest)
      : message.slice(0, 80);

  const now = Date.now();
  const prev = lastSent.get(digest);
  if (prev && now - prev < QUIET_MS) return;
  lastSent.set(digest, now);

  const stack = err instanceof Error && err.stack ? err.stack.split("\n").slice(0, 6).join("\n") : "";

  // Headers deliberately not forwarded: they carry the admin session cookie.
  await sendOpsAlertEmail({
    subject: `Site error — ${request.method} ${request.path}`,
    heading: "Something broke on the site",
    lines: [
      "A visitor hit a server error. They saw a 'try again' screen; nothing they entered is lost, but if it keeps happening something needs fixing.",
      stack ? `Stack (first lines):\n${stack}` : "",
    ].filter(Boolean),
    rows: [
      ["Route", `${request.method} ${request.path}`],
      ["Handler", `${context.routePath} (${context.routeType}, ${context.routerKind})`],
      ["Message", message],
      ["Digest", digest],
      ["When", new Date(now).toISOString()],
    ],
  }).catch(() => {});
};
