import type { Metadata } from "next";
import Link from "next/link";
import Breadcrumbs from "@/components/store/Breadcrumbs";
import { getDictionary } from "@/i18n";
import { getSiteUrl, REGION_CODES, getRegionConfig } from "@/lib/regions";
import { countryName } from "@/lib/countries";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: { country: string };
}): Promise<Metadata> {
  const country = params.country.toUpperCase();
  const name = countryName(country);
  const siteUrl = getSiteUrl();
  const lc = params.country.toLowerCase();

  const hreflang: Record<string, string> = {};
  for (const code of REGION_CODES) {
    const r = getRegionConfig(code);
    hreflang[r.locale] = `${siteUrl}/${code.toLowerCase()}/methodology`;
  }
  hreflang["x-default"] = `${siteUrl}/us/methodology`;

  return {
    title: `Methodology & Verification Standards — Foxzil ${name}`,
    description: `Learn how Foxzil verifies retailer prices, evaluates promotional eligibility, calculates delivered totals, and matches identical product variants in ${name}.`,
    alternates: {
      canonical: `${siteUrl}/${lc}/methodology`,
      languages: hreflang,
    },
  };
}

export default async function MethodologyPage({
  params,
}: {
  params: { country: string };
}) {
  const lc = params.country.toLowerCase();
  const country = params.country.toUpperCase();
  const name = countryName(country);
  const dict = await getDictionary(country);

  return (
    <div className="min-h-screen bg-canvas pb-16">
      <div className="mx-auto max-w-shell px-4 py-6 sm:px-6 lg:px-8">
        <Breadcrumbs
          items={[
            { label: dict.header.home, href: `/${lc}` },
            { label: dict.footer.methodology || "Methodology" },
          ]}
        />

        <article className="mx-auto mt-6 max-w-4xl rounded-card border border-line bg-white p-6 sm:p-10 shadow-card">
          <header className="border-b border-line pb-8">
            <span className="text-xs font-bold uppercase tracking-widest text-brand">
              Trust & Editorial Standards
            </span>
            <h1 className="mt-2 text-3xl font-extrabold tracking-tight text-ink sm:text-4xl">
              How We Check, Rank & Verify Offers
            </h1>
            <p className="mt-3 text-base leading-relaxed text-ink-soft">
              Foxzil is designed to provide transparent, verifiable price comparisons. We believe shoppers deserve honest delivered totals, verified promo terms, and rigorous variant matching — not sponsored ranking claims.
            </p>
          </header>

          <div className="mt-8 space-y-10 text-sm leading-relaxed text-ink-soft">
            {/* Section 1: The Delivered Total Formula */}
            <section>
              <h2 className="text-xl font-bold text-ink">1. The Delivered Total Formula</h2>
              <p className="mt-2">
                Headline product prices can be deceptive when checkout adds compulsory fees or delivery charges. On Foxzil comparison tables, retailer rows are ordered by known delivered total:
              </p>
              <div className="my-4 rounded-[9px] border border-line bg-canvas p-4 font-mono text-xs text-ink">
                <strong>Known Delivered Total</strong> = (Item Price × Quantity) − Eligible Discount + Delivery Charge + Mandatory Fees + Applicable Taxes
              </div>
              <p className="mt-2">
                <strong>The Honesty Rule:</strong> If a retailer&apos;s delivery rule or mandatory fee has not yet been sourced and verified for your postal code, the total is reported as <em>unknown</em> rather than assumed to be zero. A store whose costs are incomplete is never crowned the cheapest on an unevidenced guess.
              </p>
              <div className="mt-4 rounded-[9px] border border-brand-border bg-brand-soft/50 p-4">
                <span className="font-semibold text-ink text-xs block">
                  Empirical Benchmark & Repeatable Protocol:
                </span>
                <p className="mt-1 text-xs text-ink-soft">
                  Read our published empirical research:{" "}
                  <Link
                    href={`/${lc}/research/delivered-cost-study`}
                    className="font-bold text-brand hover:underline"
                  >
                    Delivered Cost Index 2026: Item Price vs Checkout Reality →
                  </Link>
                  {" "}— research findings will be published when reviewed source observations are available. No empirical study findings are currently published.
                </p>
              </div>
            </section>

            {/* Section 2: Promotions and Coupons */}
            <section>
              <h2 className="text-xl font-bold text-ink">2. Promotional Eligibility & Calculations</h2>
              <p className="mt-2">
                A promotional code or deal is only applied to reduce the payable total when it satisfies strict conditions:
              </p>
              <ul className="mt-3 list-disc space-y-2 pl-5">
                <li>
                  <strong>Calculability:</strong> The benefit must be a concrete, unconditional discount. Advertised &ldquo;up to&rdquo; savings are ceilings, not guarantees, and are never subtracted from checkout totals.
                </li>
                <li>
                  <strong>Customer Eligibility:</strong> Offers exclusive to new customers, student verifications, app downloads, or paid memberships are flagged as <em>conditional</em> unless verified.
                </li>
                <li>
                  <strong>Cashback Distinction:</strong> Cashback is contingent and paid post-purchase. It is displayed in its own dedicated column and never subtracted from checkout payable totals.
                </li>
              </ul>
            </section>

            {/* Section 3: Verification Levels */}
            <section>
              <h2 className="text-xl font-bold text-ink">3. Three Evidence Status Levels</h2>
              <p className="mt-2">
                Every promotional offer and coupon card is labelled with its exact level of verification:
              </p>
              <div className="mt-4 grid gap-4 sm:grid-cols-3">
                <div className="rounded-card border border-emerald-200 bg-emerald-50/60 p-4">
                  <span className="inline-block rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-bold text-emerald-800">
                    Checkout-Tested
                  </span>
                  <p className="mt-2 text-xs text-emerald-950">
                    A real test order was carried out at checkout, recording verified eligibility conditions and exact basket deductions.
                  </p>
                </div>

                <div className="rounded-card border border-line bg-canvas p-4">
                  <span className="inline-block rounded-full bg-slate-200 px-2.5 py-0.5 text-xs font-bold text-slate-800">
                    Merchant-Listed
                  </span>
                  <p className="mt-2 text-xs text-ink-soft">
                    Sourced directly from the official retailer data feed or public commercial disclosure, but not independently tested in basket.
                  </p>
                </div>

                <div className="rounded-card border border-amber-200 bg-amber-50/60 p-4">
                  <span className="inline-block rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-bold text-amber-800">
                    Community-Reported
                  </span>
                  <p className="mt-2 text-xs text-amber-950">
                    Reported by shoppers or community members, undergoing verification and monitoring for expiration.
                  </p>
                </div>
              </div>
            </section>

            {/* Section 4: Identifier-First Matching */}
            <section>
              <h2 className="text-xl font-bold text-ink">4. Identifier-First Product Matching</h2>
              <p className="mt-2">
                Comparing different pack sizes, volumes, or conditions as if they are the same product misleadingly distorts price comparison. Our catalog adheres to rigorous matching rules:
              </p>
              <ul className="mt-3 list-disc space-y-2 pl-5">
                <li>
                  <strong>Barcode Matching:</strong> Exact matches must share a verified Global Trade Item Number (GTIN-13 / GTIN-14 / UPC / EAN).
                </li>
                <li>
                  <strong>Model Matching:</strong> In the absence of a GTIN, a verified Brand and Manufacturer Part Number (MPN) must agree.
                </li>
                <li>
                  <strong>Conflict Exclusion:</strong> Any contradiction in pack count (e.g. 1-pack vs 3-pack), size (e.g. 50ml vs 100ml), or condition (new vs refurbished) automatically splits the items into separate variants or sends them to an editorial review desk.
                </li>
                <li>
                  <strong>No Fuzzy Exact Claims:</strong> Simple title similarities without identifier proof are explicitly labelled as title matches with verification warnings.
                </li>
              </ul>
            </section>

            {/* Section 5: Commercial Independence & Corrections */}
            <section className="border-t border-line pt-6">
              <h2 className="text-xl font-bold text-ink">5. Commercial Independence & Corrections</h2>
              <p className="mt-2">
                Foxzil earns affiliate commissions when shoppers purchase through links on our site. However:
              </p>
              <ul className="mt-3 list-disc space-y-2 pl-5">
                <li>Retailers cannot pay to alter their position in delivered total comparison tables.</li>
                <li>No artificial &ldquo;was-prices&rdquo;, fake star ratings, or simulated review seals are fabricated.</li>
                <li>Historical prices are recorded on append-only timelines with actual observation timestamps.</li>
              </ul>
              <div className="mt-6 rounded-card border border-brand-border bg-brand-soft p-5">
                <h3 className="font-bold text-ink">Spotted an error or broken offer?</h3>
                <p className="mt-1 text-xs text-ink-soft">
                  We maintain a rapid correction workflow for shoppers and merchants. Submit discrepancies directly to our editorial team:
                </p>
                <Link
                  href={`/${lc}/report-issue`}
                  className="mt-3 inline-block rounded-[9px] bg-brand px-4 py-2 text-xs font-semibold text-white transition hover:bg-brand-hover"
                >
                  Submit a Correction or Dispute →
                </Link>
              </div>
            </section>
          </div>
        </article>
      </div>
    </div>
  );
}
