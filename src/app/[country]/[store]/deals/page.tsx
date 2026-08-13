import { notFound, redirect } from "next/navigation";
import { loadStoreData } from "@/lib/storeData";
import StoreHeader from "@/components/store/StoreHeader";
import LightningDealCard from "@/components/store/LightningDealCard";
import type { DealItem } from "@/lib/storeData";

export const dynamic = "force-dynamic";

export default async function StoreDealsPage({
  params,
}: {
  params: { country: string; store: string };
}) {
  const rawSlug = params.store;

  if (rawSlug !== rawSlug.toLowerCase()) {
    redirect(`/${params.country}/${rawSlug.toLowerCase()}/deals`);
  }

  const store = await loadStoreData(rawSlug, params.country);
  if (!store) notFound();

  const todaysDeals = store.deals.filter((d) => d.type === "todays");
  const lightningDeals = store.deals.filter((d) => d.type === "lightning");
  const limitedOffers = store.deals.filter((d) => d.type === "limited");
  const trendingDiscounts = store.deals.filter((d) => d.type === "trending");

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

  const hasAny = store.deals.length > 0;

  return (
    <div className="min-h-screen bg-gray-50/60 pb-16">
      <StoreHeader store={store} />

      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8 space-y-12">
        {/* Banner */}
        <div className="rounded-2xl bg-gradient-to-r from-red-600 via-amber-600 to-amber-500 p-8 text-white shadow-lg">
          <div className="max-w-3xl">
            <span className="inline-flex items-center rounded-lg bg-white/20 px-3 py-1 text-xs font-bold text-white backdrop-blur-sm mb-3">
              ⚡ Flash Sales &amp; Deals Hub
            </span>
            <h1 className="text-3xl font-extrabold sm:text-4xl">
              Today&apos;s {store.name} Deals &amp; Flash Promotions
            </h1>
            <p className="mt-2 text-sm text-red-50 leading-relaxed">
              Don&apos;t miss out on high-discount lightning sales, daily price drops, and time-sensitive promotions.
            </p>
          </div>
        </div>

        {section(
          "Today's Deals",
          "Hand-picked featured deals for today.",
          todaysDeals,
          { text: "Featured", className: "bg-amber-50 text-amber-700" },
          "🌟",
        )}
        {section(
          "Lightning Deals",
          "Flash sales with live countdown timers & stock progress indicators.",
          lightningDeals,
          { text: "Flash Sales", className: "bg-red-50 text-red-700" },
          "⚡",
        )}
        {section(
          "Limited-Time Offers",
          "Expiring promotions with deep markdowns.",
          limitedOffers,
          { text: "Expiring Soon", className: "bg-orange-50 text-orange-700" },
          "⏳",
        )}
        {section(
          "Trending Discounts",
          "Most clicked and popular deals ranked by shoppers.",
          trendingDiscounts,
          { text: "Trending", className: "bg-purple-50 text-purple-700" },
          "🔥",
        )}

        {!hasAny && (
          <div className="rounded-2xl border border-dashed border-gray-300 bg-white p-12 text-center">
            <p className="text-sm font-semibold text-gray-700">
              No deals published for {store.name} yet
            </p>
            <p className="mt-1 text-sm text-gray-500">
              New promotions and flash sales will show up here.
            </p>
          </div>
        )}
      </main>
    </div>
  );
}
