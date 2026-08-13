import { notFound, redirect } from "next/navigation";
import { loadStoreData } from "@/lib/storeData";
import StoreHeader from "@/components/store/StoreHeader";
import CouponCard from "@/components/store/CouponCard";
import type { CouponItem } from "@/lib/storeData";

export const dynamic = "force-dynamic";

export default async function StoreCouponsPage({
  params,
}: {
  params: { country: string; store: string };
}) {
  const rawSlug = params.store;

  if (rawSlug !== rawSlug.toLowerCase()) {
    redirect(`/${params.country}/${rawSlug.toLowerCase()}/coupons`);
  }

  const store = await loadStoreData(rawSlug, params.country);
  if (!store) notFound();

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
              Official {store.name} Coupon Directory
            </span>
            <h1 className="text-3xl font-extrabold sm:text-4xl">
              Verified {store.name} Promo Codes &amp; Discounts
            </h1>
            <p className="mt-2 text-sm text-amber-50 leading-relaxed">
              Browse tested voucher codes, student discounts, and cashback rebate deals. Copy your code and save instantly on {store.name}.
            </p>
          </div>
        </div>

        {section(
          "Verified Coupons",
          "Active discount codes for this store.",
          verifiedCoupons,
          { text: "Active Codes", className: "bg-emerald-50 text-emerald-700" },
        )}
        {section(
          "Promo Codes",
          "Copy and paste at checkout for instant percentage or dollar savings.",
          promoCodes,
          { text: "Codes", className: "bg-purple-50 text-purple-700" },
        )}
        {section(
          "Student Discounts",
          "Exclusive college & university student perks.",
          studentDiscounts,
          { text: "Student Offers", className: "bg-blue-50 text-blue-700" },
          "🎓",
        )}
        {section(
          "Cashback Offers",
          "Earn cashback rebates on eligible orders.",
          cashbackOffers,
          { text: "Cashback Deals", className: "bg-emerald-50 text-emerald-700" },
          "💰",
        )}

        {!hasAny && (
          <div className="rounded-2xl border border-dashed border-gray-300 bg-white p-12 text-center">
            <p className="text-sm font-semibold text-gray-700">
              No coupons published for {store.name} yet
            </p>
            <p className="mt-1 text-sm text-gray-500">
              Check back soon — verified codes are added regularly.
            </p>
          </div>
        )}
      </main>
    </div>
  );
}
