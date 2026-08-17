import type { StorePageContent } from "@/lib/ai/storeContent";

/** True when a value is present and not a "Not available"-style placeholder. */
function hasVal(v: unknown): v is string {
  if (typeof v !== "string") return false;
  const s = v.trim().toLowerCase();
  return s !== "" && s !== "not available" && s !== "n/a" && s !== "unknown" && s !== "verification required";
}

function Card({ title, children }: { title?: string; children: React.ReactNode }) {
  return (
    <section className="mb-6 break-inside-avoid bg-white p-5 rounded border border-gray-200">
      {title && <h3 className="font-bold text-gray-900 mb-3">{title}</h3>}
      {children}
    </section>
  );
}

function InfoRow({ label, value }: { label: string; value?: string }) {
  if (!hasVal(value)) return null;
  return (
    <div className="flex justify-between gap-4 py-1.5 text-sm border-b border-gray-100 last:border-0">
      <span className="text-gray-500">{label}</span>
      <span className="font-medium text-gray-800 text-right">{value}</span>
    </div>
  );
}

const CAL_COLORS: Record<string, string> = {
  high: "bg-emerald-100 text-emerald-800",
  medium: "bg-amber-100 text-amber-800",
  low: "bg-gray-100 text-gray-500",
};

const CAL_LABEL: Record<"high" | "medium" | "low", string> = {
  high: "High",
  medium: "Med",
  low: "Low",
};

/**
 * Normalise a calendar "activity" value to a single level. The AI is asked for
 * exactly "High" | "Medium" | "Low", but older cached content sometimes stored
 * verbose strings ("High - Big Vol. active through August 20") — collapse those
 * so the calendar cells stay on one clean row.
 */
function calLevel(activity?: string): "high" | "medium" | "low" | null {
  if (!activity) return null;
  const s = activity.toLowerCase();
  if (/\b(high|peak|busy|big)\b/.test(s)) return "high";
  if (/\b(medium|moderate|mid)\b/.test(s)) return "medium";
  if (/\b(low|quiet|slow)\b/.test(s)) return "low";
  return null;
}

export default function StoreAiSections({
  content,
  storeName,
}: {
  content: StorePageContent;
  storeName: string;
}) {
  const c = content;

  const trust = c.trustpilot;
  const google = c.google_rating;
  const showTrustPanel =
    hasVal(trust?.rating) ||
    hasVal(google?.rating) ||
    hasVal(c.typical_discount) ||
    hasVal(c.cashback?.rate) ||
    hasVal(c.cashback?.available) ||
    typeof c.information_confidence === "number";

  const bt = c.best_time_to_shop;
  const showBestTime = hasVal(bt?.season) || hasVal(bt?.reason) || (bt?.events?.length ?? 0) > 0;

  const shipping = c.shipping;
  const showShipping =
    shipping && Object.values(shipping).some((v) => hasVal(v));

  const returns = c.returns;
  const showReturns = returns && Object.values(returns).some((v) => hasVal(v));

  const payments = (c.payment_methods ?? []).filter(hasVal);
  const calendar = (c.shopping_calendar ?? []).filter((m) => m && m.month);

  return (
    <div>
      <div className="columns-1 gap-6 lg:columns-2">

      {/* Best time to shop + calendar */}
      {showBestTime && (
        <Card title={`Best Time to Shop at ${storeName}`}>
          <div className="space-y-1.5 text-sm">
            <InfoRow label="Best season" value={bt?.season} />
            {(bt?.months?.length ?? 0) > 0 && (
              <InfoRow label="Best months" value={bt!.months!.join(", ")} />
            )}
            {(bt?.events?.length ?? 0) > 0 && (
              <InfoRow label="Key events" value={bt!.events!.join(", ")} />
            )}
            <InfoRow label="Confidence" value={bt?.confidence} />
          </div>
          {hasVal(bt?.reason) && <p className="mt-3 text-sm text-gray-600">{bt!.reason}</p>}

          {calendar.length > 0 && (
            <div className="mt-4 grid grid-cols-3 gap-1.5 sm:grid-cols-4 lg:grid-cols-6">
              {calendar.map((m) => {
                const lvl = calLevel(m.activity);
                return (
                  <div
                    key={m.month}
                    className={`flex items-center justify-between gap-1 whitespace-nowrap rounded px-2 py-1 text-[11px] font-medium ${
                      lvl ? CAL_COLORS[lvl] : "bg-gray-100 text-gray-500"
                    }`}
                  >
                    <span className="font-semibold">{m.month.slice(0, 3)}</span>
                    {lvl && <span className="opacity-80">{CAL_LABEL[lvl]}</span>}
                  </div>
                );
              })}
            </div>
          )}
        </Card>
      )}

      {/* How to save the most */}
      {hasVal(c.best_saving_strategy) && (
        <Card title={`How to Save the Most at ${storeName}`}>
          <p className="text-sm leading-relaxed text-gray-700 text-justify whitespace-pre-line">
            {c.best_saving_strategy}
          </p>
        </Card>
      )}

      {/* Shipping & Delivery */}
      {showShipping && (
        <Card title="Shipping & Delivery">
          <InfoRow label="Free shipping" value={shipping!.free_shipping} />
          <InfoRow label="Free over" value={shipping!.threshold} />
          <InfoRow label="Standard cost" value={shipping!.standard_cost} />
          <InfoRow label="Delivery time" value={shipping!.delivery_time} />
          <InfoRow label="International" value={shipping!.international_shipping} />
        </Card>
      )}

      {/* Returns & Refunds */}
      {showReturns && (
        <Card title="Returns & Refunds">
          <InfoRow label="Return window" value={returns!.return_window} />
          <InfoRow label="Refund" value={returns!.refund} />
          <InfoRow label="Exchange" value={returns!.exchange} />
          <InfoRow label="Return shipping" value={returns!.return_shipping} />
          {hasVal(returns!.conditions) && (
            <p className="mt-2 text-xs text-gray-500">{returns!.conditions}</p>
          )}
        </Card>
      )}

      {/* Payment methods */}
      {payments.length > 0 && (
        <Card title="Payment Methods">
          <div className="flex flex-wrap gap-2">
            {payments.map((p) => (
              <span
                key={p}
                className="rounded-full border border-gray-200 bg-gray-50 px-3 py-1 text-xs font-medium text-gray-700"
              >
                {p}
              </span>
            ))}
          </div>
        </Card>
      )}

      {/* Merchant overview */}
      {hasVal(c.merchant_overview) && (
        <Card title={`About ${storeName}`}>
          <p className="text-sm leading-relaxed text-gray-700 text-justify whitespace-pre-line">
            {c.merchant_overview}
          </p>
          {(c.categories?.length ?? 0) > 0 && (
            <div className="mt-3 flex flex-wrap gap-2">
              {c.categories!.map((cat) => (
                <span key={cat} className="rounded bg-gray-100 px-2 py-0.5 text-[11px] text-gray-600">
                  {cat}
                </span>
              ))}
            </div>
          )}
        </Card>
      )}

      {/* How to use a coupon */}
      {(c.how_to_use_coupon?.length ?? 0) > 0 && (
        <Card title={`How to Use a ${storeName} Coupon`}>
          <ol className="list-decimal space-y-1.5 pl-5 text-sm text-gray-700">
            {c.how_to_use_coupon!.filter(hasVal).map((step, i) => (
              <li key={i}>{step}</li>
            ))}
          </ol>
        </Card>
      )}

      {/* Buying advice + editorial tips */}
      {(hasVal(c.buying_advice) || (c.editorial_tips?.length ?? 0) > 0) && (
        <Card title="Buying Advice">
          {hasVal(c.buying_advice) && (
            <p className="text-sm leading-relaxed text-gray-700 text-justify whitespace-pre-line">
              {c.buying_advice}
            </p>
          )}
          {(c.editorial_tips?.length ?? 0) > 0 && (
            <ul className="mt-3 list-disc space-y-1.5 pl-5 text-sm text-gray-700">
              {c.editorial_tips!.filter(hasVal).map((tip, i) => (
                <li key={i}>{tip}</li>
              ))}
            </ul>
          )}
        </Card>
      )}

      {/* FAQ */}
      {(c.faq?.length ?? 0) > 0 && (
        <Card title="Frequently Asked Questions">
          <div className="divide-y divide-gray-100">
            {c.faq!
              .filter((f) => hasVal(f?.question) && hasVal(f?.answer))
              .map((f, i) => (
                <div key={i} className="py-3 first:pt-0 last:pb-0">
                  <p className="text-sm font-semibold text-gray-900">{f.question}</p>
                  <p className="mt-1 text-sm text-gray-600">{f.answer}</p>
                </div>
              ))}
          </div>
        </Card>
      )}

      {/* Should you buy — trust conclusion */}
      {hasVal(c.trust_information) && (
        <Card title={`Should You Buy From ${storeName}?`}>
          <p className="text-sm leading-relaxed text-gray-700 text-justify whitespace-pre-line">
            {c.trust_information}
          </p>
        </Card>
      )}

      </div>

      {/* Affiliate disclosure */}
      {hasVal(c.affiliate_disclosure) && (
        <p className="mt-2 px-1 text-xs text-gray-400">{c.affiliate_disclosure}</p>
      )}
    </div>
  );
}
