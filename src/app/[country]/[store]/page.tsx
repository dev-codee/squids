import { notFound, redirect } from "next/navigation";
import { loadStoreData } from "@/lib/storeData";
import StoreSidebar from "@/components/store/StoreSidebar";
import HorizontalCouponCard from "@/components/store/HorizontalCouponCard";
import LightningDealCard from "@/components/store/LightningDealCard";

export const dynamic = "force-dynamic";

export default async function StoreMainPage({
  params,
}: {
  params: { country: string; store: string };
}) {
  const rawSlug = params.store;

  // Canonicalize store slug to lowercase (e.g. /Amazon -> /amazon)
  if (rawSlug !== rawSlug.toLowerCase()) {
    redirect(`/${params.country}/${rawSlug.toLowerCase()}`);
  }

  const store = await loadStoreData(rawSlug);
  if (!store) notFound();

  const currentMonth = new Date().toLocaleString('default', { month: 'long' });
  const currentYear = new Date().getFullYear();

  return (
    <div className="min-h-screen bg-[#F5F5F5] pb-16">
      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          
          {/* Sidebar - Left Column */}
          <div className="lg:col-span-3">
            <StoreSidebar store={store} />
          </div>

          {/* Main Content - Right Column */}
          <div className="lg:col-span-9 space-y-8">
            
            {/* Top Header */}
            <div className="bg-white p-6 rounded border border-gray-200">
              <h1 className="text-2xl font-bold text-gray-900">
                {store.name} promo code - {currentMonth} {currentYear} - Foxzil
              </h1>
            </div>

            {/* Coupons Section */}
            {store.coupons.length > 0 && (
              <section>
                <h2 className="text-lg font-medium text-gray-700 mb-4">
                  Verified {store.name} promo codes and offers by Foxzil Team
                </h2>

                <div className="flex flex-col gap-4">
                  {/* Coupon List */}
                  {store.coupons.map((coupon) => (
                    <HorizontalCouponCard key={coupon.id} coupon={coupon} storeName={store.name} />
                  ))}
                </div>
              </section>
            )}

            {/* Deals Section */}
            {store.deals && store.deals.length > 0 && (
              <section className="mt-8">
                <h2 className="text-lg font-medium text-gray-700 mb-4">
                  Top Deals & Promotions for {store.name}
                </h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                  {store.deals.map((deal) => (
                    <LightningDealCard key={deal.id} deal={deal} />
                  ))}
                </div>
              </section>
            )}

            {/* Empty state — advertiser exists but has no published offers yet */}
            {store.coupons.length === 0 && (
              <div className="rounded border border-dashed border-gray-300 bg-white p-12 text-center">
                <p className="text-sm font-semibold text-gray-700">
                  No offers published for {store.name} yet
                </p>
                <p className="mt-1 text-sm text-gray-500">
                  Coupons and deals will appear here once they&apos;re added.
                </p>
              </div>
            )}
            
          </div>
        </div>
      </main>
    </div>
  );
}
