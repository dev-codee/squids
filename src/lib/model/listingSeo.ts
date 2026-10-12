export type SearchParams = Record<string, string | string[] | undefined>;

/** Canonical pagination keeps distinct result pages discoverable. */
export function listingSeo(base: string, params: SearchParams, options: { tab?: string; refined?: boolean } = {}) {
  const raw = typeof params.page === "string" ? Number(params.page) : 1;
  const page = Number.isSafeInteger(raw) && raw > 0 ? raw : 1;
  const query = new URLSearchParams();
  if (options.tab) query.set("tab", options.tab);
  if (page > 1) query.set("page", String(page));
  return {
    canonical: `${base}${query.size ? `?${query}` : ""}`,
    robots: { index: !options.refined, follow: true },
  };
}
