import type { ProductIdentity } from "@/lib/model/productIdentity";

/**
 * A product record.
 *
 * The identity fields (GTIN, brand, MPN, size, pack, condition, …) come from
 * {@link ProductIdentity} and are all optional: records created before the data
 * contract existed cannot have them, and a backfill must not invent them.
 * Absent identity means the product is not eligible for an identifier-based
 * exact-match claim — see `isPublishableExactMatch`.
 *
 * `originalPrice`, `discountPercentage`, `rating` and `reviewsCount` are
 * operator-entered and carry no source or observation date, so they are not
 * rendered publicly as savings or ratings until they do.
 */
export interface Product extends ProductIdentity {
  id: number;
  advertiserId: number;
  title: string;
  category: string | null;
  imageUrl: string | null;
  originalPrice: number | null;
  salePrice: number | null;
  discountPercentage: number | null;
  rating: number | null;
  reviewsCount: number | null;
  inStock: boolean;
  trackingUrl: string | null;
}

export interface PagedProducts {
  products: Product[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}
