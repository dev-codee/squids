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
    getRelatedProducts(product, 4).catch(() => []),
    getCategories().catch(() => []),
    getProductVariants(product).catch(() => []),
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
      rows.map(async (row) => {
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

  const lowestPrice = offers.reduce<number | null>((min, o) => {
    const p = o.breakdown.itemPrice.known ? o.breakdown.itemPrice.value : null;
    if (p === null) return min;
    return min === null ? p : Math.min(min, p);
  }, product.salePrice ?? null);

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
      o.matchBasis === "source" ||
      o.matchBasis === "identifier" ||
      o.matchBasis === "manual",
  );

  const priceValues = verifiedOffers
    .map((o) =>
      o.breakdown.total.known
        ? o.breakdown.total.value
        : o.breakdown.itemPrice.known
          ? o.breakdown.itemPrice.value
          : null,
    )
    .filter((v): v is number => typeof v === "number" && v > 0);

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
      priceCurrency: region.currency,
      lowPrice: lowPrice,
      highPrice: highPrice,
      offerCount: verifiedOffers.length,
      offers: verifiedOffers.map((o) => {
        const price = o.breakdown.total.known
          ? o.breakdown.total.value
          : o.breakdown.itemPrice.known
            ? o.breakdown.itemPrice.value
            : undefined;
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
    <div className="min-h-screen bg-canvas pb-16">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <div className="mx-auto max-w-shell px-4 py-6 sm:px-6 lg:px-8">
        <Breadcrumbs
          items={[
            { label: dict.header.home, href: `/${lc}` },
            { label: dict.categories.allCategories, href: `/${lc}/categories` },
            ...(categoryEntry
              ? [
                  {
                    label:
                      (dict.categoryNames as Record<string, string>)[categoryEntry.name] ??
                      categoryEntry.name,
                    href: `/${lc}/category/${categoryEntry.slug}`,
                  },
                ]
              : []),
            { label: product.title },
          ]}
        />

        {searchParams?.alert === "confirmed" && (
          <div className="mt-4 rounded-md border border-emerald-300 bg-emerald-50 p-4 text-emerald-800" role="alert">
            <p className="text-sm font-semibold">Price alert confirmed!</p>
            <p className="mt-0.5 text-xs text-emerald-700">
              We will notify you by email as soon as this product drops to or below your target price.
            </p>
          </div>
        )}

        {/* Identity block */}
        <div className="mt-2 grid gap-6 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
          <div className="flex items-center justify-center rounded-card border border-line bg-white p-8">
            {product.imageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={product.imageUrl}
                alt={product.title}
                className="max-h-[360px] max-w-full object-contain"
              />
            ) : (
              <span className="text-4xl font-bold text-ink-muted">
                {product.title.charAt(0).toUpperCase()}
              </span>
            )}
          </div>

          <div>
            <h1 className="text-[28px] font-extrabold tracking-tight text-ink sm:text-4xl lg:text-[42px] leading-tight">
              {product.title}
            </h1>
            <p className="mt-1.5 text-sm text-ink-soft">
              {[product.category, product.inStock ? t.inStock : t.stockUnknown]
                .filter(Boolean)
                .join(" · ")}
            </p>

            {/* Actions. Saving a product has no backing feature yet, so it is
                not offered here as a live control. */}
            <div className="mt-5 flex flex-wrap gap-2">
              {product.trackingUrl && (
                <a
                  href={product.trackingUrl}
                  target="_blank"
                  rel="nofollow noopener noreferrer sponsored"
                  className="inline-flex items-center justify-center rounded-[9px] bg-brand px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-brand-hover focus:outline-none focus-visible:ring-2 focus-visible:ring-brand/40 focus-visible:ring-offset-2"
                >
                  {t.checkRetailer}
                </a>
              )}
              {categoryEntry && (
                <Link
                  href={`/${lc}/category/${categoryEntry.slug}`}
                  className="inline-flex items-center justify-center rounded-[9px] border border-line-strong bg-white px-5 py-2.5 text-sm font-semibold text-ink transition hover:border-brand-border hover:text-brand"
                >
                  {dict.categoryV2.tabProducts}
                </Link>
              )}
            </div>

            {/* Comparison context */}
            <ul className="mt-5 space-y-2 text-sm text-ink-soft">
              <li className="flex items-center gap-2">
                <span className="text-brand" aria-hidden>✓</span>
                {t.exactVariant}
              </li>
              <li className="flex items-center gap-2">
                <span className="text-brand" aria-hidden>✓</span>
                {t.coverageShown}
              </li>
              <li className="flex items-center gap-2">
                <span className="text-brand" aria-hidden>✓</span>
                {t.confirmedAtCheckout}
              </li>
            </ul>

            <p className="mt-4 rounded-card border border-brand-border bg-brand-soft px-4 py-2.5 text-xs text-ink-soft">
              {t.disclosure}
            </p>
          </div>
        </div>

        {/* Comparison context: quantity and destination.

            A plain GET form, so the controls work without JavaScript and every
            state is a real URL. The totals below are recalculated server-side
            for whatever is submitted. */}
        <form
          method="get"
          className="mt-6 flex flex-wrap items-end gap-3 rounded-card border border-line bg-white px-4 py-3.5"
        >
          <label className="text-xs font-semibold text-ink-soft">
            <span className="block">{t.quantity}</span>
            <input
              type="number"
              name="qty"
              min={1}
              max={99}
              defaultValue={quantity}
              className="mt-1 w-20 rounded-[9px] border border-line-strong px-3 py-1.5 text-sm font-normal text-ink focus:outline-none focus-visible:ring-2 focus-visible:ring-brand/40"
            />
          </label>
          <label className="text-xs font-semibold text-ink-soft">
            <span className="block">{t.postcode}</span>
            <input
              type="text"
              name="postcode"
              inputMode="text"
              maxLength={10}
              defaultValue={postcode ?? ""}
              placeholder={t.postcodePlaceholder}
              className="mt-1 w-40 rounded-[9px] border border-line-strong px-3 py-1.5 text-sm font-normal text-ink focus:outline-none focus-visible:ring-2 focus-visible:ring-brand/40"
            />
          </label>
          <button
            type="submit"
            className="rounded-[9px] bg-brand px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-brand-hover"
          >
            {t.applyContext}
          </button>
          <p className="w-full text-xs text-ink-muted">{t.contextNote}</p>
        </form>

        {/* Variant switcher. Only rendered when variants are actually recorded —
            a switcher built from title guesses would compare different items. */}
        {variants.length > 0 && (
          <section className="mt-4 rounded-card border border-line bg-white px-4 py-3.5">
            <h2 className="text-xs font-semibold uppercase tracking-wide text-ink-muted">
              {t.variantTitle}
            </h2>
            <div className="mt-2 flex flex-wrap gap-2">
              <span className="rounded-[9px] border border-brand bg-brand-soft px-3 py-1.5 text-xs font-semibold text-brand">
                {variantLabel(product)}
              </span>
              {variants.map((variant) => (
                <Link
                  key={variant.id}
                  href={`/${lc}/product/${variant.id}`}
                  className="rounded-[9px] border border-line-strong px-3 py-1.5 text-xs font-semibold text-ink transition hover:border-brand-border hover:text-brand"
                >
                  {variantLabel(variant)}
                </Link>
              ))}
            </div>
            <p className="mt-2 text-xs text-ink-muted">{t.variantNote}</p>
          </section>
        )}

        {/* Offer table */}
        <section className="mt-8">
          <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 className="text-lg font-bold text-ink">{t.offersTitle}</h2>
              <p className="mt-0.5 text-sm text-ink-muted">
                {t.offersSummary
                  .replace("{retailers}", String(offers.length))
                  .replace("{totals}", String(knownTotals))}
              </p>
            </div>
            <span className="text-xs font-medium text-ink-muted">
              {t.sortBy}: {t.colTotal}
            </span>
          </div>

          {offers.length === 0 ? (
            <div className="rounded-card border border-dashed border-line-strong bg-white p-10 text-center text-sm text-ink-muted">
              {t.noOffers}
            </div>
          ) : (
            <>
              {offers.length === 1 && (
                <p className="mb-3 rounded-card border border-line bg-white px-4 py-2.5 text-xs text-ink-soft">
                  {t.oneOfferOnly}
                </p>
              )}
              <OfferTable
                offers={offers}
                canClaimComparison={"canClaimComparison" in matches ? matches.canClaimComparison : false}
              />
            </>
          )}
        </section>

        {/* History and alerts */}
        <div className="mt-8 grid gap-6 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
          <PriceHistoryPanel observations={priceHistory} currency={region.currency} />
          <PriceAlertCard
            productId={product.id}
            productTitle={product.title}
            currentPrice={lowestPrice}
          />
        </div>

        {/* Product information */}
        <section className="mt-8 overflow-hidden rounded-card border border-line bg-white">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-5 py-3.5">
            <h2 className="text-base font-bold text-ink">{t.productInformation}</h2>
            <Link
              href={`/${lc}/report-issue?type=wrong_match&product=${encodeURIComponent(String(product.id))}`}
              className="text-xs font-semibold text-brand hover:underline"
            >
              {t.reportMatch}
            </Link>
          </div>
          <dl className="grid gap-px bg-line sm:grid-cols-4">
            {specs.map((spec) => (
              <div key={spec.label} className="bg-white px-5 py-3.5">
                <dt className="text-xs font-semibold uppercase tracking-wide text-ink-muted">
                  {spec.label}
                </dt>
                <dd className="mt-1 text-sm text-ink">{spec.value}</dd>
              </div>
            ))}
          </dl>
          <p className="border-t border-line bg-canvas px-5 py-3 text-xs text-ink-muted">
            {t.specNote}
          </p>
        </section>

        {/* Related products */}
        {related.length > 0 && (
          <section className="mt-8">
            <h2 className="mb-4 text-lg font-bold text-ink">{t.relatedProducts}</h2>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {related.map((item) => (
                <CompareProductCard key={item.id} product={item} />
              ))}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
