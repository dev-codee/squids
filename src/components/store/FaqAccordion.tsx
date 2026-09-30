"use client";

import { useState } from "react";
import type { FAQItem } from "@/lib/storeData";
import { useDictionary } from "@/i18n/DictionaryProvider";

interface FaqAccordionProps {
  faqs: FAQItem[];
  storeName: string;
}

export default function FaqAccordion({ faqs, storeName }: FaqAccordionProps) {
  const dict = useDictionary();
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  const toggle = (idx: number) => {
    setOpenIndex(openIndex === idx ? null : idx);
  };

  return (
    <div className="rounded-card border border-line bg-white p-5">
      <div className="mb-4">
        <h3 className="text-base font-bold text-ink">
          {dict.faqWidget.title.replace("{store}", storeName)}
        </h3>
        <p className="mt-1 text-xs text-ink-soft">
          {dict.faqWidget.subtitle.replace("{store}", storeName)}
        </p>
      </div>

      <div className="divide-y divide-line">
        {faqs.map((faq, idx) => {
          const isOpen = openIndex === idx;
          return (
            <div key={idx} className="py-3">
              <button
                onClick={() => toggle(idx)}
                className="flex w-full items-center justify-between gap-3 text-left text-sm font-semibold text-ink focus:outline-none"
              >
                <span>{faq.question}</span>
                <span className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-canvas-sunk text-ink-muted">
                  {isOpen ? "−" : "+"}
                </span>
              </button>
              {isOpen && (
                <p className="animate-fade-in mt-2.5 text-sm leading-relaxed text-ink-soft">
                  {faq.answer}
                </p>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
