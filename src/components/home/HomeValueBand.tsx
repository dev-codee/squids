"use client";

import Link from "next/link";
import { useDictionary } from "@/i18n/DictionaryProvider";

/**
 * Navy explainer band: why the cheapest item price is not the cheapest total.
 * This is the methodology promise the footer's disclosure links back to.
 */
export default function HomeValueBand({ country }: { country: string }) {
  const dict = useDictionary();
  const t = dict.homeV2;
  const lc = country.toLowerCase();

  const points = [
    { title: t.bandItemPrice, body: t.bandItemPriceDesc, icon: <TagIcon /> },
    { title: t.bandDiscount, body: t.bandDiscountDesc, icon: <TicketIcon /> },
    { title: t.bandDelivery, body: t.bandDeliveryDesc, icon: <TruckIcon /> },
  ];

  return (
    <section className="bg-canvas py-10 sm:py-14">
      <div className="mx-auto max-w-shell px-4 sm:px-6 lg:px-8">
        <div className="rounded-card bg-ink px-6 py-8 text-white sm:px-10 sm:py-10">
          <div className="grid gap-8 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] lg:items-center">
            <div>
              <h2 className="text-xl font-bold leading-snug tracking-tight sm:text-2xl">
                {t.bandTitle}
              </h2>
              <p className="mt-3 max-w-md text-sm leading-relaxed text-white/70">
                {t.bandBody}
              </p>
              <Link
                href={`/${lc}/methodology`}
                className="mt-6 inline-block rounded-[9px] bg-brand px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-brand-hover focus:outline-none focus-visible:ring-2 focus-visible:ring-white/50 focus-visible:ring-offset-2 focus-visible:ring-offset-ink"
              >
                {t.bandCta}
              </Link>
            </div>

            <ul className="grid gap-5 sm:grid-cols-3">
              {points.map((p) => (
                <li key={p.title}>
                  <span className="text-white/80" aria-hidden>
                    {p.icon}
                  </span>
                  <p className="mt-2.5 text-sm font-semibold">{p.title}</p>
                  <p className="mt-1 text-xs leading-relaxed text-white/60">
                    {p.body}
                  </p>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </section>
  );
}

function TagIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12.6 2.6 21 11a2 2 0 0 1 0 2.8l-7.2 7.2a2 2 0 0 1-2.8 0L2.6 12.6A2 2 0 0 1 2 11.2V4a2 2 0 0 1 2-2h7.2c.5 0 1 .2 1.4.6Z" />
      <circle cx="7.5" cy="7.5" r="1.3" />
    </svg>
  );
}

function TicketIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 8a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v2a2 2 0 0 0 0 4v2a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-2a2 2 0 0 0 0-4Z" />
      <path d="M14 6v12" strokeDasharray="2 3" />
    </svg>
  );
}

function TruckIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <path d="M2 7h11v9H2zM13 10h4l4 3.5V16h-8z" />
      <circle cx="6.5" cy="18" r="1.8" />
      <circle cx="17" cy="18" r="1.8" />
    </svg>
  );
}
