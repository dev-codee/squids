"use client";
import Link from "next/link";
import { useParams } from "next/navigation";
import type { Product } from "@/lib/products";
import { useCurrency } from "@/i18n/CurrencyProvider";
import { useDictionary } from "@/i18n/DictionaryProvider";
import ProductImage from "./ProductImage";
import ProductSaveButton from "./ProductSaveButton";
import ProductIcon from "./ProductIcon";
export type ProductCardData = Pick<Product, "id" | "title" | "imageUrl" | "salePrice"> & Partial<Product>;
export default function ProductCard({ product, layout = "grid", retailer }: { product: ProductCardData; layout?: "grid" | "list"; retailer?: string }) {
  const dict = useDictionary(); const t = dict.productShop;
  const { format } = useCurrency(); const params = useParams();
  const lc = String(params?.country || "us").toLowerCase();
  const href = `/${lc}/product/${product.id}`; const list = layout === "list";
  const details = [product.size, product.colour, product.packCount && product.packCount > 1 ? `${product.packCount} ${t.packUnits}` : null, product.condition && product.condition !== "unknown" ? product.condition : null].filter(Boolean);
  const hasPrice = typeof product.salePrice === "number" && Number.isFinite(product.salePrice) && product.salePrice >= 0;
  return <article className={`group relative overflow-hidden rounded-xl border border-slate-200 bg-white transition duration-200 hover:border-slate-300 ${list ? "grid grid-cols-[88px_minmax(0,1fr)] gap-4 p-4 sm:grid-cols-[128px_minmax(0,1fr)_180px] sm:gap-6 sm:p-5" : "flex h-full flex-col"}`}>
    <div className={`${list ? "relative" : "relative p-5 pb-3"}`}>
      <Link href={href} tabIndex={-1} aria-hidden="true" className={`flex items-center justify-center rounded-lg bg-white ${list ? "h-28 sm:h-36" : "h-48"}`}><ProductImage src={product.imageUrl} title={product.title} className="h-full w-full p-5 transition-transform duration-300 group-hover:scale-[1.03]" /></Link>
      <div className={`absolute ${list ? "right-0 top-0" : "right-7 top-7"}`}><ProductSaveButton product={{ ...product, category: product.category ?? null }} /></div>
    </div>
    <div className={`min-w-0 ${list ? "flex flex-col justify-center py-2" : "flex-1 px-5"}`}>
      <p className="mb-1.5 truncate text-[11px] font-semibold uppercase tracking-[0.12em] text-ink-muted">{product.brand || product.category || t.products}</p>
      <h3 className={`font-semibold leading-snug text-ink ${list ? "text-base sm:text-lg" : "line-clamp-2 text-[15px]"}`}><Link href={href} className="transition hover:text-brand">{product.title}</Link></h3>
      {details.length > 0 && <p className="mt-2 line-clamp-2 text-xs leading-relaxed text-ink-muted">{details.join(" · ")}</p>}
      {retailer && <p className="mt-2 flex items-center gap-1.5 text-xs text-ink-soft"><ProductIcon name="store" className="h-3.5 w-3.5" />{retailer}</p>}
      <p className={`mt-3 flex items-center gap-1.5 text-xs ${product.inStock ? "text-emerald-700" : "text-ink-muted"}`}><span className={`h-1.5 w-1.5 rounded-full ${product.inStock ? "bg-emerald-500" : "bg-slate-300"}`} />{product.inStock ? dict.productV2.inStock : t.checkAvailability}</p>
    </div>
    <div className={`${list ? "col-span-2 flex flex-col justify-center border-t border-slate-100 pt-3 sm:col-span-1 sm:border-l sm:border-t-0 sm:pl-6 sm:pt-0" : "m-5 mt-4 border-t border-slate-100 pt-4"}`}>
      <div className={`${list ? "flex flex-wrap items-center justify-between gap-3 sm:block" : ""}`}><div><p className="text-[11px] text-ink-muted">{t.itemPrice}</p><p className="mt-0.5 text-[25px] font-bold tracking-tight text-ink">{hasPrice ? format(product.salePrice!, product.currency || "USD") : t.checkPrice}</p><p className="mt-0.5 text-[11px] text-ink-muted">{t.shippingNote}</p></div>
      <Link href={href} className={`inline-flex items-center justify-center gap-2 rounded-lg bg-brand px-4 py-2.5 text-xs font-semibold text-white transition hover:bg-brand-hover ${list ? "shrink-0 sm:mt-4 sm:w-full" : "mt-4 w-full"}`}>{t.compareOffers}<ProductIcon name="arrow" className="h-4 w-4" /></Link></div>
    </div>
  </article>;
}
