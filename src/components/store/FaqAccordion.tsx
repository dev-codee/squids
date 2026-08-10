"use client";

import { useState } from "react";
import type { FAQItem } from "@/lib/storeData";

interface FaqAccordionProps {
  faqs: FAQItem[];
  storeName: string;
}

export default function FaqAccordion({ faqs, storeName }: FaqAccordionProps) {
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  const toggle = (idx: number) => {
    setOpenIndex(openIndex === idx ? null : idx);
  };

  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
      <div className="mb-6">
        <h3 className="text-xl font-bold text-gray-900">
          Frequently Asked Questions about {storeName} Coupons
        </h3>
        <p className="text-xs text-gray-500 mt-1">
          Everything you need to know about redeeming codes and saving money at {storeName}.
        </p>
      </div>

      <div className="divide-y divide-gray-200">
        {faqs.map((faq, idx) => {
          const isOpen = openIndex === idx;
          return (
            <div key={idx} className="py-4">
              <button
                onClick={() => toggle(idx)}
                className="flex w-full items-center justify-between text-left text-base font-semibold text-gray-900 focus:outline-none"
              >
                <span>{faq.question}</span>
                <span className="ml-4 flex h-7 w-7 items-center justify-center rounded-full bg-gray-100 text-gray-500">
                  {isOpen ? "−" : "+"}
                </span>
              </button>
              {isOpen && (
                <p className="mt-3 text-sm leading-relaxed text-gray-600 animate-fade-in">
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
