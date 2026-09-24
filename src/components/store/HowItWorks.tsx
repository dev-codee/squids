const STEPS = [
  {
    title: "Pick an offer",
    desc: "Choose a coupon or deal below that fits what you're buying.",
    icon: (
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
    ),
  },
  {
    title: "Copy the code",
    desc: "Click to reveal and copy — we'll also open the store in a new tab.",
    icon: (
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
    ),
  },
  {
    title: "Save at checkout",
    desc: "Paste the code in the promo box before you pay.",
    icon: (
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
    ),
  },
];

/** Small trust/onboarding strip explaining the redeem flow to first-time visitors. */
export default function HowItWorks() {
  return (
    <div className="bg-white p-6 rounded border border-gray-200 shadow-sm">
      <h2 className="text-sm font-bold text-gray-900 mb-4">How it works</h2>
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-3">
        {STEPS.map((step, idx) => (
          <div key={step.title} className="flex items-start gap-3">
            <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-amber-50 text-amber-600">
              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                {step.icon}
              </svg>
            </div>
            <div>
              <p className="text-sm font-semibold text-gray-900">
                {idx + 1}. {step.title}
              </p>
              <p className="mt-0.5 text-xs text-gray-500 leading-relaxed">{step.desc}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
