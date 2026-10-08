"use client";
import type { Product } from "@/lib/products";
import ProductCard from "@/components/product/ProductCard";
export default function CompareProductCard({ product }: { product: Product }) {
  return <ProductCard product={product} />;
}
