import { notFound, redirect } from "next/navigation";
import { loadStoreData } from "@/lib/storeData";
import StoreHeader from "@/components/store/StoreHeader";
import CouponCard from "@/components/store/CouponCard";
import type { CouponItem } from "@/lib/storeData";
import { getDictionary } from "@/i18n";

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

  if (rawSlug !== store.slug) {
    redirect(`/${params.country}/${store.slug}/coupons`);
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
              <h2 className="text-2xl font-extrabold text-gray-900">{title}</h2>
            </div>
            <p className="text-xs text-gray-500 mt-1">{subtitle}</p>
          </div>
          <span className={`rounded-lg px-3 py-1 text-xs font-bold ${badge.className}`}>
            {items.length} {badge.text}
          </span>
        </div>
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
          {items.map((coupon) => (
            <CouponCard key={coupon.id} coupon={coupon} storeName={store.name} />
          ))}
        </div>
      </section>
    );

  const hasAny = store.coupons.length > 0;

  return (
    <div className="min-h-screen bg-gray-50/60 pb-16">
      <StoreHeader store={store} />

      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8 space-y-12">
        {/* Intro */}
        <div className="rounded-2xl bg-gradient-to-r from-amber-500 to-amber-600 p-8 text-white shadow-lg">
          <div className="max-w-3xl">
            <span className="inline-flex items-center rounded-lg bg-white/20 px-3 py-1 text-xs font-bold text-white backdrop-blur-sm mb-3">
              {dict.couponsPage.officialDirectory.replace("{store}", store.name)}
            </span>
            <h1 className="text-3xl font-extrabold sm:text-4xl">
              {dict.couponsPage.heading.replace("{store}", store.name)}
            </h1>
            <p className="mt-2 text-sm text-amber-50 leading-relaxed">
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
          <div className="rounded-2xl border border-dashed border-gray-300 bg-white p-12 text-center">
            <p className="text-sm font-semibold text-gray-700">
              {dict.couponsPage.noneTitle.replace("{store}", store.name)}
            </p>
            <p className="mt-1 text-sm text-gray-500">
              {dict.couponsPage.noneSub}
            </p>
          </div>
        )}
      </main>
    </div>
  );
}
