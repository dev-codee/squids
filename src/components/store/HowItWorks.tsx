"use client";

import { useDictionary } from "@/i18n/DictionaryProvider";

/** "How to use a code" — the three-step redemption strip from the store brief. */
export default function HowItWorks() {
  const dict = useDictionary();
  const t = dict.storeV2;

  const steps = [
    { title: t.step1, desc: t.step1Desc },
    { title: t.step2, desc: t.step2Desc },
    { title: t.step3, desc: t.step3Desc },
  ];

  return (
    <section className="rounded-card border border-line bg-brand-soft/70 p-5">
      <h2 className="text-sm font-bold text-ink">{t.howToUseTitle}</h2>
      <ol className="mt-4 grid gap-5 sm:grid-cols-3">
        {steps.map((step, idx) => (
          <li key={step.title} className="flex items-start gap-3">
            <span className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-brand text-xs font-bold text-white">
              {idx + 1}
            </span>
            <span>
              <span className="block text-sm font-semibold text-ink">{step.title}</span>
              <span className="mt-0.5 block text-xs leading-relaxed text-ink-soft">
                {step.desc}
              </span>
            </span>
          </li>
        ))}
      </ol>
    </section>
  );
}
