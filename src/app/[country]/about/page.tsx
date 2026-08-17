import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getDictionary } from "@/i18n";

export const dynamic = "force-dynamic";

const COUNTRY_CODE_RE = /^[A-Za-z]{2}$/;

export const metadata: Metadata = {
  title: "About Foxzil",
  description:
    "Learn about Foxzil — a platform presenting deals, discounts, and coupons from affiliate networks.",
};

export default async function AboutPage({ params }: { params: { country: string } }) {
  if (!COUNTRY_CODE_RE.test(params.country)) notFound();

  const dict = await getDictionary(params.country);

  return (
    <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6 lg:px-8">
      <h1 className="text-3xl font-extrabold tracking-tight text-gray-900 sm:text-4xl">
        {dict.about.title}
      </h1>

      <div className="mt-6 space-y-5 text-base leading-relaxed text-gray-600">
        <p>{dict.about.p1}</p>
        <p>{dict.about.p2}</p>
        <p>{dict.about.p3}</p>
      </div>
    </div>
  );
}
