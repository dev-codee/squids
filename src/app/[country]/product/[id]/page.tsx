import { notFound } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";
import {
  getProductById,
  getMatchingProducts,
  getRelatedProducts,
  getProductVariants,
  variantLabel,
} from "@/lib/db/products";
import { deliveredTotalsFor } from "@/lib/db/delivered-totals";
import { getAdvertiserByIdFromDb } from "@/lib/db/advertisers";
import { getCategories } from "@/lib/db/categories";
import { getPriceHistory } from "@/lib/db/price-observations";
import ProductHero from "@/components/product/ProductHero";
import ProductIcon from "@/components/product/ProductIcon";
import Breadcrumbs from "@/components/store/Breadcrumbs";
import OfferTable, { type RetailerOffer } from "@/components/product/OfferTable";
import PriceHistoryPanel from "@/components/product/PriceHistoryPanel";
import PriceAlertCard from "@/components/product/PriceAlertCard";
import CompareProductCard from "@/components/category/CompareProductCard";
import { getDictionary } from "@/i18n";
import { getSiteUrl, REGION_CODES, getRegionConfig } from "@/lib/regions";

/** Comparison context the shopper can set. Both are optional and crawl-safe. */
function parseQuantity(raw: string | undefined): number {
  const n = Number(raw);
  return Number.isInteger(n) && n > 0 && n <= 99 ? n : 1;
}

function parsePostcode(raw: string | undefined): string | null {
  const value = (raw ?? "").trim();
  return /^[A-Za-z0-9 -]{2,10}$/.test(value) ? value : null;
}

export const dynamic = "force-dynamic";

const COUNTRY_CODE_RE = /^[A-Za-z]{2}$/;

function parseId(raw: string): number | null {
  const id = Number(raw);
  return Number.isInteger(id) && id > 0 ? id : null;
}

export async function generateMetadata({
  params,
}: {
  params: { country: string; id: string };
}): Promise<Metadata> {
  if (!COUNTRY_CODE_RE.test(params.country)) return {};
  const id = parseId(params.id);
  if (id === null) return {};

  const product = await getProductById(id).catch(() => null);
  if (!product?.regionCodes?.includes(params.country.toUpperCase())) return {};

  const siteUrl = getSiteUrl();
  const path = `/${params.country.toLowerCase()}/product/${id}`;

  const hreflang: Record<string, string> = {};
  for (const code of REGION_CODES.filter((code) => product.regionCodes?.includes(code))) {
    const r = getRegionConfig(code);
    hreflang[r.locale] = `${siteUrl}/${code.toLowerCase()}/product/${id}`;
  }


  return {
    title: product.title,
    description: product.category
      ? `${product.title} — ${product.category}. Compare retailer offers.`
      : `${product.title}. Compare retailer offers.`,
    alternates: { canonical: `${siteUrl}${path}`, languages: hreflang },
    openGraph: {
      title: product.title,
      url: `${siteUrl}${path}`,
      images: product.imageUrl ? [{ url: product.imageUrl, alt: product.title }] : [],
    },
  };
}

export default async function ProductComparisonPage({
  params,
  searchParams,
}: {
  params: { country: string; id: string };
  searchParams?: { qty?: string; postcode?: string; alert?: string };
}) {
  const id = parseId(params.id);
  if (id === null) notFound();

  const lc = params.country.toLowerCase();
  const country = params.country.toUpperCase();

  const [product, dict] = await Promise.all([
    getProductById(id).catch(() => null),
    getDictionary(country),
  ]);
  if (!product?.regionCodes?.includes(country)) notFound();

  const t = dict.productV2;

  const quantity = parseQuantity(searchParams?.qty);
  const postcode = parsePostcode(searchParams?.postcode);

  const [matches, related, categories, variants, priceHistory] = await Promise.all([
    getMatchingProducts(product).catch(() => ({
      rows: [{ product, result: null }],
      canClaimComparison: false,
      reviewCount: 0,
    })),
    getRelatedProducts(product, 4, country).catch(() => []),
    getCategories().catch(() => []),
    getProductVariants(product, 12, country).catch(() => []),
    getPriceHistory(product.id, country).catch(() => []),
  ]);

  const rows = "rows" in matches ? matches.rows.filter((row) => row.product.regionCodes?.includes(country)) : [];
  const region = getRegionConfig(country);

  // Real cost components, per retailer, for this quantity and destination.
  const totals = await deliveredTotalsFor({
    products: rows.map((row) => row.product),
    market: country,
    defaultCurrency: region.currency,
    shopper: { postcode, quantity },
  }).catch(() => new Map());

  // Resolve each matching record's advertiser so the table names a real
  // retailer rather than an opaque id.
  const offers: RetailerOffer[] = (
    await Promise.all(
      rows.map(async (row): Promise<RetailerOffer | null> => {
        const entry = totals.get(row.product.id);
        if (!entry) return null;
        const advertiser = await getAdvertiserByIdFromDb(row.product.advertiserId, row.product.network).catch(
          () => null,
        );
        const basis: RetailerOffer["matchBasis"] =
          row.product.id === product.id
            ? "source"
            : row.result?.basis === "identifier"
              ? "identifier"
              : row.result?.basis === "manual"
                ? "manual"
                : "title";
        return {
          productId: row.product.id,
          retailerName: advertiser?.name ?? `#${row.product.advertiserId}`,
          retailerKey: `${row.product.network ?? "awin"}:${row.product.advertiserId}`,
          retailerLogo: advertiser?.logoUrl,
          inStock: row.product.inStock,
          trackingUrl: row.product.trackingUrl,
          matchBasis: basis,
          breakdown: entry.breakdown,
          currency: entry.currency,
        } satisfies RetailerOffer;
      }),
    )
  ).filter((offer): offer is RetailerOffer => offer !== null);

  const knownTotals = offers.filter((offer) => offer.breakdown.total.known).length;

  const displayCurrency = product.currency?.toUpperCase() || "USD";
  const summaryOffers = offers.filter(o => o.currency === displayCurrency && o.matchBasis !== "title" && o.inStock && o.breakdown.itemPrice.known)
    .sort((a,b) => (a.breakdown.itemPrice.known ? a.breakdown.itemPrice.value / a.breakdown.quantity : Infinity) - (b.breakdown.itemPrice.known ? b.breakdown.itemPrice.value / b.breakdown.quantity : Infinity));
  const summaryOffer = summaryOffers[0];
  const lowestPrice = summaryOffer?.breakdown.itemPrice.known ? summaryOffer.breakdown.itemPrice.value / summaryOffer.breakdown.quantity : product.salePrice ?? null;

  // Link the breadcrumb to a real category page when one exists for this name.
  const categoryEntry = product.category
    ? categories.find(
        (c) => c.name.toLowerCase() === product.category!.trim().toLowerCase(),
      )
    : undefined;

  const siteUrl = getSiteUrl();
  const productUrl = `${siteUrl}/${lc}/product/${id}`;

  // §14 & §8: Schema.org Product & AggregateOffer structured data.
  // In accordance with Google Rich Results guidelines and §8 requirements:
  // ONLY verified identifier-matched rows ("source", "identifier", "manual") are included.
  // Fuzzy title-only candidates are strictly excluded from structured data claims.
  const verifiedOffers = offers.filter(
    (o) =>
      o.currency === displayCurrency && (o.matchBasis === "source" ||
      o.matchBasis === "identifier" ||
      o.matchBasis === "manual"),
  );

  const priceValues = verifiedOffers.map(o => o.breakdown.itemPrice.known ? o.breakdown.itemPrice.value / o.breakdown.quantity : null).filter((v): v is number => typeof v === "number" && v > 0);

  const lowPrice = priceValues.length > 0 ? Math.min(...priceValues) : undefined;
  const highPrice = priceValues.length > 0 ? Math.max(...priceValues) : undefined;

  const productJsonLd: Record<string, any> = {
    "@type": "Product",
    "@id": `${productUrl}#product`,
    name: product.title,
    url: productUrl,
    image: product.imageUrl ? [product.imageUrl] : undefined,
    description: `${product.title} — compare verified retailer prices and delivery charges on Foxzil.`,
    sku: String(product.id),
    mpn: product.mpn || undefined,
    gtin13: product.gtin && product.gtin.length === 13 ? product.gtin : undefined,
    gtin: product.gtin || undefined,
    brand: product.brand ? { "@type": "Brand", name: product.brand } : undefined,
  };

  if (lowPrice !== undefined && highPrice !== undefined && verifiedOffers.length > 0) {
    productJsonLd.offers = {
      "@type": "AggregateOffer",
      priceCurrency: displayCurrency,
      lowPrice: lowPrice,
      highPrice: highPrice,
      offerCount: verifiedOffers.length,
      offers: verifiedOffers.map((o) => {
        const price = o.breakdown.itemPrice.known ? o.breakdown.itemPrice.value / o.breakdown.quantity : undefined;
        return {
          "@type": "Offer",
          price: price,
          priceCurrency: o.currency,
          availability: o.inStock
            ? "https://schema.org/InStock"
            : "https://schema.org/OutOfStock",
          seller: {
            "@type": "Organization",
            name: o.retailerName,
          },
          url: o.trackingUrl || undefined,
        };
      }),
    };
  }

  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: dict.header.home, item: `${siteUrl}/${lc}` },
          {
            "@type": "ListItem",
            position: 2,
            name: dict.categories.allCategories,
            item: `${siteUrl}/${lc}/categories`,
          },
          { "@type": "ListItem", position: 3, name: product.title, item: productUrl },
        ],
      },
      productJsonLd,
    ],
  };

  // The identity block, straight from the product record. A field nobody has
  // sourced reads "Not recorded" rather than being quietly omitted — the gap is
  // the point, because it is what keeps this row off an exact-match claim.
  const specs = [
    { label: t.specBrand, value: product.brand ?? t.notRecorded },
    { label: t.specModel, value: product.mpn ?? t.notRecorded },
    { label: t.specGtin, value: product.gtin ?? t.notRecorded },
    { label: t.specSize, value: product.size ?? t.notRecorded },
    { label: t.specColour, value: product.colour ?? product.flavour ?? t.notRecorded },
    {
      label: t.specPack,
      value:
        typeof product.packCount === "number" ? String(product.packCount) : t.notRecorded,
    },
    {
      label: t.specCondition,
      value:
        product.condition && product.condition !== "unknown"
          ? product.condition
          : t.notRecorded,
    },
    { label: t.specRegionalSpec, value: product.regionalSpec ?? t.notRecorded },
    { label: t.specIdentifier, value: `#${product.id}` },
  ];

  return (
    <main className="min-h-screen bg-[#f7f8fa] pb-16">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }} />
      <div className="mx-auto max-w-shell px-4 pt-6 sm:px-6 lg:px-8">
        <Breadcrumbs items={[{label:dict.header.home,href:`/${lc}`},{label:dict.productShop.products,href:`/${lc}/products`},...(categoryEntry?[{label:categoryEntry.name,href:`/${lc}/products?category=${encodeURIComponent(product.category || categoryEntry.name)}`}]:[]),{label:product.title}]} />
        {searchParams?.alert === "confirmed" && <div className="my-4 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800" role="status">Price alert confirmed. We’ll email you when your target price is reached.</div>}
        <ProductHero product={product} price={lowestPrice} currency={displayCurrency} offerCount={offers.length} retailerName={summaryOffer?.retailerName} />
        {variants.length>0&&<div className="mb-7 flex flex-wrap items-center gap-2"><span className="mr-2 text-xs font-semibold text-ink-soft">{t.variantTitle}</span><span className="rounded-lg border border-brand bg-brand-soft px-3 py-2 text-xs font-semibold text-brand">{variantLabel(product)}</span>{variants.map(v=><Link key={v.id} href={`/${lc}/product/${v.id}`} className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-ink hover:border-brand">{variantLabel(v)}</Link>)}</div>}
      </div>
      <nav aria-label={dict.productShop.viewOptions} className="sticky top-[117px] z-20 border-y border-slate-200 bg-white/95 backdrop-blur"><div className="mx-auto flex max-w-shell gap-6 overflow-x-auto px-4 sm:px-6 lg:px-8">{[["retailer-offers",dict.productShop.offers],["price-history",t.priceHistory],["product-details",dict.productShop.details]].map(([id,label],i)=><a key={id} href={`#${id}`} className={`shrink-0 border-b-2 py-4 text-sm font-semibold ${i===0?"border-brand text-brand":"border-transparent text-ink-soft hover:text-brand"}`}>{label}{i===0&&<span className="ml-2 rounded-full bg-brand-soft px-2 py-0.5 text-xs">{offers.length}</span>}</a>)}</div></nav>
      <div className="mx-auto max-w-shell px-4 sm:px-6 lg:px-8">
        <section id="retailer-offers" className="scroll-mt-48 pt-8">
          <div className="mb-5 flex flex-wrap items-end justify-between gap-3"><div><h2 className="text-xl font-bold tracking-tight text-ink sm:text-2xl">{t.offersTitle}</h2><p className="mt-1 text-sm text-ink-muted">{t.offersSummary.replace("{retailers}",String(offers.length)).replace("{totals}",String(knownTotals))}</p></div><a href="#price-alert" className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-xs font-semibold text-ink hover:border-brand hover:text-brand"><ProductIcon name="bell" className="h-4 w-4" />{t.setPriceAlert}</a></div>
          <details className="mb-5 rounded-xl border border-slate-200 bg-white"><summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-5 py-3.5 text-sm text-ink-soft"><span className="flex items-center gap-2"><ProductIcon name="truck" className="h-4 w-4" />{t.compareForOrder}</span><span className="text-xs text-ink-muted">{t.quantity}: {quantity}{postcode?` · ${postcode}`:""} <span className="ml-2 text-brand">⌄</span></span></summary><form method="get" action={`/${lc}/product/${id}#retailer-offers`} className="flex flex-wrap items-end gap-3 border-t border-slate-100 px-5 py-4"><label className="text-xs font-semibold text-ink-soft"><span className="block">{t.quantity}</span><input type="number" name="qty" min={1} max={99} defaultValue={quantity} className="mt-2 w-20 rounded-lg border border-slate-200 px-3 py-2 text-sm" /></label><label className="text-xs font-semibold text-ink-soft"><span className="block">{t.postcode}</span><input name="postcode" maxLength={10} defaultValue={postcode??""} placeholder={t.postcodePlaceholder} className="mt-2 w-44 rounded-lg border border-slate-200 px-3 py-2 text-sm" /></label><button type="submit" className="rounded-lg bg-ink px-4 py-2.5 text-xs font-semibold text-white hover:bg-brand">{t.applyContext}</button><p className="w-full text-xs leading-relaxed text-ink-muted">{t.contextNote}</p></form></details>
          {offers.length===0?<div className="rounded-2xl border border-dashed border-slate-300 bg-white p-12 text-center text-sm text-ink-muted">{t.noOffers}</div>:<OfferTable offers={offers} defaultCurrency={displayCurrency} canClaimComparison={new Set(offers.filter(o=>o.matchBasis!=="title").map(o=>o.retailerKey)).size>=2} />}
        </section>
        <div className="mt-8 grid items-start gap-6 lg:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)]"><PriceHistoryPanel observations={priceHistory} currency={displayCurrency} /><PriceAlertCard productId={product.id} productTitle={product.title} currentPrice={product.salePrice} currency={displayCurrency} /></div>
        <section id="product-details" className="mt-8 scroll-mt-48 overflow-hidden rounded-2xl border border-slate-200 bg-white"><div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-6 py-5"><h2 className="text-xl font-bold tracking-tight text-ink">{dict.productShop.recordedSpecs}</h2><Link href={`/${lc}/report-issue?type=wrong_match&product=${id}`} className="text-xs font-medium text-ink-muted hover:text-brand">{t.reportMatch}</Link></div><dl className="grid sm:grid-cols-2">{specs.map(spec=><div key={spec.label} className="flex justify-between gap-4 border-b border-slate-100 px-6 py-4 text-sm odd:bg-slate-50/40"><dt className="text-ink-muted">{spec.label}</dt><dd className="text-right font-medium text-ink">{spec.value}</dd></div>)}</dl><p className="px-6 py-4 text-xs text-ink-muted">{t.specNote}</p></section>
        {related.length>0&&<section className="mt-10"><div className="mb-5 flex items-center justify-between gap-3"><h2 className="text-xl font-bold tracking-tight text-ink">{t.relatedProducts}</h2><Link href={`/${lc}/products`} className="text-xs font-semibold text-brand">{dict.productShop.browseAll} →</Link></div><div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">{related.map(item=><CompareProductCard key={item.id} product={item} />)}</div></section>}
      </div>
    </main>
  );
}
