import Link from "next/link";
import type { Deal } from "@/lib/deals";
import { dealDisplayTitle } from "@/lib/deals";
import { localeForCountry } from "@/lib/ai/languageNames";
import { useDictionary } from "@/i18n/DictionaryProvider";

function storeSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

export default function HomeRecentDeals({
  deals,
  country,
}: {
  deals: Deal[];
  country: string;
}) {
  const dict = useDictionary();
  const locale = localeForCountry(country);
  return (
    <section className="py-12 bg-[#F9F9F9]">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
        <h2 className="text-2xl font-bold text-gray-900">
          {dict.home.recentTitle}
        </h2>
        <p className="mt-2 text-gray-600">{dict.home.recentSubtitle}</p>

        {(!deals || deals.length === 0) ? (
          <div className="mt-10 text-center text-gray-500 py-8 border border-dashed border-gray-300 rounded-lg bg-white">
            {dict.home.noDealsYet}
          </div>
        ) : (
          <div className="mt-10 grid grid-cols-1 gap-4 text-left sm:grid-cols-2 lg:grid-cols-5">
            {deals.slice(0, 10).map((deal) => {
              const slug = storeSlug(deal.advertiser.name);
              const discount = deal.discountText?.trim();
              return (
                <Link
                  key={`${deal.network}-${deal.id}`}
                  href={`/${country.toLowerCase()}/${slug}`}
                  className="group flex h-full flex-col rounded-xl border border-gray-100 bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:border-amber-300 hover:shadow-md"
                >
                  <div className="flex items-center gap-2">
                    <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center overflow-hidden rounded-lg border border-gray-100 bg-gray-50">
                      {deal.advertiser.logoUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={deal.advertiser.logoUrl}
                          alt={`${deal.advertiser.name} logo`}
                          className="h-full w-full object-contain"
                          loading="lazy"
                        />
                      ) : (
                        <span className="text-sm font-semibold text-gray-400">
                          {deal.advertiser.name.charAt(0).toUpperCase()}
                        </span>
                      )}
                    </div>
                    <span className="min-w-0 flex-1 truncate text-xs font-semibold text-gray-700">
                      {deal.advertiser.name}
                    </span>
                    {discount && (
                      <span className="flex-shrink-0 rounded bg-red-50 px-1.5 py-0.5 text-[10px] font-bold text-red-600">
                        {discount}
                      </span>
                    )}
                  </div>
                  <p className="mt-3 line-clamp-3 text-sm font-medium text-gray-900 group-hover:text-amber-600">
                    {dealDisplayTitle(deal, locale)}
                  </p>
                  <span className="mt-auto pt-3 text-[11px] font-medium text-amber-600">
                    {deal.code ? `${dict.common.revealCode} →` : `${dict.common.getThisDeal} →`}
                  </span>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}
