export interface StoreMeta {
  id: number;
  advertiserId: number;
  slug: string | null;
  rating: number;
  categories: string[];
  bannerUrl: string | null;
  description: string | null;
  avgSavings: string | null;
}

export interface PagedStoreMeta {
  storeMetas: StoreMeta[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}
