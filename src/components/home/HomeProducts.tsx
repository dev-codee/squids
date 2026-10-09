"use client";
import type { Product } from "@/lib/products";
import { useDictionary } from "@/i18n/DictionaryProvider";
import ProductCard from "@/components/product/ProductCard";
import HomeSection from "./HomeSection";
export default function HomeProducts({ products, country }: { products: Product[]; country: string }) {
  const dict = useDictionary();
  if (!products.length) return null;
  return <HomeSection title={dict.homeV2.productsTitle} action={dict.productShop.browseAll} actionHref={`/${country.toLowerCase()}/products`} tone="canvas"><div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">{products.map(product => <ProductCard key={product.id} product={product} />)}</div></HomeSection>;
}
