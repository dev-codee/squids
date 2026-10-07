import type { Metadata } from "next";
import { notFound, permanentRedirect } from "next/navigation";
import { loadStoreData, loadStoreAiContent } from "@/lib/storeData";
import StoreSidebar from "@/components/store/StoreSidebar";
import StoreHeader from "@/components/store/StoreHeader";
import Breadcrumbs from "@/components/store/Breadcrumbs";
import OfferList from "@/components/store/OfferList";
import LightningDealCard from "@/components/store/LightningDealCard";
import StoreEssentials from "@/components/store/StoreEssentials";
import StoreProductOffers from "@/components/store/StoreProductOffers";
import StoreInfoPanel from "@/components/store/StoreInfoPanel";
import HowItWorks from "@/components/store/HowItWorks";
import FaqAccordion from "@/components/store/FaqAccordion";
import RelatedStores from "@/components/store/RelatedStores";
import { getDictionary } from "@/i18n";
import { getSiteUrl, REGION_CODES, getRegionConfig } from "@/lib/regions";
import { localeForCountry } from "@/lib/ai/languageNames";

import { generateStoreSeoContent, refreshStoreTitleDate } from "@/lib/ai/storeSeo";
import { getLatestVerificationsForStore } from "@/lib/db/coupon-verifications";
import LastVerifiedSection from "@/components/store/LastVerifiedSection";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: { country: string; store: string };
}): Promise<Metadata> {
  const store = await loadStoreData(params.store, params.country);
  if (!store) return {};

  const locale = localeForCountry(params.country);
  const siteUrl = getSiteUrl();
  const canonicalUrl = `${siteUrl}/${params.country.toLowerCase()}/${store.slug}`;

  const localizedSeo = generateStoreSeoContent(
    store.name,
    [...store.coupons, ...store.deals, ...store.promotions] as any,
    locale,
  );

  let title = localizedSeo.seoTitle;
  let description = localizedSeo.seoDescription;




  if (title) {
    title = title
      .replace(/\s*-\s*Foxzil\b/gi, "")
      .replace(/\bFoxzil\b\s*-\s*/gi, "")
      .trim();
  }
  if (description) {
    description = description
      .replace(/\bon Foxzil\b/gi, "")
      .replace(/\bby Foxzil Team\b/gi, "")
      .replace(/\bFoxzil\b/gi, "")
      .replace(/\s{2,}/g, " ")
      .trim();
  }

  const hreflangLanguages = { [getRegionConfig(params.country).locale]: canonicalUrl };

  return {
    title,
    description,
    alternates: {
      canonical: canonicalUrl,
      languages: hreflangLanguages,
    },
    openGraph: {
      title,
      description,
      url: canonicalUrl,
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
      index: store.activeCouponsCount + store.activeDealsCount > 0,
      follow: true,
      googleBot: {
        index: store.activeCouponsCount + store.activeDealsCount > 0,
        follow: true,
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
    permanentRedirect(`/${params.country}/${store.slug}`);
  }

  const [aiContent, verifications] = await Promise.all([
    loadStoreAiContent(store.slug, params.country),
    getLatestVerificationsForStore(store.slug, 6, params.country, store.network),
  ]);

  const locale = localeForCountry(params.country);
  const currentMonth = new Date().toLocaleDateString(locale, { month: "long" });
  const currentYear = new Date().getFullYear();
  const dict = await getDictionary(params.country);

  const localizedSeo = generateStoreSeoContent(
    store.name,
    [...store.coupons, ...store.deals, ...store.promotions] as any,
    locale,
  );
  let pageTitle = localizedSeo.seoTitle;
  let pageDesc = localizedSeo.seoDescription;




  if (pageTitle) {
    pageTitle = pageTitle
      .replace(/\s*-\s*Foxzil\b/gi, "")
      .replace(/\bFoxzil\b\s*-\s*/gi, "")
      .trim();
  }
  if (pageDesc) {
    pageDesc = pageDesc
      .replace(/\bon Foxzil\b/gi, "")
      .replace(/\bby Foxzil Team\b/gi, "")
      .replace(/\bFoxzil\b/gi, "")
      .replace(/\s{2,}/g, " ")
      .trim();
  }

  const siteUrl = getSiteUrl();
  const storePageUrl = `${siteUrl}/${params.country.toLowerCase()}/${store.slug}`;
  const jsonLd = [
    {
      "@context": "https://schema.org",
      "@type": "Organization",
      name: store.name,
      url: store.officialUrl || undefined,
      logo: store.logoUrl || undefined,
      description: pageDesc || undefined,
    },
    {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "Home", item: `${siteUrl}/${params.country.toLowerCase()}` },
        { "@type": "ListItem", position: 2, name: store.name, item: storePageUrl },
      ],
    },
  ];

  const hasOffers =
    store.coupons.length > 0 ||
    store.deals.length > 0 ||
    store.promotions.length > 0;

  return (
    <div className="min-h-screen bg-canvas pb-16">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }}
      />
      <StoreHeader store={store} country={params.country} />

      <main className="mx-auto max-w-shell px-4 py-6 sm:px-6 lg:px-8">
        <Breadcrumbs
          items={[
            { label: "Home", href: `/${params.country}` },
            { label: "Stores", href: `/${params.country}/stores` },
            { label: store.name },
          ]}
        />

        {/* Offers on the left, merchant essentials on the right. */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
          <div className="space-y-6 lg:col-span-8">
            <header>
              <h1 className="text-[20px] font-extrabold leading-tight tracking-tight text-ink">
                {pageTitle ||
                  dict.store.promoCodeTitle
                    .replace("{store}", store.name)
                    .replace("{month}", currentMonth)
                    .replace("{year}", String(currentYear))}
              </h1>
              <p className="mt-1.5 text-sm text-ink-soft">
                {dict.storeV2.currentOffers.replace("{store}", store.name)}
              </p>
              {pageDesc && (
                <p className="mt-2 text-sm leading-relaxed text-ink-soft">{pageDesc}</p>
              )}
            </header>

            {/* Coupons — vouchers with a code */}
            {store.coupons.length > 0 && (
              <section aria-label={dict.storeV2.tabCoupons}>
                <OfferList
                  items={store.coupons}
                  storeName={store.name}
                  market={params.country}
                  merchantId={store.slug}
                  merchantUrl={store.websiteUrl}
                  itemLabel="coupons"
                />
              </section>
            )}

            {/* Deals — coupon-style offers without a code */}
            {store.deals.length > 0 && (
              <section>
                <h2 className="mb-3 text-base font-bold text-ink">
                  {dict.store.dealsTitle.replace("{store}", store.name)}
                </h2>
                <OfferList
                  items={store.deals}
                  storeName={store.name}
                  market={params.country}
                  merchantId={store.slug}
                  merchantUrl={store.websiteUrl}
                  itemLabel="deals"
                />
              </section>
            )}

            {/* Promotions — product promotions with image/price */}
            {store.promotions.length > 0 && (
              <section>
                <h2 className="mb-3 text-base font-bold text-ink">
                  {dict.store.promotionsTitle.replace("{store}", store.name)}
                </h2>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {store.promotions.map((promotion) => (
                    <LightningDealCard key={promotion.id} deal={promotion} />
                  ))}
                </div>
              </section>
            )}

            {/* Advertiser exists but has no published offers yet */}
            {!hasOffers && (
              <div className="rounded-card border border-dashed border-line-strong bg-white p-12 text-center">
                <p className="text-sm font-semibold text-ink">
                  {dict.store.noOffersYet.replace("{store}", store.name)}
                </p>
                <p className="mt-1 text-sm text-ink-muted">
                  {dict.store.couponsAppearHere}
                </p>
              </div>
            )}
          </div>

          <aside className="space-y-6 lg:col-span-4">
            <StoreEssentials store={store} country={params.country} />
            <StoreSidebar store={store} aiContent={aiContent} country={params.country} />
            <RelatedStores
              stores={store.relatedStores}
              country={params.country}
              title={dict.storeV2.relatedTitle}
              variant="sidebar"
            />
          </aside>
        </div>

        {/* Product offers, redemption help and merchant facts run full width. */}
        <div className="mt-8 space-y-6">
          <StoreProductOffers products={store.products} storeName={store.name} />

          {store.coupons.length > 0 && <HowItWorks />}

          <div className="grid gap-6 lg:grid-cols-2">
            <StoreInfoPanel store={store} />
            {store.faqs.length > 0 && (
              <FaqAccordion faqs={store.faqs} storeName={store.name} />
            )}
          </div>

          <LastVerifiedSection verifications={verifications} storeName={store.name} />
        </div>
      </main>
    </div>
  );
}
