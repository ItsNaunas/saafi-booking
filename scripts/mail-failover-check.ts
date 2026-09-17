/**
 * The mail failover rule, asserted.
 *
 * lib/email.ts sends through Resend and falls back to Brevo. Which failures
 * are worth a second provider is the whole substance of that change: get it
 * wrong in one direction and a capped-out day silently loses every email; get
 * it wrong in the other and one bad address burns quota at both providers.
 *
 * Run: npx tsx scripts/mail-failover-check.ts
 */
import { shouldTryNextProvider } from "../src/lib/email";

let pass = 0;
let fail = 0;

function check(label: string, got: unknown, expected: unknown) {
  const ok = got === expected;
  console.log(`${ok ? "PASS" : "FAIL"}  ${label}: got ${got}, expected ${expected}`);
  if (ok) pass++;
  else fail++;
}

// --- worth trying the other provider ---
check("no reply at all (timeout/DNS) tries the next", shouldTryNextProvider(0), true);
check("429 rate limit tries the next", shouldTryNextProvider(429), true);
check("500 tries the next", shouldTryNextProvider(500), true);
check("502 tries the next", shouldTryNextProvider(502), true);
check("503 tries the next", shouldTryNextProvider(503), true);

// --- ours to fix; a second provider would reject it too ---
check("400 bad payload stops", shouldTryNextProvider(400), false);
check("401 bad key stops", shouldTryNextProvider(401), false);
check("403 sender not verified stops", shouldTryNextProvider(403), false);
check("404 stops", shouldTryNextProvider(404), false);
check("422 unprocessable stops", shouldTryNextProvider(422), false);

console.log(`\n${fail === 0 ? "All mail failover checks passed." : `${fail} FAILED`} (${pass}/${pass + fail})`);
process.exit(fail === 0 ? 0 : 1);
