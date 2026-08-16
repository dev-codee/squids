import { notFound } from "next/navigation";
import type { Metadata } from "next";

export const dynamic = "force-dynamic";

const COUNTRY_CODE_RE = /^[A-Za-z]{2}$/;

export const metadata: Metadata = {
  title: "Privacy Policy — Foxzil",
  description: "How Foxzil handles data and affiliate tracking.",
};

export default function PrivacyPage({ params }: { params: { country: string } }) {
  if (!COUNTRY_CODE_RE.test(params.country)) notFound();

  return (
    <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6 lg:px-8">
      <h1 className="text-3xl font-extrabold tracking-tight text-gray-900 sm:text-4xl">
        Privacy Policy
      </h1>

      <div className="mt-6 space-y-6 text-base leading-relaxed text-gray-600">
        <p>
          This Privacy Policy explains how Foxzil handles information when you use our website. By
          using Foxzil, you agree to the practices described below.
        </p>

        <section>
          <h2 className="text-lg font-semibold text-gray-900">Information we collect</h2>
          <p className="mt-2">
            We collect limited, non-personal information such as your approximate region (to show the
            right deals and currency) and basic, anonymous usage analytics that help us improve the
            site.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-gray-900">Affiliate links</h2>
          <p className="mt-2">
            The deals and offers on Foxzil are made available via different affiliate networks. When
            you click a link, the network may set a cookie to attribute your purchase so that Foxzil
            can earn a commission. Foxzil or its staff is not involved when you make a purchase via
            these links — the transaction happens entirely on the store&apos;s own website.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-gray-900">Cookies</h2>
          <p className="mt-2">
            We use cookies to remember your selected region and to enable affiliate tracking. You can
            control or delete cookies through your browser settings at any time.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-gray-900">Contact</h2>
          <p className="mt-2">
            If you have any questions about this Privacy Policy, please reach out to us through the
            website.
          </p>
        </section>
      </div>
    </div>
  );
}
