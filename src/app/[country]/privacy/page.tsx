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
    hreflang[r.locale] = `${siteUrl}/${code.toLowerCase()}/privacy`;
  }
  hreflang["x-default"] = `${siteUrl}/us/privacy`;

  return {
    title: dict.privacy.title,
    description: dict.privacy.intro,
    alternates: {
      canonical: `${siteUrl}/${params.country.toLowerCase()}/privacy`,
      languages: hreflang,
    },
  };
}

export default async function PrivacyPage({ params }: { params: { country: string } }) {
  if (!COUNTRY_CODE_RE.test(params.country)) notFound();

  const dict = await getDictionary(params.country);

  return (
    <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6 lg:px-8">
      <h1 className="text-3xl font-extrabold tracking-tight text-gray-900 sm:text-4xl">
        {dict.privacy.title}
      </h1>
      <p className="mt-2 text-sm text-gray-500">Last updated: 1 September 2026</p>

      <div className="mt-6 space-y-8 text-base leading-relaxed text-gray-600">
        <p>{dict.privacy.intro}</p>

        <section>
          <h2 className="text-lg font-semibold text-gray-900">{dict.privacy.collectTitle}</h2>
          <p className="mt-2">{dict.privacy.collectBody}</p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-gray-900">{dict.privacy.affiliateTitle}</h2>
          <p className="mt-2">{dict.privacy.affiliateBody}</p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-gray-900">{dict.privacy.cookiesTitle}</h2>
          <p className="mt-2">{dict.privacy.cookiesBody}</p>
        </section>

        {/* Extended GDPR/ePrivacy sections */}
        <section>
          <h2 className="text-lg font-semibold text-gray-900">Data controller</h2>
          <p className="mt-2">
            The data controller for this website is <strong>Foxzil Ltd.</strong>, United Kingdom.
            For data protection enquiries contact:{" "}
            <a href="mailto:privacy@foxzil.com" className="text-amber-600 underline hover:text-amber-700">
              privacy@foxzil.com
            </a>
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-gray-900">Third-party processors</h2>
          <p className="mt-2">
            We use the following third-party services which may process data on our behalf:
          </p>
          <ul className="mt-2 list-disc pl-5 space-y-1 text-sm">
            <li><strong>Awin, Admitad, Commission Factory, Kwanko</strong> — affiliate tracking cookies</li>
            <li><strong>Google Analytics / Google Ads</strong> (AW-11419881899) — anonymous usage analytics and conversion tracking</li>
            <li><strong>MongoDB Atlas</strong> — cloud database hosting (EU region)</li>
            <li><strong>Vercel</strong> — web hosting and edge CDN</li>
          </ul>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-gray-900">Data retention</h2>
          <p className="mt-2">
            We retain anonymous analytics data for up to 26 months. Affiliate tracking cookies
            set by our network partners follow each network's own retention policy (typically
            30–90 days). We do not store personal data beyond what is necessary for the
            services described above.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-gray-900">Your rights</h2>
          <p className="mt-2">
            Under GDPR and equivalent legislation, you have the right to access, correct,
            or erase personal data we hold about you, and to object to or restrict its
            processing. To exercise these rights, email{" "}
            <a href="mailto:privacy@foxzil.com" className="text-amber-600 underline hover:text-amber-700">
              privacy@foxzil.com
            </a>
            . We will respond within 30 days.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-gray-900">{dict.privacy.contactTitle}</h2>
          <p className="mt-2">
            For general questions about this Privacy Policy, email{" "}
            <a href="mailto:privacy@foxzil.com" className="text-amber-600 underline hover:text-amber-700">
              privacy@foxzil.com
            </a>
            . You can also control or delete cookies through your browser settings at any time.
          </p>
        </section>
      </div>
    </div>
  );
}
