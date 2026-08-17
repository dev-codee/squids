import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { loadStoreData, loadStoreAiContent } from "@/lib/storeData";
import { Suspense } from "react";
import StoreSidebar from "@/components/store/StoreSidebar";
import HorizontalCouponCard from "@/components/store/HorizontalCouponCard";
import LightningDealCard from "@/components/store/LightningDealCard";
import StoreAiContent from "@/components/store/StoreAiContent";
import StoreAiSkeleton from "@/components/store/StoreAiSkeleton";
import { getDictionary } from "@/i18n";
import { getSiteUrl } from "@/lib/regions";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: { country: string; store: string };
}): Promise<Metadata> {
  const store = await loadStoreData(params.store, params.country);
  if (!store) return {};

  const currentMonth = new Date().toLocaleString("default", { month: "long" });
  const currentYear = new Date().getFullYear();
  const siteUrl = getSiteUrl();
  const canonicalUrl = `${siteUrl}/${params.country.toLowerCase()}/${store.slug}`;

  const title = `${store.name} Promo Codes & Coupons (${currentMonth} ${currentYear})`;
  const description = `Get active ${store.name} promo codes, discount vouchers, and deals for ${currentMonth} ${currentYear}. Verified offers updated daily on Foxzil.`;

  return {
    title,
    description,
    alternates: {
      canonical: canonicalUrl,
    },
    openGraph: {
      title,
      description,
      url: canonicalUrl,
      siteName: "Foxzil",
      images: store.logoUrl ? [{ url: store.logoUrl, alt: `${store.name} logo` }] : [],
      type: "website",
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: store.logoUrl ? [store.logoUrl] : [],
    },
    robots: {
      index: true,
      follow: true,
      googleBot: {
        index: true,
        follow: true,
        "max-snippet": -1,
        "max-image-preview": "large",
      },
    },
  };
}

export default async function StoreMainPage({
  params,
}: {
  params: { country: string; store: string };
}) {
  const rawSlug = params.store;

  const store = await loadStoreData(rawSlug, params.country);
  if (!store) notFound();

  // Canonicalize store slug (e.g. /invideo-ww or /Amazon -> /invideo or /amazon)
  if (rawSlug !== store.slug) {
    redirect(`/${params.country}/${store.slug}`);
  }

  const aiContent = await loadStoreAiContent(store.slug, params.country);

  const currentMonth = new Date().toLocaleString('default', { month: 'long' });
  const currentYear = new Date().getFullYear();
  const dict = await getDictionary(params.country);

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: store.name,
    url: `${getSiteUrl()}/${params.country.toLowerCase()}/${store.slug}`,
    logo: store.logoUrl || undefined,
    description: `Verified promo codes, discount coupons, and offers for ${store.name}.`,
  };

  return (
    <div className="min-h-screen bg-[#F5F5F5] pb-16">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          
          {/* Sidebar - Left Column */}
          <div className="lg:col-span-3 space-y-6">
            <StoreSidebar store={store} aiContent={aiContent} />
          </div>

          {/* Main Content - Right Column */}
          <div className="lg:col-span-9 space-y-8">
            
            {/* Top Header */}
            <div className="bg-white p-6 rounded border border-gray-200">
              <h1 className="text-2xl font-bold text-gray-900">
                {dict.store.promoCodeTitle.replace("{store}", store.name).replace("{month}", currentMonth).replace("{year}", String(currentYear))}
              </h1>
            </div>

            {/* Coupons Section */}
            {store.coupons.length > 0 && (
              <section>
                <h2 className="text-lg font-medium text-gray-700 mb-4">
                  {dict.store.verifiedOffersTitle.replace("{store}", store.name)}
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
                  {dict.store.topDealsTitle.replace("{store}", store.name)}
                </h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                  {store.deals.map((deal) => (
                    <LightningDealCard key={deal.id} deal={deal} />
                  ))}
                </div>
              </section>
            )}

            {/* Empty state — advertiser exists but has no published offers yet */}
            {store.coupons.length === 0 && store.deals.length === 0 && (
              <div className="rounded border border-dashed border-gray-300 bg-white p-12 text-center">
                <p className="text-sm font-semibold text-gray-700">
                  {dict.store.noOffersYet.replace("{store}", store.name)}
                </p>
                <p className="mt-1 text-sm text-gray-500">
                  {dict.store.couponsAppearHere}
                </p>
              </div>
            )}

          </div>
        </div>

        {/* AI-generated store content — full width below the offers.
            Streamed in with a skeleton fallback while Claude generates it
            on first visit. */}
        <div className="mt-8">
          <Suspense fallback={<StoreAiSkeleton />}>
            <StoreAiContent
              slug={store.slug}
              country={params.country}
              storeName={store.name}
            />
          </Suspense>
        </div>
      </main>
    </div>
  );
}
