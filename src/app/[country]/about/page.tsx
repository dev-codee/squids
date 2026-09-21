import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getDictionary } from "@/i18n";
import { getSiteUrl, REGION_CODES, getRegionConfig } from "@/lib/regions";

export const dynamic = "force-dynamic";

const COUNTRY_CODE_RE = /^[A-Za-z]{2}$/;

export async function generateMetadata({
  params,
}: {
  params: { country: string };
}): Promise<Metadata> {
  if (!COUNTRY_CODE_RE.test(params.country)) return {};
  const dict = await getDictionary(params.country);
  const siteUrl = getSiteUrl();

  const hreflang: Record<string, string> = {};
  for (const code of REGION_CODES) {
    const r = getRegionConfig(code);
    hreflang[r.locale] = `${siteUrl}/${code.toLowerCase()}/about`;
  }
  hreflang["x-default"] = `${siteUrl}/us/about`;

  return {
    title: dict.about.title,
    description: dict.about.p1,
    alternates: {
      canonical: `${siteUrl}/${params.country.toLowerCase()}/about`,
      languages: hreflang,
    },
  };
}

export default async function AboutPage({ params }: { params: { country: string } }) {
  if (!COUNTRY_CODE_RE.test(params.country)) notFound();

  const dict = await getDictionary(params.country);

  return (
    <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6 lg:px-8">
      <h1 className="text-3xl font-extrabold tracking-tight text-gray-900 sm:text-4xl">
        {dict.about.title}
      </h1>

      <div className="mt-6 space-y-8 text-base leading-relaxed text-gray-600">
        <p>{dict.about.p1}</p>
        <p>{dict.about.p2}</p>
        <p>{dict.about.p3}</p>

        {/* Operator identity & verification policy */}
        <section className="border-t border-gray-200 pt-6">
          <h2 className="text-xl font-bold text-gray-900 mb-3">Who we are</h2>
          <p>
            Foxzil is operated by Foxzil Ltd., a company registered in the United Kingdom.
            Our editorial team curates and verifies coupon codes and deals from affiliate
            networks including Awin, Admitad, Commission Factory, and Kwanko.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-bold text-gray-900 mb-3">How we verify coupons</h2>
          <p>
            Coupon codes marked "Verified" have been tested at checkout within the last
            30 days, either by our editorial team or via our automated verification
            system. Codes that fail verification are marked expired and removed within
            24 hours. Trust scores reflect coupon success rates, recency, and community
            feedback — not paid placements.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-bold text-gray-900 mb-3">Contact &amp; corrections</h2>
          <p>
            Found an expired code, incorrect information, or a store you'd like us to
            cover? Contact us at{" "}
            <a
              href="mailto:support@foxzil.com"
              className="text-amber-600 underline hover:text-amber-700"
            >
              support@foxzil.com
            </a>
            . We aim to respond within 2 business days and will correct confirmed errors
            within 24 hours of verification.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-bold text-gray-900 mb-3">Affiliate disclosure</h2>
          <p>
            Foxzil earns a commission when you purchase through a link on this site. This
            does not affect the price you pay. All affiliate relationships are clearly
            disclosed on offer cards. We do not accept payment to feature or promote
            specific offers above others.
          </p>
        </section>
      </div>
    </div>
  );
}
