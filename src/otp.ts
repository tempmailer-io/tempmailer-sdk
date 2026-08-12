/**
 * Client-side OTP extraction — the fallback used when the server hasn't
 * pre-extracted a code (server-side extraction is an Ultra+ feature).
 *
 * Strategy, in order: a code sitting next to a keyword ("code", "verification",
 * …) in the subject, then the body; then any standalone code (subject first).
 * Keyword-adjacency wins so an order number or year never beats the real code.
 * Digits inside URLs, <style>, and <script> are ignored.
 */

const CODE = "(?:[A-Z0-9]{3,6}-[A-Z0-9]{3,6}|[A-Z0-9]{4,8})";
const CODE_RE = new RegExp(`\\b(${CODE})\\b`, "gi");
const KEYWORDS =
  "(?:code|verification|verify|otp|passcode|one[- ]?time|pin|security)";

function stripNoise(s: string): string {
  return s
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/https?:\/\/\S+/gi, " ") // drop URLs (uids, ports, tracking ids)
    .replace(/<[^>]+>/g, " "); // strip remaining tags
}

/** A token is a code if it's all digits, a hyphenated code, or a letter+digit mix. */
function isCode(token: string): boolean {
  const t = token.toUpperCase();
  if (/^\d{4,8}$/.test(t)) return true;
  if (/^[A-Z0-9]{3,6}-[A-Z0-9]{3,6}$/.test(t) && /\d/.test(t)) return true;
  if (/^(?=.*[A-Z])(?=.*\d)[A-Z0-9]{4,8}$/.test(t)) return true;
  return false;
}

/** A code within ~40 chars after a keyword. */
function findContext(text: string): string | null {
  const re = new RegExp(`${KEYWORDS}[\\s\\S]{0,40}?\\b(${CODE})\\b`, "i");
  const m = re.exec(stripNoise(text));
  return m && isCode(m[1]) ? m[1] : null;
}

/** The first standalone code anywhere. */
function findBare(text: string): string | null {
  const matches = stripNoise(text).match(CODE_RE) ?? [];
  for (const m of matches) if (isCode(m)) return m;
  return null;
}

export function extractCode(subject: string | null, body: string): string | null {
  if (subject) {
    const c = findContext(subject);
    if (c) return c;
  }
  const bodyCtx = findContext(body);
  if (bodyCtx) return bodyCtx;

  if (subject) {
    const c = findBare(subject);
    if (c) return c;
  }
  return findBare(body);
}
