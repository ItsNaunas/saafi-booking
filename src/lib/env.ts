/**
 * Reading secrets out of the environment, defensively.
 *
 * A key pasted into a dashboard can arrive carrying an invisible byte order mark
 * (U+FEFF) or a zero-width space — copy it from a file saved as UTF-8-with-BOM, or
 * from a web page, and you get one for free. It is invisible everywhere you would
 * think to look, and the key is otherwise perfectly correct.
 *
 * It only surfaces at the moment the value becomes an HTTP header, as:
 *
 *   TypeError: Cannot convert argument to a ByteString because the character at
 *   index 7 has a value of 65279 which is greater than 255
 *
 * (index 7 because "Bearer " is seven characters, so the offender is the first
 * character of the key). That cost every booking-alert email on 2026-08-25 until
 * the production logs were read. Strip it once, here, rather than rediscovering
 * it per integration.
 *
 * Characters are filtered by code point rather than by a regex literal, because a
 * source file containing invisible characters is its own kind of trap.
 */

const STRIPPED = new Set([
  0xfeff, // byte order mark / zero-width no-break space
  0x200b, // zero-width space
  0x200c, // zero-width non-joiner
  0x200d, // zero-width joiner
  0x2060, // word joiner
]);

/** A trimmed env value with invisible junk removed. Empty or absent -> undefined. */
export function secret(name: string): string | undefined {
  const raw = process.env[name];
  if (raw === undefined) return undefined;

  const clean = Array.from(raw)
    .filter((ch) => !STRIPPED.has(ch.codePointAt(0) ?? 0))
    .join("")
    .trim();

  return clean === "" ? undefined : clean;
}

/** True when a value is present and usable once cleaned. */
export function hasSecret(name: string): boolean {
  return secret(name) !== undefined;
}
