/**
 * Shared Affiliate Tracking Link Resolver
 *
 * Ensures all outbound store/deal URLs route through the publisher's official
 * affiliate tracking links with our publisher ID across all networks.
 */

export const DEFAULT_CF_AFFILIATE_ID = "89228";
export const DEFAULT_AWIN_PUBLISHER_ID = "1353171";

export function getCfAffiliateId(): string {
  return (
    process.env.CF_AFFILIATE_ID ||
    process.env.NEXT_PUBLIC_CF_AFFILIATE_ID ||
    DEFAULT_CF_AFFILIATE_ID
  );
}

export function getAwinPublisherId(): string {
  return (
    process.env.AWIN_PUBLISHER_ID ||
    process.env.NEXT_PUBLIC_AWIN_PUBLISHER_ID ||
    DEFAULT_AWIN_PUBLISHER_ID
  );
}

/**
 * Force an existing Awin tracking link to carry OUR publisher (affiliate) ID,
 * rewriting any foreign `awinaffid=`/`id=` value that came from the feed.
 */
function enforceAwinPublisherId(url: string): string {
  const ourId = getAwinPublisherId();
  return url
    .replace(/([?&]awinaffid=)\d+/i, `$1${ourId}`)
    .replace(/([?&]id=)\d+/i, `$1${ourId}`);
}

/**
 * Force an existing Commission Factory (`t.cfjump.com/{affId}/t/{advId}`) link to
 * carry OUR affiliate ID in the leading path segment.
 */
function enforceCfAffiliateId(url: string): string {
  const ourId = getCfAffiliateId();
  return url.replace(/(cfjump\.com\/)\d+(\/)/i, `$1${ourId}$2`);
}

/**
 * Returns a guaranteed affiliate tracking URL with our publisher ID.
 *
 * If the provided `rawUrl` is already an affiliate tracking link (e.g. `cfjump.com`,
 * `awin1.com`, `admitad.com`, `/g/`), our publisher ID is enforced on it — a
 * foreign affiliate ID baked into the feed URL is rewritten to ours, so we never
 * hand traffic to another publisher.
 *
 * If `rawUrl` is a plain merchant homepage or empty, it generates the network
 * tracking redirect with our publisher ID.
 */
export function resolveAffiliateTrackingUrl(
  network?: string | null,
  advertiserId?: number | string | null,
  rawUrl?: string | null,
): string {
  const net = (network || "awin").toLowerCase().trim();
  const advId = Number(advertiserId);

  // Already a tracking link — enforce our publisher ID on the networks we
  // control the ID format for, and preserve the rest as-is.
  if (rawUrl && rawUrl.includes("awin1.com")) {
    return enforceAwinPublisherId(rawUrl);
  }
  if (rawUrl && rawUrl.includes("cfjump.com")) {
    return enforceCfAffiliateId(rawUrl);
  }
  if (rawUrl && (rawUrl.includes("admitad.com") || rawUrl.includes("/g/"))) {
    return rawUrl;
  }

  // Commission Factory
  if (net === "commission-factory" && advId) {
    const cfId = getCfAffiliateId();
    if (rawUrl && rawUrl.startsWith("http") && !rawUrl.includes("cfjump.com")) {
      return `https://t.cfjump.com/${cfId}/t/${advId}?Url=${encodeURIComponent(rawUrl)}`;
    }
    return `https://t.cfjump.com/${cfId}/t/${advId}`;
  }

  // Awin
  if (net === "awin" && advId) {
    const awinId = getAwinPublisherId();
    if (rawUrl && rawUrl.startsWith("http") && !rawUrl.includes("awin1.com")) {
      return `https://www.awin1.com/cread.php?awinmid=${advId}&awinaffid=${awinId}&ued=${encodeURIComponent(rawUrl)}`;
    }
    return `https://www.awin1.com/awclick.php?mid=${advId}&id=${awinId}`;
  }

  return rawUrl || "#";
}
