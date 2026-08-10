export interface Product {
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
