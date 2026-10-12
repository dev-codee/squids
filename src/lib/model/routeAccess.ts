/** Public reports may be submitted, but only administrators can read or review them. */
export function requiresAdmin(pathname: string, method: string): boolean {
  const within = (base: string) => pathname === base || pathname.startsWith(`${base}/`);
  return within("/dashboard") || within("/api/admin") || within("/api/transactions") ||
    within("/api/networks/earnings") || (within("/api/corrections") && method !== "POST");
}
