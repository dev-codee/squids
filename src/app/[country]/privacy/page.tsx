import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getDictionary } from "@/i18n";

export const dynamic = "force-dynamic";

const COUNTRY_CODE_RE = /^[A-Za-z]{2}$/;

export const metadata: Metadata = {
  title: "Privacy Policy — Foxzil",
  description: "How Foxzil handles data and affiliate tracking.",
};

export default async function PrivacyPage({ params }: { params: { country: string } }) {
  if (!COUNTRY_CODE_RE.test(params.country)) notFound();

  const dict = await getDictionary(params.country);

  return (
    <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6 lg:px-8">
      <h1 className="text-3xl font-extrabold tracking-tight text-gray-900 sm:text-4xl">
        {dict.privacy.title}
      </h1>

      <div className="mt-6 space-y-6 text-base leading-relaxed text-gray-600">
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

        <section>
          <h2 className="text-lg font-semibold text-gray-900">{dict.privacy.contactTitle}</h2>
          <p className="mt-2">{dict.privacy.contactBody}</p>
        </section>
      </div>
    </div>
  );
}
