import { notFound, redirect } from "next/navigation";
import { loadStoreData } from "@/lib/storeData";
import StoreHeader from "@/components/store/StoreHeader";
import LightningDealCard from "@/components/store/LightningDealCard";
import type { DealItem } from "@/lib/storeData";
import { getDictionary } from "@/i18n";

export const dynamic = "force-dynamic";

export default async function StoreDealsPage({
  params,
}: {
  params: { country: string; store: string };
}) {
  const rawSlug = params.store;

  const [store, dict] = await Promise.all([
    loadStoreData(rawSlug, params.country),
    getDictionary(params.country),
  ]);
  if (!store) notFound();

  if (rawSlug !== store.slug) {
    redirect(`/${params.country}/${store.slug}/deals`);
  }

  const todaysDeals = store.promotions.filter((d) => d.type === "todays");
  const lightningDeals = store.promotions.filter((d) => d.type === "lightning");
  const limitedOffers = store.promotions.filter((d) => d.type === "limited");
  const trendingDiscounts = store.promotions.filter((d) => d.type === "trending");

  const section = (
    title: string,
    subtitle: string,
    items: DealItem[],
    badge: { text: string; className: string },
    icon: string,
  ) =>
    items.length > 0 && (
      <section>
        <div className="mb-6 flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xl">{icon}</span>
              <h2 className="text-2xl font-extrabold text-gray-900">{title}</h2>
            </div>
            <p className="text-xs text-gray-500 mt-1">{subtitle}</p>
          </div>
          <span className={`rounded-lg px-3 py-1 text-xs font-bold ${badge.className}`}>
            {items.length} {badge.text}
          </span>
        </div>
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {items.map((deal) => (
            <LightningDealCard key={deal.id} deal={deal} />
          ))}
        </div>
      </section>
    );

  const hasAny = store.promotions.length > 0;

  return (
    <div className="min-h-screen bg-gray-50/60 pb-16">
      <StoreHeader store={store} />

      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8 space-y-12">
        {/* Banner */}
        <div className="rounded-2xl bg-gradient-to-r from-red-600 via-amber-600 to-amber-500 p-8 text-white shadow-lg">
          <div className="max-w-3xl">
            <span className="inline-flex items-center rounded-lg bg-white/20 px-3 py-1 text-xs font-bold text-white backdrop-blur-sm mb-3">
              ⚡ {dict.dealsPage.flashHub}
            </span>
            <h1 className="text-3xl font-extrabold sm:text-4xl">
              {dict.dealsPage.heading.replace("{store}", store.name)}
            </h1>
            <p className="mt-2 text-sm text-red-50 leading-relaxed">
              {dict.dealsPage.intro}
            </p>
          </div>
        </div>

        {section(
          dict.dealsPage.todaysDeals,
          dict.dealsPage.todaysDealsSub,
          todaysDeals,
          { text: dict.dealsPage.featured, className: "bg-amber-50 text-amber-700" },
          "🌟",
        )}
        {section(
          dict.dealsPage.lightningDeals,
          dict.dealsPage.lightningDealsSub,
          lightningDeals,
          { text: dict.dealsPage.flashSales, className: "bg-red-50 text-red-700" },
          "⚡",
        )}
        {section(
          dict.dealsPage.limitedOffers,
          dict.dealsPage.limitedOffersSub,
          limitedOffers,
          { text: dict.dealsPage.expiringSoon, className: "bg-orange-50 text-orange-700" },
          "⏳",
        )}
        {section(
          dict.dealsPage.trendingDiscounts,
          dict.dealsPage.trendingDiscountsSub,
          trendingDiscounts,
          { text: dict.dealsPage.trending, className: "bg-purple-50 text-purple-700" },
          "🔥",
        )}

        {!hasAny && (
          <div className="rounded-2xl border border-dashed border-gray-300 bg-white p-12 text-center">
            <p className="text-sm font-semibold text-gray-700">
              {dict.dealsPage.noneTitle.replace("{store}", store.name)}
            </p>
            <p className="mt-1 text-sm text-gray-500">
              {dict.dealsPage.noneSub}
            </p>
          </div>
        )}
      </main>
    </div>
  );
}
