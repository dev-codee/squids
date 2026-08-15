import { notFound } from "next/navigation";
import Link from "next/link";
import { getCategoryBySlug } from "@/lib/db/categories";
import { getAdvertisersFromDb } from "@/lib/db/advertisers";
import { getDealsFromDb } from "@/lib/db/deals";
import { countryName, countryFlag } from "@/lib/countries";
import AdvertiserCard from "@/components/AdvertiserCard";
import CouponCard from "@/components/store/CouponCard";

export const dynamic = "force-dynamic";

export default async function CategoryDetailPage({
  params,
}: {
  params: { country: string; slug: string };
}) {
  const country = params.country.toUpperCase();
  const slug = params.slug;

  const category = await getCategoryBySlug(slug);
  if (!category) {
    notFound();
  }

  // Fetch advertisers matching category & country
  const advertisersResult = await getAdvertisersFromDb({
    country,
    category: category.name,
    pageSize: 48,
  });

  // Fetch deals matching category & country
  const dealsResult = await getDealsFromDb({
    country,
    search: category.name,
    pageSize: 24,
  });

  const advertisers = advertisersResult?.advertisers || [];
  const deals = dealsResult?.deals || [];

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
      {/* Category Header Hero */}
      <div className="mb-10 rounded-3xl border border-gray-200 bg-gradient-to-br from-white to-accent-soft/30 p-8 shadow-sm">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-4">
            <div>
              <div className="flex items-center gap-2">
                <span className="inline-flex items-center gap-1 rounded-full bg-accent-soft px-2.5 py-0.5 text-xs font-semibold text-accent">
                  {countryFlag(country)} {countryName(country)}
                </span>
                <span className="text-xs text-gray-400 font-mono">/{category.slug}</span>
              </div>
              <h1 className="mt-1 text-2xl sm:text-3xl font-extrabold text-gray-900">
                {category.name} Promo Codes & Deals
              </h1>
            </div>
          </div>

          <Link
            href={`/${country.toLowerCase()}/categories`}
            className="inline-flex items-center gap-1 text-xs font-semibold text-accent hover:text-accent-hover self-start sm:self-auto"
          >
            ← All Categories
          </Link>
        </div>
        {category.description && (
          <p className="mt-4 text-sm text-gray-600 max-w-3xl leading-relaxed">
            {category.description}
          </p>
        )}
      </div>

      {/* Matching Stores Section */}
      <section className="mb-12">
        <div className="mb-6 flex items-center justify-between">
          <h2 className="text-xl font-bold text-gray-900">
            {category.name} Stores in {countryName(country)}
          </h2>
          <span className="text-xs font-medium text-gray-500">
            {advertisers.length} Stores Available
          </span>
        </div>

        {advertisers.length === 0 ? (
          <div className="rounded-xl border border-dashed border-gray-300 bg-white p-8 text-center text-sm text-gray-500">
            No stores specifically listed under &quot;{category.name}&quot; for {countryName(country)} yet.
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {advertisers.map((advertiser) => (
              <AdvertiserCard
                key={advertiser.id}
                advertiser={advertiser}
                country={country}
              />
            ))}
          </div>
        )}
      </section>

      {/* Active Deals Section */}
      {deals.length > 0 && (
        <section>
          <div className="mb-6 flex items-center justify-between">
            <h2 className="text-xl font-bold text-gray-900">
              Latest {category.name} Deals & Offers
            </h2>
            <span className="text-xs font-medium text-gray-500">
              {deals.length} Active Promotions
            </span>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {deals.map((deal) => {
              const couponItem = {
                id: String(deal.id),
                title: deal.title,
                code: deal.code,
                discount: deal.discountText || "",
                type: deal.subtype || "code",
                description: deal.description || "",
                verified: deal.status === "active",
                expiryDate: deal.endDate,
                isExclusive: deal.isExclusive,
                cashbackRate: deal.cashbackRate || undefined,
                studentVerificationReq: deal.studentVerificationReq || undefined,
                affiliateUrl: deal.trackingUrl || undefined,
              };

              return (
                <CouponCard
                  key={deal.id}
                  coupon={couponItem}
                  storeName={deal.advertiser?.name || category.name}
                />
              );
            })}
          </div>

        </section>
      )}
    </div>
  );
}
