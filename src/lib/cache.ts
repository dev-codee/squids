/**
 * Public-page caching helpers.
 *
 * Hot, read-only data for the public site is wrapped in Next's Data Cache
 * (`unstable_cache`) with a short revalidate window AND a cache tag. Admin
 * mutations call {@link revalidatePublic} so edits appear immediately instead of
 * waiting out the window. Anonymous traffic is served from cache, sparing MongoDB.
 */

import { revalidateTag } from "next/cache";

/** How long (seconds) cached public data may be served before revalidation. */
export const PUBLIC_REVALIDATE = 60;

/** Cache tags grouping related public data so it can be invalidated together. */
export const CACHE_TAGS = {
  advertisers: "public:advertisers",
  deals: "public:deals",
  categories: "public:categories",
  homeSettings: "public:home-settings",
} as const;

export type CacheTag = (typeof CACHE_TAGS)[keyof typeof CACHE_TAGS];

/**
 * Invalidate one or more public cache tags. Safe to call from admin route
 * handlers after a create/update/delete. Best-effort: never throws.
 */
export function revalidatePublic(...tags: CacheTag[]): void {
  for (const tag of tags) {
    try {
      revalidateTag(tag);
    } catch {
      /* revalidateTag is a no-op outside a request scope — ignore. */
    }
  }
}
