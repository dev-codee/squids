/** Escape URL text for XML, including query-string ampersands. */
export function escapeXml(value: string): string {
  return value.replace(/[<>&"']/g, char => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;", "'": "&apos;" })[char]!);
}

export function sitemapXml(urls: string[], index = false): string {
  const root = index ? "sitemapindex" : "urlset";
  const entry = index ? "sitemap" : "url";
  return `<?xml version="1.0" encoding="UTF-8"?><${root} xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls.map(url => `<${entry}><loc>${escapeXml(url)}</loc></${entry}>`).join("")}</${root}>`;
}

// At most 1,000 unique integer product IDs per shard, even as records change.
// With 36 supported markets this stays below the 50,000 URL sitemap limit.
export const PRODUCT_SITEMAP_SHARD_SIZE = 1000;
