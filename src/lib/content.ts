export interface StoreReview {
  id: number;
  advertiserId: number;
  author: string;
  rating: number; // 1-5
  date: string; // ISO date string
  title: string;
  comment: string;
  verifiedBuyer: boolean;
}

export interface FAQ {
  id: number;
  advertiserId: number;
  question: string;
  answer: string;
}

export interface BuyingGuide {
  id: number;
  advertiserId: number;
  title: string;
  readTime: string;
  summary: string;
  category: string;
  author: string;
  date: string; // ISO date string
}

export interface Paged<T> {
  items: T[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}
