import { notFound } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";
import {
  getProductById,
  getMatchingProducts,
  getRelatedProducts,
} from "@/lib/db/products";
import { getAdvertiserByIdFromDb } from "@/lib/db/advertisers";
import { getCategories } from "@/lib/db/categories";
import Breadcrumbs from "@/components/store/Breadcrumbs";
import OfferTable, { type RetailerOffer } from "@/components/product/OfferTable";
import PriceHistoryPanel from "@/components/product/PriceHistoryPanel";
import PriceAlertCard from "@/components/product/PriceAlertCard";
import CompareProductCard from "@/components/category/CompareProductCard";
import { getDictionary } from "@/i18n";
import { getSiteUrl, REGION_CODES, getRegionConfig } from "@/lib/regions";

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
  if (!product) return {};

  const siteUrl = getSiteUrl();
  const path = `/${params.country.toLowerCase()}/product/${id}`;

  const hreflang: Record<string, string> = {};
  for (const code of REGION_CODES) {
    const r = getRegionConfig(code);
    hreflang[r.locale] = `${siteUrl}/${code.toLowerCase()}/product/${id}`;
  }
  hreflang["x-default"] = `${siteUrl}/us/product/${id}`;

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
}: {
  params: { country: string; id: string };
}) {
  const id = parseId(params.id);
  if (id === null) notFound();

  const lc = params.country.toLowerCase();
  const country = params.country.toUpperCase();

  const [product, dict] = await Promise.all([
    getProductById(id).catch(() => null),
    getDictionary(country),
  ]);
  if (!product) notFound();

  const t = dict.productV2;

  const [matches, related, categories] = await Promise.all([
    getMatchingProducts(product).catch(() => [product]),
    getRelatedProducts(product, 4).catch(() => []),
    getCategories().catch(() => []),
  ]);

  // Resolve each matching record's advertiser so the table names a real
  // retailer rather than an opaque id.
  const offers: RetailerOffer[] = await Promise.all(
    matches.map(async (match) => {
      const advertiser = await getAdvertiserByIdFromDb(match.advertiserId).catch(
        () => null,
      );
      return {
        productId: match.id,
        retailerName: advertiser?.name ?? `#${match.advertiserId}`,
        itemPrice: match.salePrice,
        inStock: match.inStock,
        trackingUrl: match.trackingUrl,
        // Only this page's own record has certain identity. Everything else was
        // grouped on normalised title, with no identifier to confirm it.
        matchBasis: match.id === product.id ? ("source" as const) : ("title" as const),
      };
    }),
  );

  // Link the breadcrumb to a real category page when one exists for this name.
  const categoryEntry = product.category
    ? categories.find(
        (c) => c.name.toLowerCase() === product.category!.trim().toLowerCase(),
      )
    : undefined;

  const siteUrl = getSiteUrl();
  const productUrl = `${siteUrl}/${lc}/product/${id}`;
  const jsonLd = {
    "@context": "https://schema.org",
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
  };

  const specs = [
    { label: t.specSize, value: t.notRecorded },
    { label: t.specPack, value: t.notRecorded },
    { label: t.specCondition, value: t.notRecorded },
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
            <h1 className="text-2xl font-extrabold tracking-tight text-ink sm:text-3xl">
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

        {/* Offer table */}
        <section className="mt-8">
          <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 className="text-lg font-bold text-ink">{t.offersTitle}</h2>
              <p className="mt-0.5 text-sm text-ink-muted">
                {t.offersSummary
                  .replace("{retailers}", String(offers.length))
                  .replace("{totals}", "0")}
              </p>
            </div>
            <span className="text-xs font-medium text-ink-muted">
              {t.sortBy}: {t.sortItemPrice}
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
              <OfferTable offers={offers} />
            </>
          )}
        </section>

        {/* History and alerts */}
        <div className="mt-8 grid gap-6 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
          <PriceHistoryPanel />
          <PriceAlertCard />
        </div>

        {/* Product information */}
        <section className="mt-8 overflow-hidden rounded-card border border-line bg-white">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-5 py-3.5">
            <h2 className="text-base font-bold text-ink">{t.productInformation}</h2>
            <Link
              href={`/${lc}/about`}
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
