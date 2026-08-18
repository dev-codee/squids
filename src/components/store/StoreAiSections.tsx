"use client";

import type { StorePageContent } from "@/lib/ai/storeContent";
import { useDictionary } from "@/i18n/DictionaryProvider";

/** True when a value is present and not a "Not available"-style placeholder. */
function hasVal(v: unknown): v is string {
  if (typeof v !== "string") return false;
  const s = v.trim().toLowerCase();
  return (
    s !== "" &&
    s !== "not available" &&
    s !== "n/a" &&
    s !== "unknown" &&
    s !== "verification required" &&
    s !== "nicht verfügbar" &&
    s !== "non disponible" &&
    s !== "no disponible" &&
    s !== "non disponibile"
  );
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

/**
 * Normalise a calendar "activity" value to a single level.
 */
function calLevel(activity?: string): "high" | "medium" | "low" | null {
  if (!activity) return null;
  const s = activity.toLowerCase();
  if (/\b(high|peak|busy|big|hoch|eleve|élevé|alto)\b/.test(s)) return "high";
  if (/\b(medium|moderate|mid|med|mittel|moyen|medio)\b/.test(s)) return "medium";
  if (/\b(low|quiet|slow|niedrig|faible|bajo|basso)\b/.test(s)) return "low";
  return null;
}

const MONTH_KEY_MAP: Record<string, string> = {
  jan: "jan", january: "jan", januar: "jan", janvier: "jan", enero: "jan", gennaio: "jan",
  feb: "feb", february: "feb", februar: "feb", fevrier: "feb", février: "feb", febrero: "feb", febbraio: "feb",
  mar: "mar", march: "mar", mär: "mar", marz: "mar", märz: "mar", mars: "mar", marzo: "mar",
  apr: "apr", april: "apr", avril: "apr", abril: "apr", aprile: "apr",
  may: "may", mai: "may", mayo: "may", maggio: "may",
  jun: "jun", june: "jun", juni: "jun", juin: "jun", junio: "jun", giugno: "jun",
  jul: "jul", july: "jul", juli: "jul", juillet: "jul", julio: "jul", luglio: "jul",
  aug: "aug", august: "aug", aout: "aug", août: "aug", agosto: "aug",
  sep: "sep", sept: "sep", september: "sep", septembre: "sep", septiembre: "sep", settembre: "sep",
  oct: "oct", okt: "oct", october: "oct", oktober: "oct", octobre: "oct", octubre: "oct", ottobre: "oct",
  nov: "nov", november: "nov", novembre: "nov", noviembre: "nov",
  dec: "dec", dez: "dec", december: "dec", dezember: "dec", decembre: "dec", décembre: "dec", diciembre: "dec", dicembre: "dec",
};

function formatMonth(rawMonth: string, monthsDict?: Record<string, string>): string {
  if (!monthsDict) return rawMonth.slice(0, 3);
  const clean = rawMonth.trim().toLowerCase();
  const key = MONTH_KEY_MAP[clean] || MONTH_KEY_MAP[clean.slice(0, 3)];
  if (key && monthsDict[key]) {
    return monthsDict[key];
  }
  return rawMonth.slice(0, 3);
}

export default function StoreAiSections({
  content,
  storeName,
}: {
  content: StorePageContent;
  storeName: string;
}) {
  const dict = useDictionary();
  const c = content;

  const calLabels = {
    high: dict.storeAi.calHigh,
    medium: dict.storeAi.calMed,
    low: dict.storeAi.calLow,
  };

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
        <Card title={dict.storeAi.bestTimeToShop.replace("{store}", storeName)}>
          <div className="space-y-1.5 text-sm">
            <InfoRow label={dict.storeAi.bestSeason} value={bt?.season} />
            {(bt?.months?.length ?? 0) > 0 && (
              <InfoRow label={dict.storeAi.bestMonths} value={bt!.months!.join(", ")} />
            )}
            {(bt?.events?.length ?? 0) > 0 && (
              <InfoRow label={dict.storeAi.keyEvents} value={bt!.events!.join(", ")} />
            )}
            <InfoRow label={dict.storeAi.confidence} value={bt?.confidence} />
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
                    <span className="font-semibold">{formatMonth(m.month, dict.storeAi.months)}</span>
                    {lvl && <span className="opacity-80">{calLabels[lvl]}</span>}
                  </div>
                );
              })}
            </div>
          )}
        </Card>
      )}

      {/* How to save the most */}
      {hasVal(c.best_saving_strategy) && (
        <Card title={dict.storeAi.howToSaveMost.replace("{store}", storeName)}>
          <p className="text-sm leading-relaxed text-gray-700 text-justify whitespace-pre-line">
            {c.best_saving_strategy}
          </p>
        </Card>
      )}

      {/* Shipping & Delivery */}
      {showShipping && (
        <Card title={dict.storeAi.shippingDelivery}>
          <InfoRow label={dict.storeAi.freeShipping} value={shipping!.free_shipping} />
          <InfoRow label={dict.storeAi.freeOver} value={shipping!.threshold} />
          <InfoRow label={dict.storeAi.standardCost} value={shipping!.standard_cost} />
          <InfoRow label={dict.storeAi.deliveryTime} value={shipping!.delivery_time} />
          <InfoRow label={dict.storeAi.international} value={shipping!.international_shipping} />
        </Card>
      )}

      {/* Returns & Refunds */}
      {showReturns && (
        <Card title={dict.storeAi.returnsRefunds}>
          <InfoRow label={dict.storeAi.returnWindow} value={returns!.return_window} />
          <InfoRow label={dict.storeAi.refund} value={returns!.refund} />
          <InfoRow label={dict.storeAi.exchange} value={returns!.exchange} />
          <InfoRow label={dict.storeAi.returnShipping} value={returns!.return_shipping} />
          {hasVal(returns!.conditions) && (
            <p className="mt-2 text-xs text-gray-500">{returns!.conditions}</p>
          )}
        </Card>
      )}

      {/* Payment methods */}
      {payments.length > 0 && (
        <Card title={dict.storeAi.paymentMethods}>
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
        <Card title={dict.storeAi.aboutStore.replace("{store}", storeName)}>
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
        <Card title={dict.storeAi.howToUseCoupon.replace("{store}", storeName)}>
          <ol className="list-decimal space-y-1.5 pl-5 text-sm text-gray-700">
            {c.how_to_use_coupon!.filter(hasVal).map((step, i) => (
              <li key={i}>{step}</li>
            ))}
          </ol>
        </Card>
      )}

      {/* Buying advice + editorial tips */}
      {(hasVal(c.buying_advice) || (c.editorial_tips?.length ?? 0) > 0) && (
        <Card title={dict.storeAi.buyingAdvice}>
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
        <Card title={dict.storeAi.faq}>
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
        <Card title={dict.storeAi.shouldYouBuy.replace("{store}", storeName)}>
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
