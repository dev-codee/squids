export function readProductCatalogParams(params: Record<string, string | string[] | undefined>) {
  const str = (key: string) => typeof params[key] === "string" ? (params[key] as string).trim().slice(0, 160) : "";
  const price = (key: string) => str(key) && Number.isFinite(Number(str(key))) && Number(str(key)) >= 0 ? Number(str(key)) : undefined;
  const min = price("min"), max = price("max");
  const currency = /^[A-Za-z]{3}$/.test(str("currency")) ? str("currency").toUpperCase() : "";
  const rawPage = Number(str("page"));
  return {
    search: str("search"), category: str("category"), brand: str("brand"),
    size: str("size"), condition: str("condition"), currency,
    inStockOnly: str("stock") === "1",
    minPrice: min !== undefined && max !== undefined ? Math.min(min, max) : min,
    maxPrice: min !== undefined && max !== undefined ? Math.max(min, max) : max,
    page: Number.isFinite(rawPage) && rawPage >= 1 ? Math.floor(rawPage) : 1,
    sort: (str("sort") === "price-asc" || str("sort") === "price-desc" ? str("sort") : "relevance") as "relevance" | "price-asc" | "price-desc",
    view: (str("view") === "list" ? "list" : "grid") as "list" | "grid",
  };
}

export function escapeProductSearch(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
