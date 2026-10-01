import Link from "next/link";
import type { Metadata } from "next";
import { getCategoriesForCountry } from "@/lib/db/categories";
import { countryName, countryFlag } from "@/lib/countries";
import Breadcrumbs from "@/components/store/Breadcrumbs";
import CategorySearch from "@/components/category/CategorySearch";
import { getDictionary } from "@/i18n";
import { getSiteUrl, REGION_CODES, getRegionConfig } from "@/lib/regions";

export const dynamic = "force-dynamic";

const COUNTRY_CODE_RE = /^[A-Za-z]{2}$/;

export async function generateMetadata({
  params,
}: {
  params: { country: string };
}): Promise<Metadata> {
  if (!COUNTRY_CODE_RE.test(params.country)) return {};
  const country = params.country.toUpperCase();
  const siteUrl = getSiteUrl();
  const name = countryName(country);
  const dict = await getDictionary(country);

  const hreflang: Record<string, string> = {};
  for (const code of REGION_CODES) {
    const r = getRegionConfig(code);
    hreflang[r.locale] = `${siteUrl}/${code.toLowerCase()}/categories`;
  }
  hreflang["x-default"] = `${siteUrl}/us/categories`;

  return {
    title: dict.meta.categoriesTitle.replace("{country}", name),
    description: dict.meta.categoriesDescription.replace("{country}", name),
    alternates: {
      canonical: `${siteUrl}/${params.country.toLowerCase()}/categories`,
      languages: hreflang,
    },
  };
}

export default async function PublicCategoriesPage({
  params,
  searchParams,
}: {
  params: { country: string };
  searchParams: Record<string, string | string[] | undefined>;
}) {
  const country = params.country.toUpperCase();
  const lc = params.country.toLowerCase();
  const search =
    typeof searchParams.q === "string" ? searchParams.q.trim() : "";

  const [allCategories, dict] = await Promise.all([
    getCategoriesForCountry(country, search ? { search } : undefined),
    getDictionary(country),
  ]);
  const t = dict.categoryV2;

  // Only publish categories that actually have something behind them — empty
  // navigation stubs are worse than no entry at all.
  const categories = allCategories.filter((cat) => (cat.storeCount ?? 0) > 0);

  return (
    <div className="min-h-screen bg-canvas pb-16">
      <div className="mx-auto max-w-shell px-4 py-6 sm:px-6 lg:px-8">
        <Breadcrumbs
          items={[
            { label: dict.header.home, href: `/${lc}` },
            { label: dict.categories.allCategories },
          ]}
        />

        <header className="mt-2">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-line bg-white px-3 py-1 text-xs font-medium text-ink-soft">
            {countryFlag(country)} {countryName(country)}
          </span>
          <h1 className="mt-3 text-3xl font-extrabold tracking-tight text-ink sm:text-4xl">
            {t.directoryTitle}
          </h1>
          <p className="mt-2 max-w-2xl text-base text-ink-soft">
            {t.directorySubtitle.replace("{country}", countryName(country))}
          </p>
          <CategorySearch />
        </header>

        {categories.length === 0 ? (
          <div className="mt-8 rounded-card border border-dashed border-line-strong bg-white p-12 text-center">
            <p className="text-sm font-medium text-ink">{t.noCategories}</p>
            {search && (
              <Link
                href={`/${lc}/categories`}
                className="mt-3 inline-block text-sm font-semibold text-brand hover:underline"
              >
                {t.clearFilters}
              </Link>
            )}
          </div>
        ) : (
          <div className="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
            {categories.map((cat) => (
              <Link
                key={cat.slug}
                href={`/${lc}/category/${cat.slug}`}
                className="group flex flex-col rounded-card border border-line bg-white p-5 transition hover:border-brand-border hover:shadow-card"
              >
                <span
                  aria-hidden
                  className="flex h-11 w-11 items-center justify-center rounded-full bg-canvas-sunk text-xl transition-colors group-hover:bg-brand-soft"
                >
                  {cat.icon || "🏷️"}
                </span>
                <h2 className="mt-3 text-base font-bold text-ink group-hover:text-brand">
                  {(dict.categoryNames as Record<string, string>)[cat.name] ?? cat.name}
                </h2>
                {cat.description && (
                  <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-ink-soft">
                    {cat.description}
                  </p>
                )}
                <span className="mt-auto pt-4 text-xs font-medium text-ink-muted">
                  {cat.storeCount} {t.storesLabel}
                </span>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
