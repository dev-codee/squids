"use client";

import type { HomeFaq } from "@/lib/db/homeSettings";

export default function HomeFaqs({ faqs }: { faqs: HomeFaq[] }) {
  return (
    <section className="py-16 bg-white">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-10">
          <h2 className="text-xl font-bold text-gray-900">
            Frequently Asked Questions
          </h2>
          <p className="mt-2 text-sm text-gray-500">
            Questions and Answers to Frequently Asked Questions
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {(!faqs || faqs.length === 0) ? (
            <div className="col-span-1 md:col-span-2 text-center text-gray-500 py-8 border border-dashed border-gray-300 rounded-lg">
              No FAQs added yet.
            </div>
          ) : (
            faqs.map((faq, i) => (
              <div key={i} className="bg-[#F9F9F9] p-6 rounded shadow-sm border border-gray-100">
                <h3 className="font-bold text-gray-900 text-sm mb-3">
                  {faq.question}
                </h3>
                <div className="text-xs text-gray-600 leading-relaxed space-y-2 whitespace-pre-wrap">
                  {faq.answer}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </section>
  );
}
