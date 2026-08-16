import { notFound } from "next/navigation";
import type { Metadata } from "next";

export const dynamic = "force-dynamic";

const COUNTRY_CODE_RE = /^[A-Za-z]{2}$/;

export const metadata: Metadata = {
  title: "About Foxzil",
  description:
    "Learn about Foxzil — a platform presenting deals, discounts, and coupons from affiliate networks.",
};

export default function AboutPage({ params }: { params: { country: string } }) {
  if (!COUNTRY_CODE_RE.test(params.country)) notFound();

  return (
    <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6 lg:px-8">
      <h1 className="text-3xl font-extrabold tracking-tight text-gray-900 sm:text-4xl">
        About Foxzil
      </h1>

      <div className="mt-6 space-y-5 text-base leading-relaxed text-gray-600">
        <p>
          Foxzil is a website that presents deals, discounts, and coupons collected from a range of
          online stores. Our goal is to help shoppers find genuine savings in one place — from promo
          codes and cashback to seasonal offers and flash sales.
        </p>
        <p>
          The deals and offers you see here are made available via different affiliate networks. When
          you click through and shop, you pay the same price as usual — Foxzil simply earns a small
          commission from the network, which keeps this service free for you.
        </p>
        <p>
          Foxzil or its staff is not involved when you make a purchase via these links. Any order,
          payment, delivery, or support is handled directly by the store you shop with.
        </p>
      </div>
    </div>
  );
}
