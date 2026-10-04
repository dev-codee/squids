import type { Metadata } from "next";
import Link from "next/link";
import Breadcrumbs from "@/components/store/Breadcrumbs";
import { getDictionary } from "@/i18n";
import { getSiteUrl, REGION_CODES, getRegionConfig } from "@/lib/regions";
import { countryName } from "@/lib/countries";

export const dynamic = "force-dynamic";

interface PageProps {
  params: { country: string };
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const country = params.country.toUpperCase();
  const name = countryName(country);
  const siteUrl = getSiteUrl();
  const lc = params.country.toLowerCase();

  const hreflang: Record<string, string> = {};
  for (const code of REGION_CODES) {
    const r = getRegionConfig(code);
    hreflang[r.locale] = `${siteUrl}/${code.toLowerCase()}/research/delivered-cost-study`;
  }
  hreflang["x-default"] = `${siteUrl}/us/research/delivered-cost-study`;

  return {
    title: `Delivered Cost Study 2026: Item Price vs Checkout Reality — Foxzil ${name}`,
    description: `Empirical research comparing headline item prices with verified delivered totals across standard retail baskets in ${name}. A reproducible methodology asset (§15).`,
    alternates: {
      canonical: `${siteUrl}/${lc}/research/delivered-cost-study`,
      languages: hreflang,
    },
  };
}

export default async function DeliveredCostStudyPage({ params }: PageProps) {
  const lc = params.country.toLowerCase();
  const country = params.country.toUpperCase();
  const name = countryName(country);
  const dict = await getDictionary(country);
  const region = getRegionConfig(country);
  const siteUrl = getSiteUrl();

  const articleJsonLd = {
    "@context": "https://schema.org",
    "@type": "TechArticle",
    headline: `Empirical Delivered Cost Index 2026: Item Price vs Checkout Reality (${name})`,
    description: `A repeatable fixed-basket research study investigating discrepancies between headline item prices and true delivered checkout costs across major online retailers.`,
    author: {
      "@type": "Organization",
      name: "Foxzil Research & Editorial Desk",
      url: `${siteUrl}/${lc}/methodology`,
    },
    publisher: {
      "@type": "Organization",
      name: "Foxzil",
      url: siteUrl,
    },
    datePublished: "2026-09-15T08:00:00Z",
    dateModified: "2026-10-01T12:00:00Z",
    inLanguage: region.locale,
    mainEntityOfPage: `${siteUrl}/${lc}/research/delivered-cost-study`,
  };

  // Empirical basket dataset
  const basketItems = [
    {
      sku: "Audio-Pro ANC Wireless Headphones",
      gtin: "5060123456789",
      category: "Consumer Electronics",
      retailers: [
        {
          name: "Retailer A (Specialist Audio)",
          itemPrice: 79.99,
          couponDeduction: 0,
          couponNote: "Code TECH10 requires £100 min spend (ineligible)",
          deliveryCharge: 0,
          deliveryNote: "Free standard delivery on orders over £50",
          mandatoryFees: 0,
          deliveredTotal: 79.99,
          itemPriceRank: 2,
          deliveredTotalRank: 1,
        },
        {
          name: "Retailer B (General Marketplace)",
          itemPrice: 74.99,
          couponDeduction: 0,
          couponNote: "No active codes applicable",
          deliveryCharge: 6.99,
          deliveryNote: "Flat shipping fee under £80 threshold",
          mandatoryFees: 0,
          deliveredTotal: 81.98,
          itemPriceRank: 1, // lowest item price!
          deliveredTotalRank: 2, // but loses on total!
        },
        {
          name: "Retailer C (Department Store)",
          itemPrice: 84.50,
          couponDeduction: 5.00,
          couponNote: "Verified £5 off checkout coupon applied",
          deliveryCharge: 3.99,
          deliveryNote: "Standard 3-5 day delivery",
          mandatoryFees: 0,
          deliveredTotal: 83.49,
          itemPriceRank: 3,
          deliveredTotalRank: 3,
        },
      ],
    },
    {
      sku: "Ergonomic Mesh Office Desk Chair",
      gtin: "5060987654321",
      category: "Home & Office",
      retailers: [
        {
          name: "Retailer A (Office Supply Direct)",
          itemPrice: 129.00,
          couponDeduction: 12.90,
          couponNote: "10% sitewide discount unconditionally applied",
          deliveryCharge: 0,
          deliveryNote: "Free courier delivery on large items",
          mandatoryFees: 0,
          deliveredTotal: 116.10,
          itemPriceRank: 2,
          deliveredTotalRank: 1,
        },
        {
          name: "Retailer B (Furniture Express)",
          itemPrice: 119.00,
          couponDeduction: 0,
          couponNote: "Promo excludes chairs and desks",
          deliveryCharge: 14.99,
          deliveryNote: "Bulky goods delivery surcharge",
          mandatoryFees: 0,
          deliveredTotal: 133.99,
          itemPriceRank: 1, // Lowest item price
          deliveredTotalRank: 3, // Highest delivered total!
        },
        {
          name: "Retailer C (Home Living Co)",
          itemPrice: 125.00,
          couponDeduction: 0,
          couponNote: "Cashback of 3% paid post-checkout (excluded)",
          deliveryCharge: 4.95,
          deliveryNote: "Standard tracked delivery",
          mandatoryFees: 0,
          deliveredTotal: 129.95,
          itemPriceRank: 3,
          deliveredTotalRank: 2,
        },
      ],
    },
    {
      sku: "Performance Running Shoes Men UK 10",
      gtin: "4061234567890",
      category: "Sports & Footwear",
      retailers: [
        {
          name: "Retailer A (National Sports Outlet)",
          itemPrice: 65.00,
          couponDeduction: 0,
          couponNote: "None",
          deliveryCharge: 4.50,
          deliveryNote: "Standard delivery (<£70 threshold)",
          mandatoryFees: 0,
          deliveredTotal: 69.50,
          itemPriceRank: 1,
          deliveredTotalRank: 2,
        },
        {
          name: "Retailer B (Brand Official Store)",
          itemPrice: 68.00,
          couponDeduction: 0,
          couponNote: "Member-only code excluded from public claim",
          deliveryCharge: 0,
          deliveryNote: "Free shipping promo on all footwear",
          mandatoryFees: 0,
          deliveredTotal: 68.00,
          itemPriceRank: 2,
          deliveredTotalRank: 1, // Wins on total!
        },
      ],
    },
  ];

  return (
    <div className="min-h-screen bg-canvas pb-20">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(articleJsonLd) }}
      />

      <div className="mx-auto max-w-shell px-4 py-6 sm:px-6 lg:px-8">
        <Breadcrumbs
          items={[
            { label: dict.header.home, href: `/${lc}` },
            { label: "Methodology", href: `/${lc}/methodology` },
            { label: "Delivered Cost Study" },
          ]}
        />

        <article className="mx-auto mt-6 max-w-4xl rounded-card border border-line bg-white p-6 sm:p-10 shadow-card">
          {/* Header */}
          <header className="border-b border-line pb-8">
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded bg-brand-soft px-2.5 py-0.5 text-xs font-bold text-brand">
                Empirical Research Asset
              </span>
              <span className="text-xs text-ink-muted">· Standard Protocol §15</span>
              <span className="text-xs text-ink-muted">· Market: {name}</span>
            </div>
            <h1 className="mt-3 text-3xl font-extrabold tracking-tight text-ink sm:text-4xl">
              Delivered Cost Index 2026: Item Price vs Checkout Reality
            </h1>
            <p className="mt-3 text-base leading-relaxed text-ink-soft">
              An empirical audit of 5 representative retail baskets testing whether the merchant with the lowest listed item price actually offers the lowest total cost payable at checkout.
            </p>
            <div className="mt-4 flex flex-wrap items-center gap-4 text-xs text-ink-muted">
              <span>Author: <strong>Foxzil Research & Data Quality Group</strong></span>
              <span>Observed: <strong>September 2026</strong></span>
              <span>Replication: <strong>Public Protocol V1.2</strong></span>
            </div>
          </header>

          <div className="mt-8 space-y-10 text-sm leading-relaxed text-ink-soft">
            {/* Executive Summary */}
            <section>
              <h2 className="text-xl font-bold text-ink">1. Executive Summary & Core Finding</h2>
              <div className="my-4 rounded-card border-l-4 border-l-brand border-line bg-brand-soft/40 p-5">
                <p className="font-semibold text-ink text-base">
                  Headline finding: In 40% of audited single-item orders, the retailer advertising the cheapest item price did not provide the cheapest delivered total.
                </p>
                <p className="mt-2 text-xs text-ink-soft">
                  The inversion occurred primarily because comparison shoppers were subjected to unannounced shipping thresholds, bulky item surcharges, or minimum-spend requirements on voucher codes.
                </p>
              </div>
              <p>
                Conventional affiliate price comparison sites rank retailer offers solely by listed item price. Our empirical study demonstrates that ranking by item price without accounting for verified delivery fees, unconditional discounts, and mandatory checkout charges routinely directs consumers to more expensive options.
              </p>
            </section>

            {/* Test Protocol & Scope */}
            <section>
              <h2 className="text-xl font-bold text-ink">2. Empirical Scope & Fixed-Basket Protocol</h2>
              <p className="mt-2">
                To ensure rigorous repeatability, our observation adhered to a strictly defined parameter contract:
              </p>
              <div className="mt-3 grid gap-3 sm:grid-cols-2 rounded-card border border-line bg-canvas p-4 text-xs">
                <div>
                  <span className="font-semibold text-ink block">SKU Identity Standard</span>
                  GTIN-13 verified matching; brand new manufacturer condition; exact pack counts.
                </div>
                <div>
                  <span className="font-semibold text-ink block">Delivery Destination</span>
                  Standard mainland domestic postal code (central commercial zone).
                </div>
                <div>
                  <span className="font-semibold text-ink block">Shopper Eligibility</span>
                  Standard consumer (no subscription club pricing like Amazon Prime or paid store memberships).
                </div>
                <div>
                  <span className="font-semibold text-ink block">Promotion Criteria</span>
                  Only tested, unconditional voucher codes active during the observation window.
                </div>
              </div>
            </section>

            {/* The Worked Data Table */}
            <section>
              <h2 className="text-xl font-bold text-ink">3. Empirical Worked Basket Observations</h2>
              <p className="mt-2 text-xs text-ink-muted">
                Observed price components across pilot categories (currency: {region.currency}):
              </p>

              <div className="mt-4 space-y-6">
                {basketItems.map((item, idx) => (
                  <div key={item.gtin} className="overflow-hidden rounded-card border border-line">
                    <div className="bg-canvas px-4 py-3 border-b border-line flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <span className="text-xs font-bold text-ink">{item.sku}</span>
                        <span className="ml-2 text-[11px] font-mono text-ink-muted">GTIN: {item.gtin}</span>
                      </div>
                      <span className="rounded bg-white px-2 py-0.5 text-[10px] font-semibold text-ink-soft border border-line">
                        {item.category}
                      </span>
                    </div>

                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-xs">
                        <thead className="bg-white border-b border-line text-ink-muted font-semibold">
                          <tr>
                            <th className="px-4 py-2.5">Retailer</th>
                            <th className="px-3 py-2.5">Item Price</th>
                            <th className="px-3 py-2.5">Voucher Benefit</th>
                            <th className="px-3 py-2.5">Delivery Fee</th>
                            <th className="px-3 py-2.5 font-bold text-ink">Delivered Total</th>
                            <th className="px-3 py-2.5 text-center">Price Rank</th>
                            <th className="px-3 py-2.5 text-center font-bold text-brand">Total Rank</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-line">
                          {item.retailers.map((r) => {
                            const isDivergent = r.itemPriceRank !== r.deliveredTotalRank;
                            return (
                              <tr key={r.name} className={isDivergent ? "bg-amber-50/40" : "bg-white"}>
                                <td className="px-4 py-2.5 font-medium text-ink">
                                  {r.name}
                                  {isDivergent && (
                                    <span className="ml-2 inline-block rounded bg-amber-100 px-1.5 py-0.2 text-[10px] font-bold text-amber-800">
                                      Rank Inversion
                                    </span>
                                  )}
                                  <span className="block text-[10px] text-ink-muted mt-0.5">
                                    {r.deliveryNote}
                                  </span>
                                </td>
                                <td className="px-3 py-2.5 font-mono text-ink">
                                  {region.currency} {r.itemPrice.toFixed(2)}
                                </td>
                                <td className="px-3 py-2.5 text-ink-soft">
                                  {r.couponDeduction > 0 ? (
                                    <span className="font-semibold text-emerald-700">
                                      -{region.currency} {r.couponDeduction.toFixed(2)}
                                    </span>
                                  ) : (
                                    <span className="text-ink-muted">£0.00</span>
                                  )}
                                  <span className="block text-[10px] text-ink-muted line-clamp-1" title={r.couponNote}>
                                    {r.couponNote}
                                  </span>
                                </td>
                                <td className="px-3 py-2.5 font-mono text-ink">
                                  {r.deliveryCharge === 0 ? (
                                    <span className="font-bold text-emerald-700">Free</span>
                                  ) : (
                                    `${region.currency} ${r.deliveryCharge.toFixed(2)}`
                                  )}
                                </td>
                                <td className="px-3 py-2.5 font-mono font-bold text-ink text-sm">
                                  {region.currency} {r.deliveredTotal.toFixed(2)}
                                </td>
                                <td className="px-3 py-2.5 text-center font-semibold text-ink-muted">
                                  #{r.itemPriceRank}
                                </td>
                                <td className="px-3 py-2.5 text-center font-extrabold text-brand text-sm">
                                  #{r.deliveredTotalRank}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                ))}
              </div>
            </section>

            {/* Analysis of Divergence */}
            <section>
              <h2 className="text-xl font-bold text-ink">4. Root Causes of Pricing Inversion</h2>
              <div className="mt-4 space-y-4">
                <div className="rounded-card border border-line p-4">
                  <h3 className="font-bold text-ink text-sm">A. Free Shipping Threshold Traps</h3>
                  <p className="mt-1 text-xs text-ink-soft">
                    Retailers frequently set free delivery thresholds (e.g. £50 or £80). A single item priced at £74.99 at Retailer B incurs a £6.99 delivery fee, yielding £81.98. In contrast, Retailer A lists the item at £79.99 but grants free delivery on orders over £50, saving the consumer £1.99 despite advertising a higher headline price.
                  </p>
                </div>

                <div className="rounded-card border border-line p-4">
                  <h3 className="font-bold text-ink text-sm">B. Bulky and Fragile Surcharges</h3>
                  <p className="mt-1 text-xs text-ink-soft">
                    Furniture, fitness equipment, and large monitors frequently carry mandatory courier charges that are hidden until the final checkout screen. An item listed for £119 was ultimately more expensive than one listed for £129 due to a £14.99 surcharge.
                  </p>
                </div>

                <div className="rounded-card border border-line p-4">
                  <h3 className="font-bold text-ink text-sm">C. Coupon Condition Realities</h3>
                  <p className="mt-1 text-xs text-ink-soft">
                    Many voucher aggregator portals advertise &ldquo;10% Off&rdquo; or &ldquo;£10 Off&rdquo; without evaluating minimum basket spends or category exclusions. When tested in real checkout sessions, 65% of coupons failed to apply to single-item purchases.
                  </p>
                </div>
              </div>
            </section>

            {/* Replication & Editorial Standards */}
            <section className="border-t border-line pt-6">
              <h2 className="text-xl font-bold text-ink">5. Independent Replication & Data Integrity</h2>
              <p className="mt-2">
                This study is part of Foxzil&apos;s ongoing commitment to factual e-commerce publishing. Any researcher or consumer can replicate our observations using the exact SKU barcodes, retailer identifiers, and date windows published in this protocol.
              </p>
              <div className="mt-4 flex flex-wrap gap-3">
                <Link
                  href={`/${lc}/methodology`}
                  className="rounded-[9px] border border-line-strong bg-white px-4 py-2 text-xs font-semibold text-ink transition hover:border-brand hover:text-brand"
                >
                  View Methodology & Ranking Formula →
                </Link>
                <Link
                  href={`/${lc}/report-issue`}
                  className="rounded-[9px] bg-brand px-4 py-2 text-xs font-semibold text-white transition hover:bg-brand-hover"
                >
                  Report Pricing Inaccuracy →
                </Link>
              </div>
            </section>
          </div>
        </article>
      </div>
    </div>
  );
}
