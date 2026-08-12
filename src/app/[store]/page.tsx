import { notFound, redirect } from "next/navigation";
import { loadStoreData } from "@/lib/storeData";
import { getHomeSettings } from "@/lib/db/homeSettings";
import AdvertisersClient from "./AdvertisersClient";
import StoreSidebar from "@/components/store/StoreSidebar";
import HorizontalCouponCard from "@/components/store/HorizontalCouponCard";

export const dynamic = "force-dynamic";

// 2-letter country code check
const COUNTRY_CODE_RE = /^[A-Za-z]{2}$/;

export default async function StoreMainPage({
  params,
  searchParams,
}: {
  params: { store: string };
  searchParams: { [key: string]: string | string[] | undefined };
}) {
  const rawSlug = params.store;

  // Handle country route backward compatibility (e.g. /us, /pk)
  if (COUNTRY_CODE_RE.test(rawSlug)) {
    const search = typeof searchParams.search === "string" ? searchParams.search : "";
    const homeSettings = await getHomeSettings();
    return <AdvertisersClient country={rawSlug.toUpperCase()} initialSearch={search} homeSettings={homeSettings} />;
  }

  // Canonicalize store slug to lowercase (e.g. /Amazon -> /amazon)
  if (rawSlug !== rawSlug.toLowerCase()) {
    redirect(`/${rawSlug.toLowerCase()}`);
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
