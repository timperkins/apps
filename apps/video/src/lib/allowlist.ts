/** Parses a comma- or space-separated list of emails into a lowercase set. */
export function parseAllowlist(value: string | undefined): Set<string> {
  return new Set(
    (value ?? "")
      .split(/[\s,]+/)
      .map((email) => email.trim().toLowerCase())
      .filter(Boolean),
  );
}

/** True when a verified email is on the allowlist. */
export function isAllowed(
  allowlist: Set<string>,
  email: string | undefined,
  emailVerified: boolean | undefined,
): boolean {
  return Boolean(email && emailVerified && allowlist.has(email.toLowerCase()));
}
