/** Normalize a Date or ISO string to an ISO string (or undefined). */
export function toIso(d?: string | Date): string | undefined {
  if (!d) return undefined;
  return typeof d === "string" ? d : d.toISOString();
}

/** Pick the most likely action link from a parsed link list. */
export function pickLink(links: string[]): string | null {
  if (!links.length) return null;
  const preferred = links.find((l) =>
    /(verify|confirm|activate|magic|login|signin|sign-in|auth|token)/i.test(l),
  );
  return preferred ?? links[0];
}
