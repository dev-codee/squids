"use client";

import type { HomeFaq } from "@/lib/db/homeSettings";
import { useDictionary } from "@/i18n/DictionaryProvider";
import HomeSection from "./HomeSection";

/**
 * Shopping guidance cards — the admin-authored home FAQs, shown as the
 * closing explainer row. Hidden entirely when no FAQs are configured.
 */
export default function HomeFaqs({ faqs }: { faqs: HomeFaq[] }) {
  const dict = useDictionary();
  if (!faqs || faqs.length === 0) return null;

  return (
    <HomeSection title={dict.home.faqsTitle} tone="white">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {faqs.map((faq, i) => (
          <article
            key={i}
            className="rounded-card border border-line bg-canvas p-5"
          >
            <h3 className="text-[15px] font-semibold leading-snug text-ink">
              {faq.question}
            </h3>
            <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-ink-soft">
              {faq.answer}
            </p>
          </article>
        ))}
      </div>
    </HomeSection>
  );
}
