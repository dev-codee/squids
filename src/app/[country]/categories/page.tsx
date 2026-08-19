import Link from "next/link";
import { getCategoriesForCountry } from "@/lib/db/categories";
import { countryName, countryFlag } from "@/lib/countries";
import { getDictionary } from "@/i18n";

export const dynamic = "force-dynamic";

export default async function PublicCategoriesPage({
  params,
}: {
  params: { country: string };
}) {
  const country = params.country.toUpperCase();
  const [categories, dict] = await Promise.all([
    getCategoriesForCountry(country),
    getDictionary(country),
  ]);

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
      {/* Header Banner */}
      <div className="mb-10 text-center sm:text-left">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-accent-soft px-3 py-1 text-xs font-semibold text-accent">
          {countryFlag(country)} {countryName(country)} {dict.categories.catalog}
        </span>
        <h1 className="mt-3 text-3xl font-extrabold tracking-tight text-gray-900 sm:text-4xl">
          {dict.categories.browseTitle}
        </h1>
        <p className="mt-2 text-base text-gray-600 max-w-2xl">
          {dict.categories.browseSubtitle}
        </p>
      </div>

      {/* Categories Grid */}
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {categories.map((cat) => (
          <Link
            key={cat.slug}
            href={`/${country.toLowerCase()}/category/${cat.slug}`}
            className="group flex flex-col justify-between rounded-2xl border border-gray-200 bg-white p-6 shadow-sm transition hover:-translate-y-1 hover:border-accent/40 hover:shadow-md"
          >
            <div>
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold uppercase tracking-wider text-accent bg-accent-soft px-2.5 py-1 rounded-md">
                  {dict.categories.category}
                </span>
                {cat.isFeatured && (
                  <span className="inline-flex items-center rounded-full bg-amber-50 px-2.5 py-0.5 text-[10px] font-bold text-amber-700 ring-1 ring-inset ring-amber-600/20">
                    {dict.categories.featured}
                  </span>
                )}
              </div>

              <h3 className="mt-4 text-lg font-bold text-gray-900 group-hover:text-accent transition">
                {cat.name}
              </h3>
              {cat.description && (
                <p className="mt-1 text-xs text-gray-500 line-clamp-2">
                  {cat.description}
                </p>
              )}
            </div>

            <div className="mt-6 flex items-center justify-between border-t border-gray-100 pt-4 text-xs font-medium text-gray-500">
              <span>{dict.categories.storesCount.replace("{count}", String(cat.storeCount ?? 0))}</span>
              <span className="flex items-center gap-1 text-accent group-hover:text-accent-hover font-semibold">
                {dict.categories.exploreDeals} <span aria-hidden>→</span>
              </span>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
