import { notFound } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";
import { getCategoryBySlug, getSubcategories } from "@/lib/db/categories";
import { getAdvertisersFromDb } from "@/lib/db/advertisers";
import { getDealsFromDb } from "@/lib/db/deals";
import { getProductsFromDb, getProductFacets, type ProductSort } from "@/lib/db/products";
import type { Product } from "@/lib/products";
import { countryName } from "@/lib/countries";
import AdvertiserCard from "@/components/AdvertiserCard";
import CouponCard from "@/components/store/HorizontalCouponCard";
import Breadcrumbs from "@/components/store/Breadcrumbs";
import CompareProductCard from "@/components/category/CompareProductCard";
import CategoryFilters from "@/components/category/CategoryFilters";
import CategorySort from "@/components/category/CategorySort";
import CrawlablePagination from "@/components/category/CrawlablePagination";
import { getDictionary } from "@/i18n";
import { getSiteUrl, REGION_CODES, getRegionConfig } from "@/lib/regions";

export const dynamic = "force-dynamic";

const COUNTRY_CODE_RE = /^[A-Za-z]{2}$/;
const PRODUCT_PAGE_SIZE = 12;
const DEAL_PAGE_SIZE = 12;

type Tab = "products" | "deals";

/** Read the listing controls out of the URL. */
function readParams(searchParams: Record<string, string | string[] | undefined>) {
  const str = (key: string) =>
    typeof searchParams[key] === "string" ? (searchParams[key] as string) : undefined;

  const num = (key: string) => {
    const raw = str(key);
    if (raw === undefined || raw === "") return undefined;
    const parsed = Number(raw);
    return Number.isFinite(parsed) && parsed >= 0 ? parsed : undefined;
  };

  const rawSort = str("sort");
  const sort: ProductSort =
    rawSort === "price-asc" || rawSort === "price-desc" ? rawSort : "relevance";

  const pageRaw = Number(str("page") ?? "1");
  const page = Number.isFinite(pageRaw) && pageRaw >= 1 ? Math.floor(pageRaw) : 1;

  return {
    tab: (str("tab") === "deals" ? "deals" : "products") as Tab,
    page,
    sort,
    inStockOnly: str("stock") === "1",
    minPrice: num("min"),
    maxPrice: num("max"),
    brand: str("brand"),
    size: str("size"),
    condition: str("condition"),
    discountType: str("dtype") as "code" | "deal" | "student" | "cashback" | "free-delivery" | undefined,
    customerType: str("cust") as "new" | "existing" | "any" | undefined,
    evidenceStatus: str("evidence") as "checkout-tested" | "merchant-listed" | "community-reported" | undefined,
    store: str("store"),
  };
}

export async function generateMetadata({
  params,
  searchParams,
}: {
  params: { country: string; slug: string };
  searchParams: Record<string, string | string[] | undefined>;
}): Promise<Metadata> {
  if (!COUNTRY_CODE_RE.test(params.country)) return {};
  const country = params.country.toUpperCase();
  const slug = params.slug;
  const siteUrl = getSiteUrl();
  const name = countryName(country);

  const [category, dict] = await Promise.all([
    getCategoryBySlug(slug),
    getDictionary(country),
  ]);
  if (!category) return {};

  const translatedCategoryName =
    (dict.categoryNames as Record<string, string>)[category.name] ?? category.name;

  const [advertisersResult, dealsResult] = await Promise.all([
    getAdvertisersFromDb({ country, category: category.name, pageSize: 1, requireDeals: true }),
    getDealsFromDb({ country, category: category.name, pageSize: 1 }),
  ]);
  const isEmpty =
    (advertisersResult?.advertisers?.length ?? 0) === 0 &&
    (dealsResult?.deals?.length ?? 0) === 0;

  const basePath = `/${params.country.toLowerCase()}/category/${slug}`;
  const hreflang = { [getRegionConfig(country).locale]: `${siteUrl}${basePath}` };

  // The unfiltered category is the canonical page. Sort/filter/page combinations
  // are navigable but must not spawn duplicate crawl paths of their own.
  const {
    tab,
    page,
    sort,
    inStockOnly,
    minPrice,
    maxPrice,
    brand,
    size,
    condition,
    discountType,
    customerType,
    evidenceStatus,
    store,
  } = readParams(searchParams);
  const isRefined =
    sort !== "relevance" ||
    inStockOnly ||
    minPrice !== undefined ||
    maxPrice !== undefined ||
    Boolean(brand || size || condition || discountType || customerType || evidenceStatus || store);

  return {
    title: dict.meta.categoryTitle
      .replace("{category}", translatedCategoryName)
      .replace("{country}", name),
    description: dict.meta.categoryDescription
      .replace("{category}", translatedCategoryName)
      .replace("{country}", name),
    alternates: {
      canonical: `${siteUrl}${basePath}`,
      languages: hreflang,
    },
    robots:
      isEmpty || isRefined
        ? { index: false, follow: true }
        : { index: true, follow: true },
    other: page > 1 || tab === "deals" ? { "foxzil-view": `${tab}-${page}` } : {},
  };
}

export default async function CategoryDetailPage({
  params,
  searchParams,
}: {
  params: { country: string; slug: string };
  searchParams: Record<string, string | string[] | undefined>;
}) {
  const country = params.country.toUpperCase();
  const lc = params.country.toLowerCase();
  const slug = params.slug;

  const [category, dict] = await Promise.all([
    getCategoryBySlug(slug),
    getDictionary(country),
  ]);
  if (!category) notFound();

  const t = dict.categoryV2;
  const {
    tab,
    page,
    sort,
    inStockOnly,
    minPrice,
    maxPrice,
    brand,
    size,
    condition,
    discountType,
    customerType,
    evidenceStatus,
    store,
  } = readParams(searchParams);
  const basePath = `/${lc}/category/${slug}`;

  /** Rebuild the current URL with one or more params changed. */
  const buildHref = (changes: Record<string, string | number | null>) => {
    const next = new URLSearchParams();
    const carry: Record<string, string | undefined> = {
      tab: tab === "deals" ? "deals" : undefined,
      sort: sort !== "relevance" ? sort : undefined,
      stock: inStockOnly ? "1" : undefined,
      min: minPrice !== undefined ? String(minPrice) : undefined,
      max: maxPrice !== undefined ? String(maxPrice) : undefined,
      brand: brand || undefined,
      size: size || undefined,
      condition: condition || undefined,
      dtype: discountType || undefined,
      cust: customerType || undefined,
      evidence: evidenceStatus || undefined,
      store: store || undefined,
      page: page > 1 ? String(page) : undefined,
      ...Object.fromEntries(
        Object.entries(changes).map(([k, v]) => [k, v === null ? undefined : String(v)]),
      ),
    };
    for (const [k, v] of Object.entries(carry)) {
      if (v !== undefined && v !== "") next.set(k, v);
    }
    const qs = next.toString();
    return qs ? `${basePath}?${qs}` : basePath;
  };

  const [productsResult, unfilteredProducts, productFacets, subcategories, advertisersResult, dealsResult] = await Promise.all([
    // Products are optional content — an empty or unreachable collection just
    // leaves the compare tab empty rather than failing the page.
    getProductsFromDb({
      category: category.name,
      country,
      page: tab === "products" ? page : 1,
      pageSize: PRODUCT_PAGE_SIZE,
      inStockOnly,
      minPrice,
      maxPrice,
      brand,
      size,
      condition,
      sort,
    }).catch(() => ({
      products: [] as Product[],
      page: 1,
      pageSize: PRODUCT_PAGE_SIZE,
      total: 0,
      totalPages: 1,
    })),
    getProductsFromDb({ category: category.name, country, pageSize: 1 }).catch(() => ({ total: 0 })),
    getProductFacets(category.name, country).catch(() => ({ brands: [], sizes: [], conditions: [] })),
    getSubcategories(slug).catch(() => []),
    getAdvertisersFromDb({ country, category: category.name, pageSize: 12, requireDeals: true }),
    getDealsFromDb({
      country,
      category: category.name,
      page: tab === "deals" ? page : 1,
      pageSize: DEAL_PAGE_SIZE,
      discountType,
      customerType,
      evidenceStatus,
      store,
    }),
  ]);

  const products = productsResult.products;
  const advertisers = advertisersResult?.advertisers || [];
  const deals = dealsResult?.deals || [];
  const dealTotal = dealsResult?.total ?? deals.length;
  const dealTotalPages = Math.max(1, Math.ceil(dealTotal / DEAL_PAGE_SIZE));

  const siteUrl = getSiteUrl();
  const translatedCategoryName =
    (dict.categoryNames as Record<string, string>)[category.name] ?? category.name;

  const breadcrumbJsonLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: dict.header.home, item: `${siteUrl}/${lc}` },
      { "@type": "ListItem", position: 2, name: dict.categories.allCategories, item: `${siteUrl}/${lc}/categories` },
      { "@type": "ListItem", position: 3, name: translatedCategoryName, item: `${siteUrl}${basePath}` },
    ],
  };

  const hasFilters =
    inStockOnly ||
    minPrice !== undefined ||
    maxPrice !== undefined ||
    Boolean(brand || size || condition || discountType || customerType || evidenceStatus || store);
  const countLabel = (n: number, one: string, many: string) =>
    n === 1 ? one : many.replace("{count}", String(n));

  const tabs: { key: Tab; label: string }[] = [
    { key: "products", label: t.tabProducts },
    { key: "deals", label: t.tabDeals },
  ];

  return (
    <div className="min-h-screen bg-canvas pb-16">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }}
      />

      <div className="mx-auto max-w-shell px-4 py-6 sm:px-6 lg:px-8">
        <Breadcrumbs
          items={[
            { label: dict.header.home, href: `/${lc}` },
            { label: dict.categories.allCategories, href: `/${lc}/categories` },
            { label: translatedCategoryName },
          ]}
        />

        {/* Title and buying context */}
        <header className="mt-2">
          <h1 className="text-[28px] font-extrabold tracking-tight text-ink sm:text-4xl lg:text-[44px]">
            {t.pageTitle.replace("{category}", translatedCategoryName)}
          </h1>
          <p className="mt-2 max-w-2xl text-base text-ink-soft">{t.pageSubtitle}</p>
          {category.description && (
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-ink-soft">
              {category.description}
            </p>
          )}

          {/* Subcategories */}
          {subcategories.length > 0 && (
            <div className="mt-4 flex flex-wrap items-center gap-2">
              <span className="text-xs font-semibold uppercase tracking-wider text-ink-muted">
                {t.subcategoriesTitle || "Subcategories"}:
              </span>
              {subcategories.map((sub) => (
                <Link
                  key={sub.slug}
                  href={`/${lc}/category/${sub.slug}`}
                  className="inline-flex items-center gap-1.5 rounded-full border border-line bg-white px-3 py-1 text-xs font-medium text-ink shadow-sm transition hover:border-brand hover:text-brand"
                >
                  {sub.icon && <span>{sub.icon}</span>}
                  <span>{sub.name}</span>
                </Link>
              ))}
            </div>
          )}
        </header>

        {/* Tabs + disclosure */}
        <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div role="tablist" aria-label={translatedCategoryName} className="flex gap-2">
            {tabs.map((item) => {
              const active = tab === item.key;
              return (
                <Link
                  key={item.key}
                  href={buildHref({ tab: item.key === "products" ? null : item.key, page: null })}
                  role="tab"
                  aria-selected={active}
                  className={`rounded-[9px] border px-5 py-2.5 text-sm font-semibold transition-colors ${
                    active
                      ? "border-brand bg-brand text-white"
                      : "border-line bg-white text-ink-soft hover:border-line-strong hover:text-ink"
                  }`}
                >
                  {item.label}
                </Link>
              );
            })}
          </div>
          <p className="text-xs text-ink-muted">{t.disclosure}</p>
        </div>

        {/* Listing */}
        <div className="mt-6 grid gap-6 lg:grid-cols-[240px_minmax(0,1fr)]">
          <CategoryFilters tab={tab} facets={productFacets} />

          <div>
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-bold text-ink">
                  {tab === "products" ? t.compareExact : t.tabDeals}
                </h2>
                <p className="mt-0.5 text-sm text-ink-muted">
                  {tab === "products"
                    ? countLabel(productsResult.total, t.oneResult, t.resultsCount)
                    : countLabel(dealTotal, t.oneDeal, t.dealsCount)}
                </p>
              </div>
              {tab === "products" && products.length > 0 && <CategorySort />}
            </div>

            {tab === "products" ? (
              products.length === 0 ? (
                <div className="rounded-card border border-dashed border-line-strong bg-white p-12 text-center">
                  <p className="text-sm font-medium text-ink">{unfilteredProducts.total === 0 ? t.noProductData : t.noProducts}</p>
                  {unfilteredProducts.total === 0 && <Link href={buildHref({ tab: "deals", page: null })} className="mt-4 inline-block text-sm text-brand underline">{t.tabDeals}</Link>}
                  {hasFilters && unfilteredProducts.total > 0 && (
                    <Link
                      href={buildHref({ stock: null, min: null, max: null, brand: null, size: null, condition: null, page: null })}
                      className="mt-3 inline-block text-sm font-semibold text-brand hover:underline"
                    >
                      {t.clearFilters}
                    </Link>
                  )}
                </div>
              ) : (
                <>
                  <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                    {products.map((product) => (
                      <CompareProductCard key={product.id} product={product} />
                    ))}
                  </div>
                  <CrawlablePagination
                    page={productsResult.page}
                    totalPages={productsResult.totalPages}
                    buildHref={(p) => buildHref({ page: p > 1 ? p : null })}
                    previousLabel={t.previous}
                    nextLabel={t.next}
                  />
                </>
              )
            ) : deals.length === 0 ? (
              <div className="rounded-card border border-dashed border-line-strong bg-white p-12 text-center text-sm text-ink-muted">
                {t.noDeals}
              </div>
            ) : (
              <>
                <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                  {deals.map((deal) => (
                    <CouponCard
                      key={`${deal.network}:${deal.id}`}
                      coupon={{
                        id: `${deal.network}:${deal.id}`,
                        title: deal.title,
                        code: deal.code,
                        discount: deal.discountText || "",
                        type: deal.subtype || "code",
                        description: deal.description || "",
                        verified: false,
                        conditions: deal.promotion?.conditions,
                        sourceUrl: deal.promotion?.evidenceSourceUrl || deal.sourceUrl,
                        terms: deal.terms,
                        delivery: deal.delivery,
                        currency: deal.promotion?.benefit.currency,
                        evidenceStatus: "merchant-listed",
                        expiryDate: deal.endDate,
                        updatedAt: deal.syncedAt
                          ? new Date(deal.syncedAt).toISOString()
                          : null,
                        isExclusive: deal.isExclusive,
                        cashbackRate: deal.cashbackRate || undefined,
                        studentVerificationReq: deal.studentVerificationReq || undefined,
                        affiliateUrl: deal.trackingUrl || undefined,
                      }}
                      storeName={deal.advertiser?.name || category.name}
                      market={params.country}
                      merchantId={
                        deal.advertiser?.id ? String(deal.advertiser.id) : undefined
                      }
                    />
                  ))}
                </div>
                <CrawlablePagination
                  page={page}
                  totalPages={dealTotalPages}
                  buildHref={(p) => buildHref({ page: p > 1 ? p : null })}
                  previousLabel={t.previous}
                  nextLabel={t.next}
                />
              </>
            )}
          </div>
        </div>

        {/* Prefer a store? */}
        {advertisers.length > 0 && (
          <section className="mt-10">
            <div className="mb-4 flex items-end justify-between gap-4">
              <h2 className="text-lg font-bold text-ink">{t.preferStore}</h2>
              <Link
                href={`/${lc}/stores`}
                className="text-sm font-medium text-ink-soft transition-colors hover:text-brand"
              >
                {t.allStores} <span aria-hidden>→</span>
              </Link>
            </div>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
              {advertisers.map((advertiser) => (
                <AdvertiserCard
                  key={`${advertiser.network}:${advertiser.id}`}
                  advertiser={advertiser}
                  country={country}
                />
              ))}
            </div>
          </section>
        )}

        {/* How we compare */}
        <section className="mt-10 flex flex-col gap-3 rounded-card border border-brand-border bg-brand-soft px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-sm font-bold text-ink">{t.howWeCompare}</h2>
            <p className="mt-0.5 text-sm text-ink-soft">{t.howWeCompareBody}</p>
          </div>
          <Link
            href={`/${lc}/methodology`}
            className="flex-shrink-0 text-sm font-semibold text-brand hover:underline"
          >
            {t.viewMethod} <span aria-hidden>→</span>
          </Link>
        </section>
      </div>
    </div>
  );
}
