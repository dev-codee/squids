"use client";
import Link from "next/link";
import type { ProductFeedItem } from "@/lib/storeData";
import { useCurrency } from "@/i18n/CurrencyProvider";
import { useDictionary } from "@/i18n/DictionaryProvider";
import ProductCard from "@/components/product/ProductCard";
export default function StoreProductOffers({ products, storeName }: { products: ProductFeedItem[]; storeName: string }) {
  const dict=useDictionary();const {region}=useCurrency();
  if(!products.length)return null;
  return <section><div className="mb-5 flex flex-wrap items-end justify-between gap-3"><div><h2 className="text-xl font-bold tracking-tight text-ink">{dict.storeV2.productOffersTitle}</h2><p className="mt-1 text-sm text-ink-soft">{dict.storeV2.productOffersSubtitle}</p></div><Link href={`/${region.country.toLowerCase()}/products`} className="text-xs font-semibold text-brand hover:underline">{dict.productShop.browseAll} →</Link></div><div className="space-y-3">{products.map(p=><ProductCard key={p.id} retailer={storeName} layout="list" product={{id:Number(p.id),title:p.title,imageUrl:p.image,salePrice:p.salePrice,currency:p.currency,category:p.category,inStock:p.inStock,trackingUrl:p.affiliateUrl}} />)}</div></section>;
}
