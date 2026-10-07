import type { Metadata } from "next";
import { notFound, permanentRedirect } from "next/navigation";
import { loadStoreData } from "@/lib/storeData";
import StoreHeader from "@/components/store/StoreHeader";
import Breadcrumbs from "@/components/store/Breadcrumbs";
import HorizontalCouponCard from "@/components/store/HorizontalCouponCard";
import type { CouponItem } from "@/lib/storeData";
import { getDictionary } from "@/i18n";
import { getSiteUrl, REGION_CODES, getRegionConfig } from "@/lib/regions";
import { getLatestVerificationsForStore } from "@/lib/db/coupon-verifications";
import LastVerifiedSection from "@/components/store/LastVerifiedSection";

export async function generateMetadata({
  params,
}: {
  params: { country: string; store: string };
}): Promise<Metadata> {
  const [store, dict] = await Promise.all([
    loadStoreData(params.store, params.country),
    getDictionary(params.country),
  ]);
  if (!store) return {};

  const siteUrl = getSiteUrl();
  const canonicalUrl = `${siteUrl}/${params.country.toLowerCase()}/${store.slug}/coupons`;

  const hreflangLanguages = { [getRegionConfig(params.country).locale]: canonicalUrl };

  return {
    robots: { index: store.coupons.length > 0, follow: true },
    title: dict.meta.couponsTitle.replace("{store}", store.name),
    description: dict.meta.couponsDescription.replace("{store}", store.name),
    alternates: {
      canonical: canonicalUrl,
      languages: hreflangLanguages,
    },
  };
}

export const dynamic = "force-dynamic";

export default async function StoreCouponsPage({
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
  const verifications = await getLatestVerificationsForStore(store.slug, 6, params.country, store.network);

  if (rawSlug !== store.slug) {
    permanentRedirect(`/${params.country}/${store.slug}/coupons`);
  }

  const verifiedCoupons = store.coupons.filter((c) => c.verified);
  const promoCodes = store.coupons.filter((c) => c.code !== null);
  const studentDiscounts = store.coupons.filter((c) => c.type === "student");
  const cashbackOffers = store.coupons.filter((c) => c.type === "cashback");

  const section = (
    title: string,
    subtitle: string,
    items: CouponItem[],
    badge: { text: string; className: string },
    icon?: string,
  ) =>
    items.length > 0 && (
      <section>
        <div className="mb-6 flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2">
              {icon && <span className="text-xl">{icon}</span>}
              <h2 className="text-2xl font-extrabold text-ink">{title}</h2>
            </div>
            <p className="text-xs text-ink-soft mt-1">{subtitle}</p>
          </div>
          <span className={`rounded-lg px-3 py-1 text-xs font-bold ${badge.className}`}>
            {items.length} {badge.text}
          </span>
        </div>
        {/* List view, not a grid: the same stacked card the store page uses, so
            the code, its terms and the expiry stay readable at a glance. */}
        <div className="space-y-4">
          {items.map((coupon) => (
            <HorizontalCouponCard
              key={coupon.id}
              coupon={coupon}
              storeName={store.name}
              market={params.country}
              merchantId={store.slug}
              merchantUrl={store.websiteUrl}
            />
          ))}
        </div>
      </section>
    );

  const hasAny = store.coupons.length > 0;

  return (
    <div className="min-h-screen bg-canvas/60 pb-16">
      <StoreHeader store={store} country={params.country} />

      <main className="mx-auto max-w-shell px-4 py-8 sm:px-6 lg:px-8 space-y-12">
        <Breadcrumbs
          items={[
            { label: "Home", href: `/${params.country}` },
            { label: "Stores", href: `/${params.country}/stores` },
            { label: store.name, href: `/${params.country}/${store.slug}` },
            { label: "Coupons" },
          ]}
        />
        {/* Intro */}
        <div className="rounded-2xl bg-gradient-to-r from-brand to-brand-hover p-8 text-white shadow-lg">
          <div className="max-w-3xl">
            <span className="inline-flex items-center rounded-lg bg-white/20 px-3 py-1 text-xs font-bold text-white backdrop-blur-sm mb-3">
              {dict.couponsPage.officialDirectory.replace("{store}", store.name)}
            </span>
            <h1 className="text-3xl font-extrabold sm:text-4xl">
              {dict.couponsPage.heading.replace("{store}", store.name)}
            </h1>
            <p className="mt-2 text-sm text-brand-soft leading-relaxed">
              {dict.couponsPage.intro.replace("{store}", store.name)}
            </p>
          </div>
        </div>

        {section(
          dict.couponsPage.verifiedCoupons,
          dict.couponsPage.verifiedCouponsSub,
          verifiedCoupons,
          { text: dict.couponsPage.activeCodes, className: "bg-emerald-50 text-emerald-700" },
        )}
        {section(
          dict.couponsPage.promoCodes,
          dict.couponsPage.promoCodesSub,
          promoCodes,
          { text: dict.couponsPage.codes, className: "bg-purple-50 text-purple-700" },
        )}
        {section(
          dict.couponsPage.studentDiscounts,
          dict.couponsPage.studentDiscountsSub,
          studentDiscounts,
          { text: dict.couponsPage.studentOffers, className: "bg-blue-50 text-blue-700" },
          "🎓",
        )}
        {section(
          dict.couponsPage.cashbackOffers,
          dict.couponsPage.cashbackOffersSub,
          cashbackOffers,
          { text: dict.couponsPage.cashbackDeals, className: "bg-emerald-50 text-emerald-700" },
          "💰",
        )}

        {!hasAny && (
          <div className="rounded-2xl border border-dashed border-line-strong bg-white p-12 text-center">
            <p className="text-sm font-semibold text-ink-soft">
              {dict.couponsPage.noneTitle.replace("{store}", store.name)}
            </p>
            <p className="mt-1 text-sm text-ink-soft">
              {dict.couponsPage.noneSub}
            </p>
          </div>
        )}

        <LastVerifiedSection verifications={verifications} storeName={store.name} />
      </main>
    </div>
  );
}
